import os
from google import genai
from google.genai import types
from schemas.vision_schema import VisionAnalysisResult

VISION_SYSTEM_INSTRUCTION = """
You are the CivicPulse Vision AI Agent for municipal infrastructure assessment.
Your role:
1. Verify if the uploaded image shows a legitimate civic infrastructure issue (Potholes, Streetlights, Drainage/Water leakage, Damaged Roads/Footpaths).
2. Filter out non-civic photos, indoor images, memes, screenshots, or stock photos by setting is_valid_civic_issue = False.
3. Compute an objective severity_score (0.0 to 1.0) based on depth, lane obstruction, and hazard to vehicles/pedestrians.
4. Estimate real-world physical dimensions.
5. If the issue represents an extreme hazard (e.g., collapsed manhole, exposed live wire, road collapse), set requires_immediate_dispatch = True.

Always return structured JSON adhering strictly to the provided schema.
"""

class VisionAgent:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is missing.")
        self.client = genai.Client(api_key=api_key)

    def analyze(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> VisionAnalysisResult:
        response = self.client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                "Analyze this municipal infrastructure report photo and extract structured civic telemetry."
            ],
            config=types.GenerateContentConfig(
                system_instruction=VISION_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=VisionAnalysisResult,
                temperature=0.1,
            )
        )
        return VisionAnalysisResult.model_validate_json(response.text)