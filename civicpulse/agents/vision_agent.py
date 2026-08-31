import json
import os

from google import genai
from google.genai import types
from pydantic import BaseModel, Field


class VisionAnalysisResult(BaseModel):
    is_valid_civic_issue: bool = Field(description="Whether the image depicts an outdoor municipal issue")
    rejection_reason: str = Field(default="", description="Reason an image was rejected")
    category: str = Field(description="POTHOLE, STREETLIGHT, DRAINAGE, GARBAGE, ROAD_CRACK, or OTHER")
    severity_level: str = Field(description="Low, Medium, High, or Critical")
    severity_score: float = Field(description="Severity between 0.0 (minor) and 1.0 (critical)")
    hazard_type: str = Field(description="Specific hazard description")
    estimated_dimensions_m: str = Field(description="Estimated size/depth, e.g., '0.5m x 0.3m x 0.1m'")
    confidence_score: float = Field(description="Model confidence between 0.0 and 1.0")


class VisionAgent:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None

    def analyze_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> VisionAnalysisResult:
        if not self.client or not image_bytes:
            return VisionAnalysisResult(
                is_valid_civic_issue=False,
                rejection_reason="No image provided or Gemini API key unconfigured.",
                category="OTHER",
                severity_level="Low",
                severity_score=0.1,
                hazard_type="Unverified image",
                estimated_dimensions_m="N/A",
                confidence_score=0.0,
            )

        prompt = (
            "You are a strict municipal civic inspector AI. Analyze this image for an "
            "outdoor civic issue. Reject documents, screenshots, selfies, indoor photos, "
            "memes, and unrelated images. For valid issues, identify category, severity "
            "level, severity score, hazard type, estimated dimensions, and confidence."
        )
        response = self.client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VisionAnalysisResult,
                temperature=0.1,
            ),
        )
        return VisionAnalysisResult.model_validate_json(response.text)

    def analyze(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> VisionAnalysisResult:
        return self.analyze_image(image_bytes, mime_type)


__all__ = ["VisionAgent", "VisionAnalysisResult"]