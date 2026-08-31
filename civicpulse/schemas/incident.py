from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class IngestReportRequest(BaseModel):
    latitude: float
    longitude: float
    citizen_notes: Optional[str] = None
    road_class: Optional[str] = Field("SECONDARY", description="PRIMARY_ARTERIAL | SECONDARY | RESIDENTIAL")

class CanonicalIncident(BaseModel):
    incident_id: str
    category: str
    status: str
    priority_score: float
    severity_score: float
    report_count: int
    road_class: str
    hazard_type: str
    latitude: float
    longitude: float
    primary_image_url: Optional[str] = None
    assigned_ward: Optional[str] = None
    assigned_department: Optional[str] = None
    sla_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class DeduplicationResult(BaseModel):
    is_duplicate: bool
    canonical_incident_id: str
    matched_distance_meters: Optional[float] = None
    action_taken: str  # "CREATED_NEW" | "ATTACHED_TO_EXISTING"
    updated_priority_score: float
    total_reports: int