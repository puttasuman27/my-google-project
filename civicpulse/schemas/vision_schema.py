from pydantic import BaseModel, Field
from typing import Optional

class Dimensions(BaseModel):
    estimated_width_m: float = Field(..., description="Estimated width/span of defect in meters")
    estimated_depth_m: Optional[float] = Field(None, description="Estimated depth in meters if pothole/trench")

class VisionAnalysisResult(BaseModel):
    is_valid_civic_issue: bool = Field(..., description="False if spam, meme, unrelated photo, or interior shot")
    category: str = Field(..., description="POTHOLE | STREETLIGHT | DRAINAGE_LEAKAGE | ROAD_CRACK | OTHER")
    confidence_score: float = Field(..., description="Confidence level between 0.0 and 1.0")
    severity_score: float = Field(..., description="Calculated severity from 0.0 (minor) to 1.0 (critical safety hazard)")
    hazard_type: str = Field(..., description="TRAFFIC_DISRUPTION | PEDESTRIAN_HAZARD | FLOODING_RISK | ELECTRICAL_HAZARD | MINOR_NUISANCE")
    estimated_dimensions: Dimensions
    defect_description: str = Field(..., description="Concise technical summary of the observed defect")
    requires_immediate_dispatch: bool = Field(..., description="True if acute danger to life/traffic")
