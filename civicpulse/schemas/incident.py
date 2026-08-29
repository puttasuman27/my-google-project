from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from pydantic import BaseModel, Field
from typing import Optional, List

class SpatialMatchRequest(BaseModel):
    category: str
    latitude: float
    longitude: float
    radius_meters: float = Field(default=50.0, description="Deduplication search radius")

class SpatialMatchResult(BaseModel):
    is_duplicate: bool
    matched_incident_id: Optional[str] = None
    distance_meters: Optional[float] = None
    confidence_score: float = Field(default=0.0)

class IncidentRecord(BaseModel):
    incident_id: str
    category: str
    severity_score: float
    priority_score: float
    duplicate_count: int = 1
    assigned_ward: str
    status: str = "OPEN"
    sla_deadline: str

class IncidentMatchResult(BaseModel):
    """Schema representing the deduplication evaluation result for a report."""

    is_duplicate: bool = Field(
        description="True if the report matches an existing active incident within spatial and category bounds."
    )
    matched_incident_id: Optional[str] = Field(
        default=None,
        description="The ID of the canonical matched incident, or None if a new incident should be created.",
    )
    confidence: float = Field(
        description="Confidence score between 0.0 and 1.0 for the deduplication determination."
    )
    explanation: str = Field(
        description="Detailed rationale for merging into an existing incident or creating a new record."
    )
    distance_meters: Optional[float] = Field(
        default=None,
        description="Calculated spatial distance in meters to the matched incident location.",
    )


class IncidentRecord(BaseModel):
    """Schema representing the canonical municipal incident stored in Firestore/BigQuery."""

    incident_id: str = Field(
        description="Unique canonical identifier for the consolidated civic incident"
    )
    category: str = Field(
        description="Category of the civic problem ('Pothole', 'Streetlight', 'Drainage')"
    )
    latitude: float = Field(
        description="Geographic latitude coordinate of the incident anchor point"
    )
    longitude: float = Field(
        description="Geographic longitude coordinate of the incident anchor point"
    )
    severity_score: float = Field(
        default=5.0,
        description="Aggregated severity score (1.0 - 10.0) derived from citizen report evidence",
    )
    priority_score: float = Field(
        default=0.0,
        description="Calculated Civic Pain / Priority Score for municipal assignment",
    )
    duplicate_count: int = Field(
        default=1,
        description="Total count of consolidated citizen reports associated with this incident",
    )
    assigned_ward: str = Field(
        default="Unassigned", description="Municipal ward or department identifier"
    )
    status: str = Field(
        default="OPEN",
        description="Lifecycle status: 'OPEN', 'ASSIGNED', 'ESCALATED', 'RESOLVED_PENDING', 'CLOSED'",
    )
    sla_deadline: Optional[datetime] = Field(
        default=None, description="Enforced SLA resolution target timestamp"
    )
    created_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow, description="Initial report creation timestamp"
    )
    updated_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow, description="Most recent consolidation or status update"
    )