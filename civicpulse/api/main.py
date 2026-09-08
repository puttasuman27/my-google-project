import os
import uuid
import base64
import urllib.request
import urllib.parse
import json
import logging
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 1. Force load .env from project root directory
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)

# Sanitize broken service account path if present
creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
if creds_path and not os.path.exists(creds_path):
    os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

from google.cloud import bigquery
from agents.vision_agent import VisionAgent
from agents.incident_agent import IncidentAgent
from agents.operations_agent import OperationsAgent
from agents.resolution_agent import ResolutionAgent
from services.firestore_service import FirestoreService
from services.pubsub_service import PubSubService

logger = logging.getLogger(__name__)

app = FastAPI(title="CivicPulse Core API", version="4.1.0")

# 🔒 Configurable CORS Allowed Origins
allowed_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,https://civicpulse-app-505811.web.app,https://civicpulse-app-505811.firebaseapp.com"
)
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Agents & Services
vision_agent = VisionAgent()
incident_agent = IncidentAgent()
operations_agent = OperationsAgent()
resolution_agent = ResolutionAgent()
firestore_service = FirestoreService()
pubsub_service = PubSubService()

GCP_PROJECT = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
BQ_DATASET = os.getenv("BIGQUERY_DATASET", "civicpulse_analytics")


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "civicpulse-agentic-core",
        "version": "4.1.0",
        "dataset": BQ_DATASET
    }


# ============================================================================
# 🗺️ 1. GEOCODING & REVERSE GEOCODING PROXY
# ============================================================================
@app.get("/api/v1/geocode")
def geocode_search(query: str = Query(..., min_length=2)):
    try:
        encoded_q = urllib.parse.quote(query)
        url = f"https://nominatim.openstreetmap.org/search?q={encoded_q}&format=json&limit=5&addressdetails=1"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "CivicPulse-Municipal-AI/4.1 (contact: info@civicpulse.org)"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            results = []
            for item in data:
                lat = float(item.get("lat"))
                lng = float(item.get("lon"))
                ward_name = incident_agent.resolve_ward_gis(lat, lng)
                results.append({
                    "display_name": item.get("display_name"),
                    "latitude": lat,
                    "longitude": lng,
                    "ward": ward_name,
                    "address": item.get("address", {})
                })
            return {"query": query, "results": results}
    except Exception as e:
        logger.warning(f"Geocoding fallback: {e}")
        return {
            "query": query,
            "results": [{
                "display_name": f"{query}, Municipal Zone Core",
                "latitude": 17.49367,
                "longitude": 78.42035,
                "ward": "Ward 14 - Central Core"
            }]
        }


@app.get("/api/v1/reverse-geocode")
def reverse_geocode(lat: float = Query(...), lng: float = Query(...)):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "CivicPulse-Municipal-AI/4.1 (contact: info@civicpulse.org)"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            addr = data.get("address", {})
            street = addr.get("road") or addr.get("suburb") or addr.get("neighbourhood") or "Main Arterial Road"
            city = addr.get("city") or addr.get("town") or "Metro Core"
            ward_name = incident_agent.resolve_ward_gis(lat, lng)
            formatted = f"{street}, {ward_name}, {city}"
            return {
                "latitude": lat,
                "longitude": lng,
                "formatted_address": formatted,
                "ward": ward_name
            }
    except Exception:
        ward_name = incident_agent.resolve_ward_gis(lat, lng)
        return {
            "latitude": lat,
            "longitude": lng,
            "formatted_address": f"{ward_name}, Main Arterial Road",
            "ward": ward_name
        }


