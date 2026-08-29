from typing import Optional
from pydantic import BaseModel, Field

class VisionAnalysisResult(BaseModel):
    is_valid_civic_issue: bool = Field(
        description="True if the photo contains real outdoor municipal/civic infrastructure flaws; False if it is a selfie, indoor photo, meme, pet, or irrelevant item."
    )
    rejection_reason: Optional[str] = Field(
        default=None, 
        description="Explanation if the image was flagged as spam or invalid civic evidence."
    )
    category: str = Field(description="One of: 'Pothole', 'Streetlight', 'Drainage', 'Garbage', 'Invalid'")
    confidence_score: float = Field(description="Confidence score between 0.0 and 1.0")
    severity_level: str = Field(description="Must be: 'Low', 'Medium', 'High', 'Critical', or 'None'")
    description: str = Field(description="Short summary of visible damage or defect")
    safety_hazard: bool = Field(description="True if immediate risk to public safety")