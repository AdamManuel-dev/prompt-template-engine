"""
@fileoverview Main FastAPI application for PromptWizard Python service
@lastmodified 2025-08-26T12:20:00Z

Features: REST API server with optimization, scoring, and health check endpoints
Main APIs: /api/v1/optimize, /api/v1/score, /api/v1/compare, /api/v1/health
Constraints: Requires PromptWizard library installation from Microsoft GitHub
Patterns: FastAPI async patterns, dependency injection, middleware
"""

from contextlib import asynccontextmanager
from typing import Dict, Any
import structlog
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.models import (
    OptimizationRequest,
    OptimizationResponse,
    ScoringRequest,
    ScoringResponse,
    ComparisonRequest,
    ComparisonResponse,
    HealthResponse,
    JobStatusResponse,
)
from app.services.promptwizard_service import PromptWizardService
from app.services.job_manager import JobManager
from app.services.cache_service import CacheService
from app.middleware.auth import AuthMiddleware
from app.middleware.rate_limiter import RateLimiterMiddleware
from app.utils.logging_config import configure_logging

# Configure structured logging
configure_logging()
logger = structlog.get_logger(__name__)

# Initialize services
job_manager = JobManager()
cache_service = CacheService()
promptwizard_service = PromptWizardService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown events."""
    logger.info("Starting PromptWizard service...")
    
    # Initialize services
    await cache_service.initialize()
    await job_manager.initialize()
    await promptwizard_service.initialize()
    
    logger.info("PromptWizard service started successfully")
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down PromptWizard service...")
    await cache_service.cleanup()
    await job_manager.cleanup()
    await promptwizard_service.cleanup()


# Create FastAPI application
app = FastAPI(
    title="PromptWizard Integration Service",
    description="AI-powered prompt optimization service using Microsoft PromptWizard",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimiterMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error("Unhandled exception", exc_info=exc, request=request.url)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal server error occurred",
            }
        }
    )


# Health check endpoint
@app.get("/api/v1/health", response_model=HealthResponse)
async def health_check():
    """Check service health and return status information."""
    try:
        # Check PromptWizard service
        promptwizard_healthy = await promptwizard_service.health_check()
        
        # Check cache service
        cache_healthy = await cache_service.health_check()
        
        # Check job manager
        job_manager_healthy = await job_manager.health_check()
        
        overall_healthy = all([promptwizard_healthy, cache_healthy, job_manager_healthy])
        
        return HealthResponse(
            healthy=overall_healthy,
            version="1.0.0",
            services={
                "promptwizard": promptwizard_healthy,
                "cache": cache_healthy,
                "job_manager": job_manager_healthy,
            }
        )
    except Exception as e:
        logger.error("Health check failed", exc_info=e)
        return HealthResponse(
            healthy=False,
            version="1.0.0",
            error=str(e)
        )


# Main optimization endpoint
@app.post("/api/v1/optimize", response_model=OptimizationResponse)
async def optimize_prompt(
    request: OptimizationRequest,
    background_tasks: BackgroundTasks,
    _auth: Dict[str, Any] = Depends(AuthMiddleware.verify_token)
):
    """
    Optimize a prompt using PromptWizard.
    
    This endpoint accepts a prompt optimization request and returns either:
    - Immediate results for fast optimizations
    - A job ID for async processing of complex optimizations
    """
    try:
        logger.info("Received optimization request", task=request.task, model=request.target_model)
        
        # Check cache first
        cache_key = cache_service.generate_cache_key(request)
        cached_result = await cache_service.get(cache_key)
        
        if cached_result:
            logger.info("Returning cached optimization result")
            return OptimizationResponse.from_cached_result(cached_result)
        
        # Determine if this should be processed async
        should_process_async = (
            request.mutate_refine_iterations > 3 or
            request.few_shot_count > 10 or
            len(request.prompt) > 2000
        )
        
        if should_process_async:
            # Create background job
            job = await job_manager.create_job(request)
            background_tasks.add_task(
                _process_optimization_async,
                job.job_id,
                request,
                cache_key
            )
            
            return OptimizationResponse(
                job_id=job.job_id,
                status="processing",
                original_prompt=request.prompt,
                optimized_prompt="",  # Will be filled when complete
                metrics={
                    "accuracy_improvement": 0,
                    "token_reduction": 0,
                    "cost_reduction": 0,
                    "processing_time": 0,
                    "api_calls_used": 0,
                }
            )
        else:
            # Process immediately
            result = await promptwizard_service.optimize_prompt(request)
            
            # Cache result
            await cache_service.set(cache_key, result)
            
            return result
            
    except Exception as e:
        logger.error("Optimization request failed", exc_info=e)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "OPTIMIZATION_FAILED",
                "message": f"Failed to process optimization: {str(e)}"
            }
        )


async def _process_optimization_async(job_id: str, request: OptimizationRequest, cache_key: str):
    """Process optimization in the background."""
    try:
        await job_manager.update_job_progress(job_id, 10, "Starting optimization")
        
        result = await promptwizard_service.optimize_prompt(request)
        
        await job_manager.complete_job(job_id, result)
        await cache_service.set(cache_key, result)
        
        logger.info("Background optimization completed", job_id=job_id)
        
    except Exception as e:
        logger.error("Background optimization failed", job_id=job_id, exc_info=e)
        await job_manager.fail_job(job_id, str(e))


# Scoring endpoint
@app.post("/api/v1/score", response_model=ScoringResponse)
async def score_prompt(
    request: ScoringRequest,
    _auth: Dict[str, Any] = Depends(AuthMiddleware.verify_token)
):
    """Score a prompt for quality metrics."""
    try:
        logger.info("Received scoring request")
        
        # Check cache
        cache_key = f"score:{hash(request.prompt + (request.task or ''))}"
        cached_result = await cache_service.get(cache_key)
        
        if cached_result:
            return cached_result
        
        result = await promptwizard_service.score_prompt(request)
        await cache_service.set(cache_key, result)
        
        return result
        
    except Exception as e:
        logger.error("Scoring request failed", exc_info=e)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "SCORING_FAILED",
                "message": f"Failed to score prompt: {str(e)}"
            }
        )


# Comparison endpoint
@app.post("/api/v1/compare", response_model=ComparisonResponse)
async def compare_prompts(
    request: ComparisonRequest,
    _auth: Dict[str, Any] = Depends(AuthMiddleware.verify_token)
):
    """Compare two prompts and provide improvement analysis."""
    try:
        logger.info("Received comparison request")
        
        result = await promptwizard_service.compare_prompts(request)
        return result
        
    except Exception as e:
        logger.error("Comparison request failed", exc_info=e)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "COMPARISON_FAILED",
                "message": f"Failed to compare prompts: {str(e)}"
            }
        )


# Job status endpoint
@app.get("/api/v1/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    _auth: Dict[str, Any] = Depends(AuthMiddleware.verify_token)
):
    """Get the status of an optimization job."""
    try:
        job = await job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return JobStatusResponse.from_job(job)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get job status", job_id=job_id, exc_info=e)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "STATUS_ERROR",
                "message": f"Failed to get job status: {str(e)}"
            }
        )


# Cancel job endpoint
@app.post("/api/v1/cancel/{job_id}")
async def cancel_job(
    job_id: str,
    _auth: Dict[str, Any] = Depends(AuthMiddleware.verify_token)
):
    """Cancel an optimization job."""
    try:
        success = await job_manager.cancel_job(job_id)
        return {"cancelled": success}
        
    except Exception as e:
        logger.error("Failed to cancel job", job_id=job_id, exc_info=e)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "CANCEL_ERROR",
                "message": f"Failed to cancel job: {str(e)}"
            }
        )


# Metrics endpoint
@app.get("/api/v1/metrics")
async def get_metrics():
    """Get service metrics for monitoring."""
    try:
        metrics = {
            "jobs": await job_manager.get_metrics(),
            "cache": await cache_service.get_metrics(),
            "service": await promptwizard_service.get_metrics(),
        }
        return metrics
        
    except Exception as e:
        logger.error("Failed to get metrics", exc_info=e)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "METRICS_ERROR",
                "message": f"Failed to get metrics: {str(e)}"
            }
        )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_config=None,  # Use our structured logging
    )