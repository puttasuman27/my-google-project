from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class VisionAnalysisResult(BaseModel):
    is_valid_civic_issue: bool
    category: str
    severity_level: str
    severity_score: float
    hazard_type: str
    estimated_dimensions_m: Optional[str] = "N/A"
    confidence_score: float
    rejection_reason: Optional[str] = None


class IncidentCluster(BaseModel):
    canonical_incident_id: str
    is_duplicate: bool
    duplicate_count: int
    updated_priority_score: float
    explanation: str


class OperationsRouting(BaseModel):
    assigned_department: str
    assigned_ward: str
    dispatch_priority: str
    sla_hours: int
    sla_deadline: str
    recommended_crew_size: int
    escalation_tier: str


class ResolutionVerdict(BaseModel):
    is_resolved: bool
    confidence_score: float
    explanation: str
    action_taken: str
    quality_verdict: str