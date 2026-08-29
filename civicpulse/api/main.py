import os
import sys
import uuid
import json
import base64
import io
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

# Ensure project root is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image

# Import Google GenAI Client
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

# Import ADK agents and schemas
try:
    from agents.incident_agent.agent import evaluate_spatial_deduplication
except ImportError:
    evaluate_spatial_deduplication = None

try:
    from agents.routing_agent.agent import determine_routing_and_priority, RoutingDecision
except ImportError:
    class RoutingDecision(BaseModel):
        assigned_department: str
        priority_level: str
        sla_hours: int
        auto_dispatch: bool

    def determine_routing_and_priority(category: str, severity: str, safety_hazard: bool) -> RoutingDecision:
        dept = "Electrical & Public Lighting Dept" if "Light" in category else "Roads & Public Works Dept"
        return RoutingDecision(
            assigned_department=dept,
            priority_level="CRITICAL" if safety_hazard or severity.upper() == "CRITICAL" else "MEDIUM",
            sla_hours=4 if safety_hazard else 24,
            auto_dispatch=safety_hazard
        )

try:
    from schemas.incident import IncidentMatchResult
except ImportError:
    class IncidentMatchResult(BaseModel):
        is_duplicate: bool
        matched_incident_id: Optional[str] = None
        confidence: float
        explanation: str
        distance_meters: Optional[float] = None

# Extended Vision Analysis Result with Image Authenticity Guardrail
class VisionAnalysisResult(BaseModel):
    is_valid_civic_issue: bool = Field(
        description="True ONLY if photo contains real public outdoor civic infrastructure flaws. False for letters, documents, salary slips, selfies, memes, or indoor scenes."
    )
    rejection_reason: Optional[str] = Field(
        default=None,
        description="Detailed explanation if the image fails the authenticity audit."
    )
    category: str = Field(default="Pothole", description="Must be one of: 'Pothole', 'Streetlight', 'Drainage', 'Garbage', 'Invalid'")
    confidence_score: float = Field(default=0.98, description="Model confidence score (0.0 - 1.0)")
    severity_level: str = Field(default="High", description="Severity level: 'Low', 'Medium', 'High', 'Critical', 'None'")
    description: str = Field(default="Municipal infrastructure defect.", description="Summary of visible damage")
    safety_hazard: bool = Field(default=False, description="True if hazard poses immediate risk to public safety")

# BigQuery Service Initialization
try:
    from services.bigquery_service import BigQueryService
    bq_service = BigQueryService()
    HAS_BQ = True
except Exception as e:
    print(f"[Info] Running without BigQuery direct sync: {e}")
    bq_service = None
    HAS_BQ = False

app = FastAPI(title="CivicPulse AI Agentic API", version="3.0.0")

# Enable CORS for Vite frontend & Cloud Shell Preview
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory incident cache for spatial deduplication
ACTIVE_INCIDENTS_CACHE: List[Dict[str, Any]] = [
    {
        "incident_id": "inc_8a084853",
        "category": "Pothole",
        "latitude": 17.49367,
        "longitude": 78.42035,
        "severity": "High",
        "assigned_ward": "Ward 14 - Central Core",
        "duplicate_count": 14
    },
    {
        "incident_id": "inc_7b192044",
        "category": "Streetlight",
        "latitude": 17.49500,
        "longitude": 78.42200,
        "severity": "High",
        "assigned_ward": "Ward 14 - Central Core",
        "duplicate_count": 5
    }
]

# Request / Response Schemas
class ReportSubmissionRequest(BaseModel):
    citizen_id: str = "citizen_demo"
    image_uri: str
    category: str
    description_text: Optional[str] = ""
    latitude: float
    longitude: float

class ReportSubmissionResponse(BaseModel):
    report_id: str
    incident_id: str
    is_duplicate: bool
    distance_meters: Optional[float] = None
    dedup_explanation: str
    confidence_score: float
    analysis: VisionAnalysisResult
    routing: RoutingDecision
    status: str = "SUCCESS"


