from pydantic import BaseModel, Field
from typing import List, Optional

class ResolutionVerificationResult(BaseModel):
    verdict: str = Field(..., description="PASS | FAIL | INCONCLUSIVE")
    confidence_score: float = Field(..., description="Verification confidence from 0.0 to 1.0")
    is_repair_complete: bool = Field(..., description="True if structural repair is visible and complete")
    is_same_location: bool = Field(..., description="True if background cues confirm same physical location")
    identified_deficiencies: List[str] = Field(default_factory=list, description="List of issues like Substandard Patch, Mismatched Angle, Debris Leftover")
    reasoning: str = Field(..., description="Detailed explanation of the visual diff analysis")