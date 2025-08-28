"""
@fileoverview WebSocket server for real-time PromptWizard optimization updates
@lastmodified 2025-08-26T14:10:00Z

Features: Real-time optimization streaming, connection management, authentication
Main APIs: WebSocket /ws/optimize endpoint with streaming updates
Constraints: Requires FastAPI WebSocket support and asyncio
Patterns: WebSocket manager, pub-sub for updates, connection pooling
"""

import json
import asyncio
import logging
from typing import Dict, List, Set
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.websockets import WebSocketState

from app.services.promptwizard_service import PromptWizardService
from app.services.job_manager import JobManager
from app.services.cache_service import CacheService
from app.models import OptimizationRequest, OptimizationResponse
from app.middleware.auth import AuthMiddleware

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for real-time optimization updates."""
    
    def __init__(self):
        # Active connections: job_id -> set of websockets
        self.connections: Dict[str, Set[WebSocket]] = {}
        # Connection metadata
        self.connection_meta: Dict[WebSocket, Dict] = {}
        # Services
        self.promptwizard_service = PromptWizardService()
        self.job_manager = JobManager()
        self.cache_service = CacheService()
        
    async def initialize(self):
        """Initialize services."""
        await self.cache_service.initialize()
        await self.job_manager.initialize()
        await self.promptwizard_service.initialize()
        logger.info("WebSocket manager initialized")
    
    async def cleanup(self):
        """Cleanup services."""
        await self.cache_service.cleanup()
        await self.job_manager.cleanup()
        await self.promptwizard_service.cleanup()
        logger.info("WebSocket manager cleaned up")
    
    async def connect(self, websocket: WebSocket, job_id: str = None, user_id: str = None):
        """Accept new WebSocket connection."""
        await websocket.accept()
        
        # Store connection metadata
        self.connection_meta[websocket] = {
            'job_id': job_id,
            'user_id': user_id,
            'connected_at': datetime.utcnow(),
        }
        
        # Add to job-specific connections if job_id provided
        if job_id:
            if job_id not in self.connections:
                self.connections[job_id] = set()
            self.connections[job_id].add(websocket)
        
        logger.info(f"WebSocket connected for job: {job_id}, user: {user_id}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection."""
        if websocket in self.connection_meta:
            meta = self.connection_meta[websocket]
            job_id = meta.get('job_id')
            user_id = meta.get('user_id')
            
            # Remove from job connections
            if job_id and job_id in self.connections:
                self.connections[job_id].discard(websocket)
                if not self.connections[job_id]:
                    del self.connections[job_id]
            
            # Remove metadata
            del self.connection_meta[websocket]
            
            logger.info(f"WebSocket disconnected for job: {job_id}, user: {user_id}")
    
    async def send_message(self, websocket: WebSocket, message: Dict):
        """Send message to specific WebSocket."""
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {str(e)}")
            self.disconnect(websocket)
    
    async def broadcast_to_job(self, job_id: str, message: Dict):
        """Broadcast message to all connections for a specific job."""
        if job_id in self.connections:
            disconnected = set()
            
            for websocket in self.connections[job_id].copy():
                try:
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json(message)
                    else:
                        disconnected.add(websocket)
                except Exception as e:
                    logger.error(f"Failed to broadcast to job {job_id}: {str(e)}")
                    disconnected.add(websocket)
            
            # Clean up disconnected websockets
            for websocket in disconnected:
                self.disconnect(websocket)
    
    async def start_optimization_stream(self, websocket: WebSocket, request: OptimizationRequest):
        """Start streaming optimization with real-time updates."""
        try:
            # Validate request
            if not request.prompt or not request.task:
                await self.send_message(websocket, {
                    'type': 'error',
                    'message': 'Missing required fields: prompt and task'
                })
                return
            
            # Check cache first
            cache_key = self.cache_service.generate_cache_key(request)
            cached_result = await self.cache_service.get(cache_key)
            
            if cached_result:
                await self.send_message(websocket, {
                    'type': 'cached_result',
                    'data': {
                        'job_id': 'cached',
                        'status': 'completed',
                        'result': cached_result.dict()
                    }
                })
                return
            
            # Create optimization job
            job = await self.job_manager.create_job(request)
            job_id = job.job_id
            
            # Add websocket to job connections
            if job_id not in self.connections:
                self.connections[job_id] = set()
            self.connections[job_id].add(websocket)
            
            # Send job started message
            await self.send_message(websocket, {
                'type': 'job_started',
                'data': {
                    'job_id': job_id,
                    'status': 'processing',
                    'progress': 0,
                    'current_step': 'Initializing optimization'
                }
            })
            
            # Start optimization in background
            asyncio.create_task(self._run_optimization_with_updates(job_id, request, cache_key))
            
        except Exception as e:
            logger.error(f"Failed to start optimization stream: {str(e)}")
            await self.send_message(websocket, {
                'type': 'error',
                'message': f'Failed to start optimization: {str(e)}'
            })
    
    async def _run_optimization_with_updates(self, job_id: str, request: OptimizationRequest, cache_key: str):
        """Run optimization with periodic progress updates."""
        try:
            # Send progress updates
            progress_steps = [
                (10, "Analyzing prompt structure"),
                (25, "Generating optimization examples"),
                (50, "Running PromptWizard optimization"),
                (75, "Validating optimized prompt"),
                (90, "Finalizing results")
            ]
            
            for progress, step in progress_steps:
                await self.job_manager.update_job_progress(job_id, progress, step)
                await self.broadcast_to_job(job_id, {
                    'type': 'progress_update',
                    'data': {
                        'job_id': job_id,
                        'progress': progress,
                        'current_step': step,
                        'status': 'processing'
                    }
                })
                # Simulate processing time
                await asyncio.sleep(0.5)
            
            # Perform actual optimization
            result = await self.promptwizard_service.optimize_prompt(request)
            
            # Complete job
            await self.job_manager.complete_job(job_id, result)
            
            # Cache result
            await self.cache_service.set(cache_key, result)
            
            # Send completion message
            await self.broadcast_to_job(job_id, {
                'type': 'optimization_complete',
                'data': {
                    'job_id': job_id,
                    'status': 'completed',
                    'progress': 100,
                    'current_step': 'Optimization completed',
                    'result': result.dict() if hasattr(result, 'dict') else result
                }
            })
            
            logger.info(f"Optimization completed for job: {job_id}")
            
        except Exception as e:
            logger.error(f"Optimization failed for job {job_id}: {str(e)}")
            
            # Update job status
            await self.job_manager.fail_job(job_id, str(e))
            
            # Send error message
            await self.broadcast_to_job(job_id, {
                'type': 'optimization_failed',
                'data': {
                    'job_id': job_id,
                    'status': 'failed',
                    'error': str(e)
                }
            })
    
    async def handle_message(self, websocket: WebSocket, message: Dict):
        """Handle incoming WebSocket messages."""
        try:
            message_type = message.get('type')
            
            if message_type == 'optimize':
                # Start new optimization
                request_data = message.get('data', {})
                request = OptimizationRequest(**request_data)
                await self.start_optimization_stream(websocket, request)
            
            elif message_type == 'subscribe_job':
                # Subscribe to existing job updates
                job_id = message.get('job_id')
                if job_id:
                    if job_id not in self.connections:
                        self.connections[job_id] = set()
                    self.connections[job_id].add(websocket)
                    
                    # Send current job status
                    job = await self.job_manager.get_job(job_id)
                    if job:
                        await self.send_message(websocket, {
                            'type': 'job_status',
                            'data': {
                                'job_id': job_id,
                                'status': job.status,
                                'progress': job.progress_percentage,
                                'current_step': job.current_step,
                                'result': job.result.dict() if job.result else None
                            }
                        })
            
            elif message_type == 'cancel_job':
                # Cancel optimization job
                job_id = message.get('job_id')
                if job_id:
                    success = await self.job_manager.cancel_job(job_id)
                    await self.send_message(websocket, {
                        'type': 'job_cancelled',
                        'data': {
                            'job_id': job_id,
                            'cancelled': success
                        }
                    })
            
            elif message_type == 'ping':
                # Respond to ping
                await self.send_message(websocket, {
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                })
            
            else:
                await self.send_message(websocket, {
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                })
                
        except Exception as e:
            logger.error(f"Failed to handle WebSocket message: {str(e)}")
            await self.send_message(websocket, {
                'type': 'error',
                'message': f'Failed to process message: {str(e)}'
            })
    
    def get_connection_stats(self) -> Dict:
        """Get WebSocket connection statistics."""
        total_connections = len(self.connection_meta)
        active_jobs = len(self.connections)
        
        return {
            'total_connections': total_connections,
            'active_jobs': active_jobs,
            'connections_per_job': {
                job_id: len(connections) 
                for job_id, connections in self.connections.items()
            }
        }