def get_gemini_client():
    """Initializes Gemini Client using GEMINI_API_KEY from environment."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[CRITICAL WARNING] GEMINI_API_KEY environment variable is NOT set!")
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"[Gemini Client Init Error] {e}")
        return None


def decode_image_payload(image_data: str) -> Optional[Image.Image]:
    """Decodes data URLs or base64 strings into PIL Images."""
    try:
        if not image_data or not isinstance(image_data, str):
            return None
        
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        image_data = image_data.strip()
        decoded_bytes = base64.b64decode(image_data)
        return Image.open(io.BytesIO(decoded_bytes))
    except Exception as err:
        print(f"[Image Decode Error] {err}")
        return None


def execute_vision_guardrail(image_uri: str, user_category: str, user_desc: str) -> VisionAnalysisResult:
    """
    Multimodal Vision Agent Guardrail:
    Enforces strict rejection on documents, contracts, offer letters, salary sheets, selfies, and non-civic photos.
    """
    client = get_gemini_client()
    pil_image = decode_image_payload(image_uri)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Vision Agent Error: GEMINI_API_KEY is not configured on the server. Please export your GEMINI_API_KEY."
        )

    if not pil_image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image payload. Please upload a valid image file."
        )

    system_prompt = """
    You are the Strict Image Integrity & Vision Triage Agent for CivicPulse, a smart city municipal hazard platform.

    TASK:
    Audit the uploaded citizen image evidence. Determine if it is a genuine outdoor civic infrastructure defect or spam/irrelevant data.

    STRICT REJECTION RULES (Set `is_valid_civic_issue = false`):
    - Text documents, employment letters, termination letters, salary slips, contracts, resumes, offer letters, invoices, receipts, books, screenshots with text.
    - Human faces, selfies, portraits, ID cards.
    - Indoor scenes (offices, bedrooms, kitchens, living rooms, indoor ceilings/floors).
    - Pets, animals, food, consumer goods, memes, cartoons.
    - Pitch black or unidentifiable blurry noise.

    ACCEPTANCE CRITERIA (Set `is_valid_civic_issue = true`):
    - ONLY genuine public outdoor municipal hazards: potholes, damaged asphalt, streetlights/lamp posts, exposed electrical wires, open drainage culverts, sewage overflow, or illegal garbage piles.

    OUTPUT SCHEMA:
    - If rejected: `is_valid_civic_issue = false`, `rejection_reason = "Uploaded image is a text document / letter / non-civic item and cannot be accepted as infrastructure evidence."`, `category = "Invalid"`, `severity_level = "None"`.
    - If valid: `is_valid_civic_issue = true`, `category` in ['Pothole', 'Streetlight', 'Drainage', 'Garbage'], `severity_level` in ['Low', 'Medium', 'High', 'Critical'].
    """

    prompt = f"Citizen Category Claim: {user_category}. Remarks: {user_desc}. Evaluate image authenticity strictly."

    candidate_models = ['gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
    last_error = None

    for model_name in candidate_models:
        try:
            print(f"[Vision Agent] Calling model {model_name} for image inspection...")
            response = client.models.generate_content(
                model=model_name,
                contents=[pil_image, prompt],
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=VisionAnalysisResult,
                    temperature=0.0
                )
            )
            parsed = json.loads(response.text)
            print(f"[Vision Agent Decision via {model_name}] valid={parsed.get('is_valid_civic_issue')} | category={parsed.get('category')} | reason={parsed.get('rejection_reason')}")
            return VisionAnalysisResult(**parsed)
        except Exception as e:
            last_error = e
            print(f"[Model {model_name} Notice] {e}")

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Gemini Vision Agent failed: {str(last_error)}"
    )


@app.get("/")
def health_check():
    client = get_gemini_client()
    return {
        "status": "online",
        "service": "CivicPulse AI Agentic API",
        "gemini_active": client is not None,
        "bigquery_enabled": HAS_BQ
    }


@app.get("/api/v1/incidents")
def get_active_incidents():
    """Fetches recent canonical incidents from BigQuery ordered by latest first."""
    if HAS_BQ and bq_service:
        try:
            bq_incidents = bq_service.get_recent_incidents(limit=20)
            if bq_incidents:
                return {"incidents": bq_incidents}
        except Exception as err:
            print(f"[BigQuery Read Error] {err}. Falling back to active cache.")
            
    # Fallback in-memory formatting
    formatted_cache = []
    for inc in ACTIVE_INCIDENTS_CACHE:
        formatted_cache.append({
            "id": inc["incident_id"],
            "title": f"{inc['category']} Hazard",
            "category": inc["category"],
            "location": f"{inc.get('assigned_ward', 'Ward 14')} ({inc['latitude']}, {inc['longitude']})",
            "ward": inc.get("assigned_ward", "Ward 14 - Central Core"),
            "severity": "P1 - High" if inc.get("severity") == "High" else "P2 - Moderate",
            "severityScore": 0.85 if inc.get("severity") == "High" else 0.65,
            "upvotes": inc.get("duplicate_count", 1) * 3,
            "userUpvoted": False,
            "department": "Public Works Department" if inc["category"] == "Pothole" else "Electrical & Public Lighting",
            "slaCountdown": "04h 00m remaining",
            "status": "IN_PROGRESS",
            "reportsMerged": inc.get("duplicate_count", 1),
            "image": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80"
        })
    return {"incidents": formatted_cache}


@app.post("/api/v1/reports", response_model=ReportSubmissionResponse)
async def submit_report(payload: ReportSubmissionRequest):
    report_id = f"rep_{uuid.uuid4().hex[:8]}"

    # 1. VISION AGENT: Audit Image Authenticity & Extract Defect
    vision_result = execute_vision_guardrail(
        image_uri=payload.image_uri,
        user_category=payload.category,
        user_desc=payload.description_text or ""
    )

    # 🛑 Anti-Spam Guardrail Check: Halt if image is not a valid civic defect
    if not vision_result.is_valid_civic_issue:
        error_msg = vision_result.rejection_reason or "Image Integrity Check Failed: Uploaded image is not a valid public infrastructure hazard."
        print(f"[Guardrail Blocked Report] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # 2. INCIDENT AGENT: Spatial Deduplication (50m Radius)
    if evaluate_spatial_deduplication:
        dedup_result = evaluate_spatial_deduplication(
            report_category=vision_result.category,
            report_lat=payload.latitude,
            report_lng=payload.longitude,
            active_incidents=ACTIVE_INCIDENTS_CACHE,
            max_radius_meters=50.0
        )
    else:
        dedup_result = IncidentMatchResult(
            is_duplicate=False,
            confidence=0.95,
            explanation="Initialized new canonical incident cluster."
        )

    if dedup_result.is_duplicate and dedup_result.matched_incident_id:
        target_incident_id = dedup_result.matched_incident_id
        for item in ACTIVE_INCIDENTS_CACHE:
            if item["incident_id"] == target_incident_id:
                item["duplicate_count"] += 1
                break
    else:
        target_incident_id = f"inc_{uuid.uuid4().hex[:8]}"
        ACTIVE_INCIDENTS_CACHE.insert(0, {
            "incident_id": target_incident_id,
            "category": vision_result.category,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "severity": vision_result.severity_level,
            "assigned_ward": "Ward 14 - Central Core",
            "duplicate_count": 1
        })

    # 3. ROUTING AGENT: Department Assignment & SLA Timing
    routing_result = determine_routing_and_priority(
        category=vision_result.category,
        severity=vision_result.severity_level,
        safety_hazard=vision_result.safety_hazard
    )

    # 4. BIGQUERY PERSISTENCE
    if HAS_BQ and bq_service:
        try:
            bq_service.insert_report({
                "report_id": report_id,
                "incident_id": target_incident_id,
                "citizen_id": payload.citizen_id,
                "category": vision_result.category,
                "severity_level": vision_result.severity_level,
                "confidence_score": vision_result.confidence_score,
                "safety_hazard": vision_result.safety_hazard,
                "image_uri": payload.image_uri,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "reported_at": datetime.now(timezone.utc).isoformat()
            })
            bq_service.create_or_update_incident(
                incident_id=target_incident_id,
                category=vision_result.category,
                lat=payload.latitude,
                lng=payload.longitude,
                severity_level=vision_result.severity_level,
                is_duplicate=dedup_result.is_duplicate
            )
        except Exception as err:
            print(f"[BigQuery Warning] {err}")

    return ReportSubmissionResponse(
        report_id=report_id,
        incident_id=target_incident_id,
        is_duplicate=dedup_result.is_duplicate,
        distance_meters=dedup_result.distance_meters,
        dedup_explanation=dedup_result.explanation,
        confidence_score=dedup_result.confidence,
        analysis=vision_result,
        routing=routing_result,
        status="SUCCESS"
    )