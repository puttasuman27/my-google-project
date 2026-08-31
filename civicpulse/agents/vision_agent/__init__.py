import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

class VisionAnalysisResult(BaseModel):
    category: str = Field(description="Incident type: Pothole, Drainage, Streetlight, Traffic Light, Garbage, or Other")
    severity_score: float = Field(description="Severity between 0.0 (minor) and 1.0 (critical)")
    hazard_type: str = Field(description="Specific hazard description")
    estimated_dimensions_m: str = Field(description="Estimated size/depth, e.g., '0.5m x 0.3m x 0.1m'")
    confidence_score: float = Field(description="Model confidence between 0.0 and 1.0")

class VisionAgent:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def analyze_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
        if not self.client:
            # Fallback mock response if no API key is set during testing
            return {
                "category": "Pothole",
                "severity_score": 0.85,
                "hazard_type": "Deep asphalt pothole causing traffic slowdown",
                "estimated_dimensions_m": "0.6m x 0.4m x 0.12m",
                "confidence_score": 0.94
            }

        prompt = (
            "Analyze this municipal infrastructure report image. "
            "Identify the category, assess hazard severity (0.0 to 1.0), "
            "estimate physical dimensions, and determine confidence score."
        )

        response = self.client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VisionAnalysisResult,
                temperature=0.1
            )
        )
        return json.loads(response.text)

__all__ = ["VisionAgent", "VisionAnalysisResult"]