# ============================================================================
# 🔐 2. SECURE AUTHENTICATION
# ============================================================================
@app.post("/api/v1/auth/login")
async def login_user(payload: dict = Body(...)):
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", "")).strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    # 1. Configurable Demo Commissioner Credentials
    demo_admin_email = os.getenv("DEMO_ADMIN_EMAIL", "puttasuman27@gmail.com").strip().lower()
    demo_admin_pass = os.getenv("DEMO_ADMIN_PASSWORD", "12345678").strip()

    if email == demo_admin_email and password == demo_admin_pass:
        user_profile = firestore_service.set_user_role(
            email=email,
            name=os.getenv("DEMO_ADMIN_NAME", "Putta Suman"),
            role="MUNICIPAL_COMMISSIONER",
            assigned_ward="ALL",
            designation="Chief Municipal Operations Commissioner"
        )
        return {"success": True, "user": user_profile}

    # 2. BigQuery Admins Table Lookup
    try:
        if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ and not os.path.exists(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]):
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

        client = bigquery.Client(project=GCP_PROJECT)
        query = f"""
            SELECT admin_id, name, email, role, assigned_ward, designation
            FROM `{GCP_PROJECT}.{BQ_DATASET}.admins`
            WHERE LOWER(email) = @email AND password_hash = @password
            LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("email", "STRING", email),
                bigquery.ScalarQueryParameter("password", "STRING", password),
            ]
        )
        rows = list(client.query(query, job_config=job_config).result())

        if rows:
            admin_data = dict(rows[0])
            synced_profile = firestore_service.set_user_role(
                email=str(admin_data.get("email", "")),
                name=str(admin_data.get("name", "Municipal Official")),
                role=str(admin_data.get("role", "ADMIN")),
                assigned_ward=str(admin_data.get("assigned_ward", "ALL")),
                designation=str(admin_data.get("designation", "Municipal Officer"))
            )
            return {"success": True, "user": synced_profile}
    except Exception as e:
        logger.warning(f"BigQuery auth notice: {e}")

    # 3. Check Firestore User Store
    try:
        firestore_user = firestore_service.get_user_role(email)
        if firestore_user and firestore_user.get("is_verified_admin"):
            return {"success": True, "user": firestore_user}
    except Exception as e:
        logger.warning(f"Firestore role notice: {e}")

    raise HTTPException(status_code=401, detail="Invalid government email or password credentials.")


# ============================================================================
# 🚨 3. FETCH INCIDENTS FROM BIGQUERY
# ============================================================================
@app.get("/api/v1/incidents")
def list_canonical_incidents(
    status: Optional[str] = Query(None),
    ward: Optional[str] = Query(None),
    limit: int = Query(60, le=200)
):
    try:
        if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ and not os.path.exists(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]):
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

        client = bigquery.Client(project=GCP_PROJECT)
        
        conditions = [
            "category IS NOT NULL",
            "category != ''",
            "latitude IS NOT NULL",
            "longitude IS NOT NULL"
        ]
        params = [bigquery.ScalarQueryParameter("limit", "INT64", limit)]

        if status and status != "ALL":
            conditions.append("UPPER(TRIM(status)) = UPPER(TRIM(@status))")
            params.append(bigquery.ScalarQueryParameter("status", "STRING", status))

        if ward and ward != "ALL":
            conditions.append("LOWER(assigned_ward) LIKE LOWER(@ward)")
            params.append(bigquery.ScalarQueryParameter("ward", "STRING", f"%{ward}%"))
        
        where_clause = "WHERE " + " AND ".join(conditions)

        query = f"""
            SELECT 
                incident_id, 
                category, 
                latitude, 
                longitude,
                COALESCE(severity_score, 0.5) AS severity_score, 
                COALESCE(priority_score, 0.5) AS priority_score, 
                COALESCE(duplicate_count, 1) AS duplicate_count,
                COALESCE(assigned_ward, 'Ward 14 - Central Core') AS assigned_ward, 
                COALESCE(status, 'OPEN') AS status, 
                sla_deadline, 
                created_at, 
                updated_at,
                intake_image_url,
                resolved_image_url
            FROM `{GCP_PROJECT}.{BQ_DATASET}.incidents`
            {where_clause}
            ORDER BY priority_score DESC, updated_at DESC
            LIMIT @limit
        """

        rows = client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()
        incidents = []
        for r in rows:
            rec = dict(r)
            for k in ["created_at", "updated_at", "sla_deadline"]:
                if rec.get(k):
                    rec[k] = str(rec[k])
            if "intake_image_url" not in rec or not rec.get("intake_image_url"):
                rec["intake_image_url"] = ""
            if "resolved_image_url" not in rec or not rec.get("resolved_image_url"):
                rec["resolved_image_url"] = ""
            incidents.append(rec)

        return {"total": len(incidents), "incidents": incidents}

    except Exception as e:
        logger.error(f"Error fetching BigQuery incidents: {e}")
        return {"total": 0, "incidents": []}


# ============================================================================
# 🚨 4. ASYNCHRONOUS INGESTION (Pub/Sub + Gemini Vision + BigQuery GIS Dedup)
# ============================================================================
@app.post("/api/v1/reports")
async def report_issue(request: Request):
    try:
        content_type = request.headers.get("content-type", "")
        image_bytes = b""
        mime_type = "image/jpeg"
        image_uri = ""
        latitude = 17.49367
        longitude = 78.42035
        citizen_notes = ""
        road_class = "ARTERIAL"

        if "application/json" in content_type:
            body = await request.json()
            latitude = float(body.get("latitude") or 17.49367)
            longitude = float(body.get("longitude") or 78.42035)
            citizen_notes = body.get("description_text") or body.get("description") or ""
            
            image_uri = body.get("image_uri", "")
            if image_uri and image_uri.startswith("data:image"):
                header, base64_data = image_uri.split(",", 1)
                mime_type = header.split(";")[0].split(":")[1] if ":" in header else "image/jpeg"
                image_bytes = base64.b64decode(base64_data)

        elif "multipart/form-data" in content_type:
            form = await request.form()
            uploaded_file = form.get("image") or form.get("file")
            if uploaded_file and hasattr(uploaded_file, "read"):
                image_bytes = await uploaded_file.read()
                mime_type = getattr(uploaded_file, "content_type", "image/jpeg") or "image/jpeg"
                image_uri = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
            latitude = float(form.get("latitude") or 17.49367)
            longitude = float(form.get("longitude") or 78.42035)
            citizen_notes = form.get("citizen_notes") or form.get("description_text") or ""

        # Step 1: Gemini Multimodal Vision Inspection
        vision_result = vision_agent.analyze_image(image_bytes, mime_type)

        if not vision_result.is_valid_civic_issue:
            raise HTTPException(
                status_code=400,
                detail=vision_result.rejection_reason or "Uploaded photo is not a valid municipal infrastructure hazard."
            )

        # Step 2: Publish Ingest Event to Google Cloud Pub/Sub
        pubsub_msg_id = pubsub_service.publish_incident_report({
            "category": vision_result.category,
            "latitude": latitude,
            "longitude": longitude,
            "severity_score": vision_result.severity_score,
            "citizen_notes": citizen_notes
        })

        # Step 3: BigQuery GIS Spatial Deduplication (50m proximity)
        cluster = incident_agent.process_and_cluster(
            vision_result=vision_result,
            lat=latitude,
            lng=longitude,
            citizen_notes=citizen_notes,
            image_url=image_uri,
            road_class=road_class
        )

        # Step 4: Operations Decision Engine SLA & Routing
        ward_name = incident_agent.resolve_ward_gis(latitude, longitude)
        ops = operations_agent.route_and_assign_sla(
            incident_id=cluster.canonical_incident_id,
            category=vision_result.category,
            priority_score=cluster.updated_priority_score,
            lat=latitude,
            lng=longitude,
            ward_name=ward_name
        )

        return {
            "success": True,
            "incident_id": cluster.canonical_incident_id,
            "is_duplicate": cluster.is_duplicate,
            "duplicate_count": cluster.duplicate_count,
            "dedup_explanation": cluster.explanation,
            "intake_image_url": image_uri,
            "pubsub_message_id": pubsub_msg_id,
            "analysis": {
                "category": vision_result.category,
                "severity_level": vision_result.severity_level,
                "severity_score": vision_result.severity_score,
                "hazard_type": vision_result.hazard_type,
                "estimated_dimensions": vision_result.estimated_dimensions_m,
                "confidence": vision_result.confidence_score
            },
            "routing": {
                "assigned_department": ops.get("assigned_department", "Roads & Highway Infrastructure Dept"),
                "assigned_ward": ops.get("assigned_ward", "Ward 14 - Central Core"),
                "priority_level": ops.get("priority_level", "High"),
                "dispatch_priority": ops.get("dispatch_priority", "HIGH"),
                "priority_score": cluster.updated_priority_score,
                "sla_hours": ops.get("sla_hours", 24),
                "sla_deadline": ops.get("sla_deadline", ""),
                "recommended_crew_size": ops.get("recommended_crew_size", 2),
                "escalation_tier": ops.get("escalation_tier", "ZONAL_SUPERINTENDENT")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 🚦 5. DISPATCH STATUS UPDATE
# ============================================================================
@app.patch("/api/v1/incidents/{incident_id}/status")
async def update_incident_status(
    incident_id: str,
    payload: dict = Body(...)
):
    new_status = payload.get("status", "IN_PROGRESS").upper().strip()
    target_id = incident_id.strip()
    try:
        if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ and not os.path.exists(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]):
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

        client = bigquery.Client(project=GCP_PROJECT)
        table_ref = f"`{GCP_PROJECT}.{BQ_DATASET}.incidents`"
        
        query = f"""
            UPDATE {table_ref}
            SET status = @new_status,
                updated_at = CURRENT_TIMESTAMP()
            WHERE UPPER(TRIM(incident_id)) = UPPER(TRIM(@target_id))
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("new_status", "STRING", new_status),
                bigquery.ScalarQueryParameter("target_id", "STRING", target_id),
            ]
        )
        client.query(query, job_config=job_config).result()
        return {"success": True, "incident_id": target_id, "status": new_status}
    except Exception as e:
        logger.error(f"Status update error for {target_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 🔍 6. RESOLUTION AUDIT (Gemini Fix Verification)
# ============================================================================
@app.post("/api/v1/incidents/{incident_id}/resolve")
async def resolve_incident_with_verification(
    incident_id: str,
    payload: dict = Body(...)
):
    target_id = incident_id.strip()
    try:
        image_uri = payload.get("image_uri", "")
        category = payload.get("category", "POTHOLE")

        image_bytes = b""
        mime_type = "image/jpeg"
        if image_uri and image_uri.startswith("data:image"):
            header, base64_data = image_uri.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1] if ":" in header else "image/jpeg"
            image_bytes = base64.b64decode(base64_data)

        # 1. Gemini Resolution Verification
        audit = resolution_agent.verify_resolution(
            after_image_bytes=image_bytes,
            category=category,
            mime_type=mime_type
        )

        # 2. ONLY mark RESOLVED in BigQuery if audit explicitly PASSED
        if audit.is_resolved and audit.quality_verdict == "PASS":
            if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ and not os.path.exists(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]):
                os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

            client = bigquery.Client(project=GCP_PROJECT)
            table_ref = f"`{GCP_PROJECT}.{BQ_DATASET}.incidents`"
            query = f"""
                UPDATE {table_ref}
                SET status = 'RESOLVED',
                    resolved_image_url = @resolved_image,
                    updated_at = CURRENT_TIMESTAMP()
                WHERE UPPER(TRIM(incident_id)) = UPPER(TRIM(@target_id))
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("resolved_image", "STRING", image_uri),
                    bigquery.ScalarQueryParameter("target_id", "STRING", target_id),
                ]
            )
            client.query(query, job_config=job_config).result()

        return {
            "success": audit.is_resolved,
            "incident_id": target_id,
            "status": "RESOLVED" if (audit.is_resolved and audit.quality_verdict == "PASS") else "IN_PROGRESS",
            "audit": {
                "is_resolved": audit.is_resolved,
                "confidence_score": audit.confidence_score,
                "explanation": audit.explanation,
                "action_taken": audit.action_taken,
                "quality_verdict": audit.quality_verdict
            }
        }
    except Exception as e:
        logger.error(f"Resolution verification error for {target_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))