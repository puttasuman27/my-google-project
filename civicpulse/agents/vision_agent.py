import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

class VisionAnalysisResult(BaseModel):
    is_valid_civic_issue: bool = Field(
        description="True ONLY if the photo depicts an authentic outdoor municipal infrastructure failure (pothole, broken streetlight, open/blocked drain, asphalt crack, garbage dump). MUST be False if it is a document, text screenshot, selfie, indoor photo, animal, meme, food, or non-civic object."
    )
    rejection_reason: str = Field(
        default="",
        description="Detailed explanation if is_valid_civic_issue is False."
    )
    category: str = Field(
        default="POTHOLE",
        description="POTHOLE, STREETLIGHT, DRAINAGE, GARBAGE, or ROAD_CRACK"
    )
    severity_level: str = Field(
        default="High",
        description="Low, Medium, High, or Critical"
    )
    severity_score: float = Field(
        default=0.85,
        description="Severity score between 0.0 and 1.0"
    )
    hazard_type: str = Field(
        default="Infrastructure defect",
        description="Short description of the defect"
    )
    estimated_dimensions_m: str = Field(
        default="0.5m x 0.5m",
        description="Estimated dimensions in meters"
    )
    confidence_score: float = Field(
        default=0.95,
        description="Confidence between 0.0 and 1.0"
    )

class VisionAgent:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def analyze_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> VisionAnalysisResult:
        if not self.client or len(image_bytes) == 0:
            return VisionAnalysisResult(
                is_valid_civic_issue=False,
                rejection_reason="No image provided or Gemini API key unconfigured.",
                category="OTHER",
                severity_level="Low",
                severity_score=0.1,
                hazard_type="Unverified image",
                estimated_dimensions_m="N/A",
                confidence_score=0.0
            )

        prompt = (
            "You are a strict municipal civic inspector AI. "
            "Examine this image:\n"
            "1. 'is_valid_civic_issue': MUST be False if this is a document, piece of paper, invoice, screenshot, selfie, indoor room, pet, meme, food, or general photo with NO outdoor municipal infrastructure defect. "
            "Set to True ONLY if you clearly see outdoor municipal damage (road pothole, cracked pavement, broken streetlight pole, flooded drain/culvert, open garbage pile).\n"
            "2. If False, provide a clear 'rejection_reason'.\n"
            "3. If True, extract category (POTHOLE, STREETLIGHT, DRAINAGE, GARBAGE, ROAD_CRACK), severity_level (Low, Medium, High, Critical), severity_score (0.0 to 1.0), hazard_type, and estimated_dimensions_m."
        )

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VisionAnalysisResult,
                temperature=0.0
            )
        )
        data = json.loads(response.text)
        return VisionAnalysisResult(**data)

    def analyze(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> VisionAnalysisResult:
        return self.analyze_image(image_bytes, mime_type)

__all__ = ["VisionAgent", "VisionAnalysisResult"]