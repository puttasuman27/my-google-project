import os
import json
import time
import logging
from pathlib import Path
from typing import Optional, List
from pydantic import BaseModel
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=ROOT_DIR / ".env", override=True)

logger = logging.getLogger(__name__)


class ResolutionVerificationResult(BaseModel):
    is_resolved: bool
    confidence_score: float
    explanation: str
    action_taken: str
    quality_verdict: str  # "PASS" | "NEEDS_REWORK" | "FAIL" | "INCONCLUSIVE"


class ResolutionAgent:
    def __init__(self):
        self.candidate_models: List[str] = [
            os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-2.5-flash",
            "gemini-1.5-pro",
        ]
        self.candidate_models = list(dict.fromkeys(self.candidate_models))
        self.client = None
        self._init_client()

    def _init_client(self):
        api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
        if api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=api_key)
                logger.info("Gemini Resolution Agent initialized.")
            except Exception as e:
                logger.warning(f"GenAI Client init warning: {e}")
                self.client = None
        else:
            self.client = None

    def verify_resolution(
        self,
        after_image_bytes: bytes,
        category: str = "POTHOLE",
        before_image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg"
    ) -> ResolutionVerificationResult:
        if not self.client:
            self._init_client()

        # 1. Reject empty or corrupted image bytes immediately
        if not after_image_bytes or len(after_image_bytes) < 50:
            return ResolutionVerificationResult(
                is_resolved=False,
                confidence_score=0.0,
                explanation="No resolution image was provided or image is invalid.",
                action_taken="NONE",
                quality_verdict="FAIL"
            )

        # 2. FAIL-SAFE RULE: If Gemini client is unavailable, NEVER automatically PASS
        if not self.client:
            logger.warning("Gemini Client unavailable during resolution audit. Escalating to human supervisor.")
            return ResolutionVerificationResult(
                is_resolved=False,
                confidence_score=0.0,
                explanation="Automated verification service unavailable. Ticket flagged as INCONCLUSIVE for mandatory field supervisor inspection.",
                action_taken="HUMAN_REVIEW_REQUIRED",
                quality_verdict="INCONCLUSIVE"
            )

        # 3. Live Gemini Multimodal Resolution Verification
        prompt = f"""
        You are an expert Municipal Infrastructure Quality Auditor AI.
        Inspect this submitted field repair photo for a reported civic issue of category: '{category}'.

        AUDIT CRITERIA:
        1. Determine if the reported defect (e.g. pothole asphalt, drainage, streetlight, garbage) has been addressed and repaired.
        2. If the photo shows a completed repair, clean road surface, or cleared hazard, set "is_resolved": true and "quality_verdict": "PASS".
        3. If the hazard is still present, substandard, or location is mismatched, set "is_resolved": false and "quality_verdict": "FAIL" or "NEEDS_REWORK".

        Return ONLY a JSON object with this exact structure:
        {{
            "is_resolved": true,
            "confidence_score": 0.95,
            "explanation": "Field repair verified. Defect rectified and site restored to municipal safety standards.",
            "action_taken": "ASPHALT_PATCH_APPLIED",
            "quality_verdict": "PASS"
        }}
        """

        from google.genai import types

        contents = []
        if before_image_bytes and len(before_image_bytes) > 50:
            contents.append(types.Part.from_bytes(data=before_image_bytes, mime_type=mime_type))
        contents.append(types.Part.from_bytes(data=after_image_bytes, mime_type=mime_type))
        contents.append(prompt)

        for model in self.candidate_models:
            if any(term in model.lower() for term in ["tts", "audio", "embedding"]):
                continue

            for attempt in range(2):
                try:
                    logger.info(f"Auditing resolution with model: {model} (attempt {attempt + 1})")
                    response = self.client.models.generate_content(
                        model=model,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.1
                        )
                    )

                    raw_text = response.text.strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.startswith("```"):
                        raw_text = raw_text[3:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]

                    data = json.loads(raw_text.strip())
                    return ResolutionVerificationResult(**data)
                except Exception as e:
                    err_msg = str(e)
                    logger.warning(f"Model {model} attempt {attempt + 1} notice: {err_msg}")
                    if "404" in err_msg or "NOT_FOUND" in err_msg:
                        break
                    time.sleep(0.5)

        # 4. FAIL-SAFE RULE: LLM failure/timeout routes to manual inspection
        return ResolutionVerificationResult(
            is_resolved=False,
            confidence_score=0.0,
            explanation="Automated visual verification timed out. Flagged as INCONCLUSIVE for manual quality inspection.",
            action_taken="HUMAN_REVIEW_REQUIRED",
            quality_verdict="INCONCLUSIVE"
        )