# Global WebSocket manager instance
websocket_manager = WebSocketManager()


@asynccontextmanager
async def websocket_lifespan():
    """Context manager for WebSocket service lifecycle."""
    await websocket_manager.initialize()
    try:
        yield websocket_manager
    finally:
        await websocket_manager.cleanup()


async def websocket_endpoint(websocket: WebSocket, job_id: str = None, token: str = None):
    """Main WebSocket endpoint for optimization streaming."""
    try:
        # Authenticate if token provided
        user_id = None
        if token:
            try:
                auth_result = await AuthMiddleware.verify_token(token)
                user_id = auth_result.get('user_id')
            except Exception as e:
                await websocket.close(code=4001, reason=f"Authentication failed: {str(e)}")
                return
        
        # Connect WebSocket
        await websocket_manager.connect(websocket, job_id, user_id)
        
        try:
            while True:
                # Wait for message
                message = await websocket.receive_json()
                await websocket_manager.handle_message(websocket, message)
                
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected normally")
        except Exception as e:
            logger.error(f"WebSocket error: {str(e)}")
            await websocket.send_json({
                'type': 'error',
                'message': f'Connection error: {str(e)}'
            })
        
    except Exception as e:
        logger.error(f"WebSocket endpoint error: {str(e)}")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=4000, reason=str(e))
    
    finally:
        websocket_manager.disconnect(websocket)


# FastAPI route registration (to be added to main.py)
def register_websocket_routes(app):
    """Register WebSocket routes with FastAPI app."""
    
    @app.websocket("/ws/optimize")
    async def optimize_websocket(websocket: WebSocket, job_id: str = None, token: str = None):
        await websocket_endpoint(websocket, job_id, token)
    
    @app.get("/ws/stats")
    async def websocket_stats():
        """Get WebSocket connection statistics."""
        return websocket_manager.get_connection_stats()


if __name__ == "__main__":
    # Test WebSocket server
    import uvicorn
    from fastapi import FastAPI
    
    app = FastAPI()
    register_websocket_routes(app)
    
    uvicorn.run(app, host="0.0.0.0", port=8001)