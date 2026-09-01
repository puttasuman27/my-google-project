import os
import json
import time
import logging
from typing import Optional, List
from pydantic import BaseModel
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


class VisionAnalysisResult(BaseModel):
    is_valid_civic_issue: bool
    category: str
    severity_level: str
    severity_score: float
    hazard_type: str
    estimated_dimensions_m: Optional[str] = "N/A"
    confidence_score: float
    rejection_reason: Optional[str] = None


class VisionAgent:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        # Target the recommended active multimodal models
        self.candidate_models: List[str] = [
            os.getenv("GEMINI_MODEL", "gemini-3.6-flash"),
            "gemini-3.6-flash",
            "gemini-3.1-pro-preview",
            "gemini-flash-latest",
        ]
        # Deduplicate while preserving order
        self.candidate_models = list(dict.fromkeys(self.candidate_models))

        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            logger.warning("GEMINI_API_KEY not found in environment.")
            self.client = None

    def analyze_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> VisionAnalysisResult:
        # 1. Reject empty image uploads immediately
        if not image_bytes or len(image_bytes) < 100:
            return VisionAnalysisResult(
                is_valid_civic_issue=False,
                category="UNKNOWN",
                severity_level="Low",
                severity_score=0.0,
                hazard_type="None",
                confidence_score=0.0,
                rejection_reason="No image uploaded or the image file is corrupted."
            )

        if not self.client:
            return VisionAnalysisResult(
                is_valid_civic_issue=False,
                category="UNKNOWN",
                severity_level="Low",
                severity_score=0.0,
                hazard_type="None",
                confidence_score=0.0,
                rejection_reason="Gemini API Client is not configured. Please set GEMINI_API_KEY in .env."
            )

        # 2. Strict inspection prompt
        prompt = """
        You are an expert Municipal Infrastructure Safety Inspector AI.
        Carefully examine this uploaded image and determine whether it shows a genuine OUTDOOR PUBLIC MUNICIPAL INFRASTRUCTURE DEFECT or HAZARD.

        CRITICAL REJECTION RULES:
        Set "is_valid_civic_issue": false if the image is:
        - A document, receipt, certificate, ID card, paper, book, invoice, or resume.
        - A screenshot of computer code, text, phone screen, or UI.
        - A selfie, portrait, group photo, human face, clothing, or footwear.
        - Indoor furniture, rooms, electronics, appliances, food, or drinks.
        - An animal, plant/garden photo (without road/drainage blockage).
        - A random object, meme, cartoon, or drawing.

        VALID CIVIC ISSUES ONLY:
        - POTHOLE: road cracks, cavities, surface damage on streets/highways.
        - STREETLIGHT: broken/fallen poles, non-functional streetlights, exposed road wiring.
        - DRAINAGE: open manholes, overflowing storm drains, blocked sewers, waterlogging.
        - GARBAGE: illegal street trash dumps, overflowing public dumpsters, debris.

        Return ONLY a JSON object with this exact structure:
        {
            "is_valid_civic_issue": true,
            "category": "POTHOLE",
            "severity_level": "Critical",
            "severity_score": 0.85,
            "hazard_type": "Deep Asphalt Cavity",
            "estimated_dimensions_m": "1.2m x 0.8m",
            "confidence_score": 0.95,
            "rejection_reason": null
        }
        """

        last_error = ""

        # 3. Model execution with backoff retry
        for model in self.candidate_models:
            # Skip TTS or non-vision models explicitly
            if any(term in model.lower() for term in ["tts", "audio", "embedding"]):
                continue

            for attempt in range(3):
                try:
                    logger.info(f"Running vision inspection with model: {model} (attempt {attempt + 1})")
                    response = self.client.models.generate_content(
                        model=model,
                        contents=[
                            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                            prompt
                        ],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.1
                        )
                    )

                    raw_text = response.text.strip()
                    # Strip markdown blocks if returned
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.startswith("```"):
                        raw_text = raw_text[3:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]

                    data = json.loads(raw_text.strip())
                    return VisionAnalysisResult(**data)

                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"Model {model} attempt {attempt + 1} failed: {last_error}")

                    # If 404 or unsupported model, skip to the next model immediately
                    if "404" in last_error or "NOT_FOUND" in last_error or "INVALID_ARGUMENT" in last_error:
                        break

                    # If 503 (high demand) or 429 (rate limit), wait with exponential backoff
                    time.sleep(1.2 * (attempt + 1))

        # Rejection fallback if all active API calls failed
        return VisionAnalysisResult(
            is_valid_civic_issue=False,
            category="UNKNOWN",
            severity_level="Low",
            severity_score=0.0,
            hazard_type="None",
            confidence_score=0.0,
            rejection_reason=f"Vision inspection unavailable at the moment. Please try again. ({last_error})"
        )