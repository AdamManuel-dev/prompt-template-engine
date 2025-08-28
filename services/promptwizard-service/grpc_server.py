"""
@fileoverview gRPC server implementation for PromptWizard service
@lastmodified 2025-08-26T14:00:00Z

Features: gRPC server with optimization, scoring, streaming support
Main APIs: OptimizePrompt, ScorePrompt, ComparePrompts, StreamOptimization
Constraints: Requires grpcio and grpcio-tools packages
Patterns: gRPC async server, streaming updates, concurrent processing
"""

import asyncio
import logging
from concurrent import futures
from typing import AsyncGenerator, Dict, Any

import grpc
from grpc import aio

# Generated proto imports (would be generated from .proto file)
# import optimization_pb2
# import optimization_pb2_grpc

from app.services.promptwizard_service import PromptWizardService
from app.services.job_manager import JobManager
from app.services.cache_service import CacheService
from app.models import (
    OptimizationRequest as RestOptimizationRequest,
    OptimizationResponse as RestOptimizationResponse,
    ScoringRequest as RestScoringRequest,
    ScoringResponse as RestScoringResponse,
    ComparisonRequest as RestComparisonRequest,
    ComparisonResponse as RestComparisonResponse,
)

logger = logging.getLogger(__name__)


class PromptOptimizationServicer:
    """gRPC servicer for PromptWizard optimization service."""
    
    def __init__(self):
        self.promptwizard_service = PromptWizardService()
        self.job_manager = JobManager()
        self.cache_service = CacheService()
    
    async def initialize(self):
        """Initialize all services."""
        await self.cache_service.initialize()
        await self.job_manager.initialize()
        await self.promptwizard_service.initialize()
        logger.info("gRPC services initialized")
    
    async def cleanup(self):
        """Cleanup all services."""
        await self.cache_service.cleanup()
        await self.job_manager.cleanup()
        await self.promptwizard_service.cleanup()
        logger.info("gRPC services cleaned up")
    
    def _convert_grpc_to_rest_optimization(self, grpc_request) -> RestOptimizationRequest:
        """Convert gRPC optimization request to REST model."""
        return RestOptimizationRequest(
            task=grpc_request.task,
            prompt=grpc_request.prompt,
            target_model=grpc_request.target_model,
            mutate_refine_iterations=grpc_request.mutate_refine_iterations,
            few_shot_count=grpc_request.few_shot_count,
            generate_reasoning=grpc_request.generate_reasoning,
            examples=list(grpc_request.examples) if grpc_request.examples else [],
            constraints=dict(grpc_request.constraints) if grpc_request.constraints else {}
        )
    
    def _convert_rest_to_grpc_optimization(self, rest_response: RestOptimizationResponse):
        """Convert REST optimization response to gRPC message."""
        # This would use the generated protobuf classes
        # For now, return a mock structure
        return {
            'job_id': rest_response.job_id,
            'status': rest_response.status,
            'original_prompt': rest_response.original_prompt,
            'optimized_prompt': rest_response.optimized_prompt,
            'metrics': {
                'accuracy_improvement': rest_response.metrics.get('accuracy_improvement', 0),
                'token_reduction': rest_response.metrics.get('token_reduction', 0),
                'cost_reduction': rest_response.metrics.get('cost_reduction', 0),
                'processing_time': rest_response.metrics.get('processing_time', 0),
                'api_calls_used': rest_response.metrics.get('api_calls_used', 0),
            }
        }
    
    async def OptimizePrompt(self, request, context):
        """Handle optimization requests via gRPC."""
        try:
            logger.info(f"gRPC OptimizePrompt called for task: {request.task}")
            
            # Convert gRPC request to REST model
            rest_request = self._convert_grpc_to_rest_optimization(request)
            
            # Check cache first
            cache_key = self.cache_service.generate_cache_key(rest_request)
            cached_result = await self.cache_service.get(cache_key)
            
            if cached_result:
                logger.info("Returning cached result via gRPC")
                return self._convert_rest_to_grpc_optimization(cached_result)
            
            # Process optimization
            result = await self.promptwizard_service.optimize_prompt(rest_request)
            
            # Cache result
            await self.cache_service.set(cache_key, result)
            
            return self._convert_rest_to_grpc_optimization(result)
            
        except Exception as e:
            logger.error(f"gRPC OptimizePrompt failed: {str(e)}")
            context.set_details(f"Optimization failed: {str(e)}")
            context.set_code(grpc.StatusCode.INTERNAL)
            return None
    
    async def ScorePrompt(self, request, context):
        """Handle scoring requests via gRPC."""
        try:
            logger.info("gRPC ScorePrompt called")
            
            # Convert to REST model
            rest_request = RestScoringRequest(
                prompt=request.prompt,
                task=request.task if request.task else None,
                target_model=request.target_model if request.target_model else None
            )
            
            # Check cache
            cache_key = f"score:{hash(request.prompt + (request.task or ''))}"
            cached_result = await self.cache_service.get(cache_key)
            
            if cached_result:
                return self._convert_rest_to_grpc_scoring(cached_result)
            
            result = await self.promptwizard_service.score_prompt(rest_request)
            await self.cache_service.set(cache_key, result)
            
            return self._convert_rest_to_grpc_scoring(result)
            
        except Exception as e:
            logger.error(f"gRPC ScorePrompt failed: {str(e)}")
            context.set_details(f"Scoring failed: {str(e)}")
            context.set_code(grpc.StatusCode.INTERNAL)
            return None
    
    def _convert_rest_to_grpc_scoring(self, rest_response: RestScoringResponse):
        """Convert REST scoring response to gRPC message."""
        return {
            'overall_score': rest_response.overall_score,
            'component_scores': rest_response.component_scores,
            'suggestions': rest_response.suggestions,
            'metrics': rest_response.metrics
        }
    
    async def ComparePrompts(self, request, context):
        """Handle comparison requests via gRPC."""
        try:
            logger.info("gRPC ComparePrompts called")
            
            rest_request = RestComparisonRequest(
                original_prompt=request.original_prompt,
                optimized_prompt=request.optimized_prompt,
                task=request.task if request.task else None,
                target_model=request.target_model if request.target_model else None
            )
            
            result = await self.promptwizard_service.compare_prompts(rest_request)
            
            return {
                'improvement_score': result.improvement_score,
                'improvements': result.improvements,
                'potential_issues': result.potential_issues,
                'metrics': result.metrics
            }
            
        except Exception as e:
            logger.error(f"gRPC ComparePrompts failed: {str(e)}")
            context.set_details(f"Comparison failed: {str(e)}")
            context.set_code(grpc.StatusCode.INTERNAL)
            return None
    
    async def GetJobStatus(self, request, context):
        """Get job status via gRPC."""
        try:
            job = await self.job_manager.get_job(request.job_id)
            if not job:
                context.set_details("Job not found")
                context.set_code(grpc.StatusCode.NOT_FOUND)
                return None
            
            return {
                'job_id': job.job_id,
                'status': job.status,
                'progress_percentage': job.progress_percentage,
                'current_step': job.current_step,
                'result': self._convert_rest_to_grpc_optimization(job.result) if job.result else None,
                'error_message': job.error_message or ""
            }
            
        except Exception as e:
            logger.error(f"gRPC GetJobStatus failed: {str(e)}")
            context.set_details(f"Failed to get job status: {str(e)}")
            context.set_code(grpc.StatusCode.INTERNAL)
            return None
    
    async def CancelJob(self, request, context):
        """Cancel job via gRPC."""
        try:
            success = await self.job_manager.cancel_job(request.job_id)
            return {
                'cancelled': success,
                'message': "Job cancelled successfully" if success else "Failed to cancel job"
            }
            
        except Exception as e:
            logger.error(f"gRPC CancelJob failed: {str(e)}")
            context.set_details(f"Failed to cancel job: {str(e)}")
            context.set_code(grpc.StatusCode.INTERNAL)
            return None
    
    async def HealthCheck(self, request, context):
        """Health check via gRPC."""
        try:
            promptwizard_healthy = await self.promptwizard_service.health_check()
            cache_healthy = await self.cache_service.health_check()
            job_manager_healthy = await self.job_manager.health_check()
            
            overall_healthy = all([promptwizard_healthy, cache_healthy, job_manager_healthy])
            
            return {
                'healthy': overall_healthy,
                'version': "1.0.0",
                'services': {
                    'promptwizard': promptwizard_healthy,
                    'cache': cache_healthy,
                    'job_manager': job_manager_healthy,
                },
                'error_message': ""
            }
            
        except Exception as e:
            logger.error(f"gRPC HealthCheck failed: {str(e)}")
            return {
                'healthy': False,
                'version': "1.0.0",
                'services': {},
                'error_message': str(e)
            }
    
    async def StreamOptimization(self, request, context) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream optimization updates via gRPC."""
        try:
            logger.info(f"gRPC StreamOptimization called for task: {request.task}")
            
            # Convert to REST model and create job
            rest_request = self._convert_grpc_to_rest_optimization(request)
            job = await self.job_manager.create_job(rest_request)
            
            # Yield initial status
            yield {
                'job_id': job.job_id,
                'progress_percentage': 0,
                'current_step': 'Starting optimization',
                'status': 'processing',
                'partial_result': None
            }
            
            # Start optimization in background
            optimization_task = asyncio.create_task(
                self._run_streaming_optimization(job.job_id, rest_request)
            )
            
            # Stream progress updates
            last_progress = 0
            while not optimization_task.done():
                # Get current job status
                current_job = await self.job_manager.get_job(job.job_id)
                if current_job and current_job.progress_percentage > last_progress:
                    yield {
                        'job_id': job.job_id,
                        'progress_percentage': current_job.progress_percentage,
                        'current_step': current_job.current_step,
                        'status': current_job.status,
                        'partial_result': None
                    }
                    last_progress = current_job.progress_percentage
                
                # Wait before next update
                await asyncio.sleep(1)
            
            # Send final result
            final_job = await self.job_manager.get_job(job.job_id)
            if final_job and final_job.result:
                yield {
                    'job_id': job.job_id,
                    'progress_percentage': 100,
                    'current_step': 'Completed',
                    'status': 'completed',
                    'partial_result': self._convert_rest_to_grpc_optimization(final_job.result)
                }
            
        except Exception as e:
            logger.error(f"gRPC StreamOptimization failed: {str(e)}")
            yield {
                'job_id': '',
                'progress_percentage': 0,
                'current_step': f'Error: {str(e)}',
                'status': 'failed',
                'partial_result': None
            }
    
    async def _run_streaming_optimization(self, job_id: str, request: RestOptimizationRequest):
        """Run optimization with progress updates."""
        try:
            await self.job_manager.update_job_progress(job_id, 10, "Initializing optimization")
            
            result = await self.promptwizard_service.optimize_prompt(request)
            
            await self.job_manager.complete_job(job_id, result)
            logger.info(f"Streaming optimization completed for job: {job_id}")
            
        except Exception as e:
            logger.error(f"Streaming optimization failed for job {job_id}: {str(e)}")
            await self.job_manager.fail_job(job_id, str(e))


async def serve_grpc(port: int = 50051):
    """Start the gRPC server."""
    server = aio.server(futures.ThreadPoolExecutor(max_workers=10))
    
    # Create servicer instance
    servicer = PromptOptimizationServicer()
    await servicer.initialize()
    
    # Add servicer to server (would use generated add_servicer_to_server function)
    # optimization_pb2_grpc.add_PromptOptimizationServiceServicer_to_server(servicer, server)
    
    # For now, we'll create a mock listener
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Starting gRPC server on {listen_addr}")
    await server.start()
    
    try:
        await server.wait_for_termination()
    finally:
        await servicer.cleanup()
        await server.stop(5)


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 50051
    asyncio.run(serve_grpc(port))