"""
@fileoverview Pydantic models for PromptWizard service API
@lastmodified 2025-08-26T12:30:00Z

Features: Request/response models with validation
Main APIs: OptimizationRequest, OptimizationResponse, ScoringRequest, etc.
Constraints: Pydantic v2 validation, type safety
Patterns: Data transfer objects, validation models
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Literal
from pydantic import BaseModel, Field, validator


class OptimizationRequest(BaseModel):
    """Request model for prompt optimization."""
    
    prompt: str = Field(..., min_length=1, max_length=10000)
    task: str = Field(..., min_length=1, max_length=500)
    target_model: Literal["gpt-4", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet", "gemini-pro"] = "gpt-4"
    mutate_refine_iterations: int = Field(default=3, ge=1, le=10)
    few_shot_count: int = Field(default=5, ge=0, le=20)
    generate_reasoning: bool = True
    custom_params: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class OptimizationMetrics(BaseModel):
    """Metrics for optimization results."""
    
    accuracy_improvement: float = Field(ge=0, le=100)
    token_reduction: float = Field(ge=-100, le=100)  # Can be negative if tokens increased
    cost_reduction: float = Field(ge=0)
    processing_time: float = Field(ge=0)
    api_calls_used: int = Field(ge=0)


class OptimizationExample(BaseModel):
    """Generated few-shot example."""
    
    input: str
    output: str
    quality: float = Field(ge=0, le=1)


class OptimizationError(BaseModel):
    """Error information for failed optimizations."""
    
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class OptimizationResponse(BaseModel):
    """Response model for prompt optimization."""
    
    job_id: str
    original_prompt: str
    optimized_prompt: str
    status: Literal["pending", "processing", "completed", "failed"]
    metrics: OptimizationMetrics
    examples: List[OptimizationExample] = Field(default_factory=list)
    reasoning: List[str] = Field(default_factory=list)
    error: Optional[OptimizationError] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    @classmethod
    def from_cached_result(cls, cached: Dict[str, Any]) -> "OptimizationResponse":
        """Create response from cached result."""
        return cls(**cached)


class ScoringRequest(BaseModel):
    """Request model for prompt scoring."""
    
    prompt: str = Field(..., min_length=1, max_length=10000)
    task: Optional[str] = Field(None, max_length=500)


class QualityMetrics(BaseModel):
    """Quality scoring metrics."""
    
    clarity: float = Field(ge=0, le=100)
    task_alignment: float = Field(ge=0, le=100)
    token_efficiency: float = Field(ge=0, le=100)
    example_quality: Optional[float] = Field(None, ge=0, le=100)


class ScoringResponse(BaseModel):
    """Response model for prompt scoring."""
    
    overall: float = Field(ge=0, le=100)
    metrics: QualityMetrics
    suggestions: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)


class ComparisonRequest(BaseModel):
    """Request model for prompt comparison."""
    
    original: str = Field(..., min_length=1, max_length=10000)
    optimized: str = Field(..., min_length=1, max_length=10000)
    task: Optional[str] = Field(None, max_length=500)


class PromptMetrics(BaseModel):
    """Metrics for a single prompt in comparison."""
    
    prompt: str
    score: ScoringResponse
    estimated_tokens: int = Field(ge=0)
    estimated_cost: float = Field(ge=0)


class ComparisonImprovements(BaseModel):
    """Improvement metrics from comparison."""
    
    quality_improvement: float = Field(ge=-100, le=100)  # Can be negative
    token_reduction: float = Field(ge=-100, le=100)
    cost_savings: float = Field(ge=-100)  # Can be negative


class ComparisonAnalysis(BaseModel):
    """Analysis results from comparison."""
    
    strengths_gained: List[str] = Field(default_factory=list)
    potential_risks: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class ComparisonResponse(BaseModel):
    """Response model for prompt comparison."""
    
    comparison_id: str
    original: PromptMetrics
    optimized: PromptMetrics
    improvements: ComparisonImprovements
    analysis: ComparisonAnalysis


class JobStatusResponse(BaseModel):
    """Response model for job status."""
    
    job_id: str
    status: Literal["queued", "processing", "completed", "failed", "cancelled"]
    progress: int = Field(ge=0, le=100)
    current_step: str
    estimated_completion: Optional[datetime] = None
    result: Optional[OptimizationResponse] = None
    error: Optional[OptimizationError] = None
    created_at: datetime
    updated_at: datetime
    
    @classmethod
    def from_job(cls, job: Dict[str, Any]) -> "JobStatusResponse":
        """Create response from job data."""
        return cls(**job)


class HealthResponse(BaseModel):
    """Response model for health check."""
    
    healthy: bool
    version: str
    services: Dict[str, bool] = Field(default_factory=dict)
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ServiceError(BaseModel):
    """Standard error response model."""
    
    success: bool = False
    error: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ServiceResponse(BaseModel):
    """Generic service response wrapper."""
    
    success: bool = True
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)