import os
import uuid
import base64
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google.cloud import bigquery

from agents.vision_agent import VisionAgent
from agents.incident_agent import IncidentAgent
from agents.operations_agent import OperationsAgent
from agents.resolution_agent import ResolutionAgent

load_dotenv()

app = FastAPI(title="CivicPulse Core API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vision_agent = VisionAgent()
incident_agent = IncidentAgent()
operations_agent = OperationsAgent()
resolution_agent = ResolutionAgent()

GCP_PROJECT = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
BQ_DATASET = os.getenv("BIGQUERY_DATASET", "civicpulse_analytics")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "civicpulse-agentic-core"}


@app.post("/api/v1/reports")
async def report_issue(request: Request):
    try:
        content_type = request.headers.get("content-type", "")
        image_bytes = b""
        mime_type = "image/jpeg"
        latitude = 17.49367
        longitude = 78.42035
        citizen_notes = ""
        category_input = "POTHOLE"
        road_class = "ARTERIAL"

        if "application/json" in content_type:
            body = await request.json()
            latitude = float(body.get("latitude") or 17.49367)
            longitude = float(body.get("longitude") or 78.42035)
            citizen_notes = body.get("description_text") or body.get("description") or ""
            category_input = body.get("category") or "POTHOLE"
            
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
            latitude = float(form.get("latitude") or 17.49367)
            longitude = float(form.get("longitude") or 78.42035)
            citizen_notes = form.get("citizen_notes") or form.get("description_text") or ""
            category_input = form.get("category") or "POTHOLE"

        # 1. Vision Analysis & Authenticity Validation
        vision_result = vision_agent.analyze_image(image_bytes, mime_type)

        # REJECT INVALID / NON-CIVIC PHOTOS (documents, selfies, screenshots, etc.)
        if not vision_result.is_valid_civic_issue:
            raise HTTPException(
                status_code=400,
                detail=vision_result.rejection_reason or "Uploaded photo is not a valid municipal infrastructure hazard."
            )

        # 2. BigQuery GIS Spatial Deduplication (50m proximity)
        cluster = incident_agent.process_and_cluster(
            vision_result=vision_result,
            lat=latitude,
            lng=longitude,
            citizen_notes=citizen_notes,
            road_class=road_class
        )

        # 3. Operations SLA Assignment
        ops = operations_agent.route_and_assign_sla(
            incident_id=cluster.canonical_incident_id,
            category=vision_result.category,
            priority_score=cluster.updated_priority_score,
            lat=latitude,
            lng=longitude
        )

        prio_label = "Critical" if cluster.updated_priority_score >= 0.8 else ("High" if cluster.updated_priority_score >= 0.5 else "Medium")

        return {
            "success": True,
            "incident_id": cluster.canonical_incident_id,
            "is_duplicate": cluster.is_duplicate,
            "duplicate_count": cluster.duplicate_count,
            "dedup_explanation": cluster.explanation,
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
                "assigned_ward": ops.get("assigned_ward", "Ward-14"),
                "priority_level": prio_label,
                "priority_score": cluster.updated_priority_score,
                "sla_hours": ops.get("sla_hours", 24),
                "sla_deadline": ops.get("sla_deadline", "")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Report submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/incidents")
def list_canonical_incidents(status: Optional[str] = Query(None), limit: int = Query(50, le=200)):
    try:
        client = bigquery.Client(project=GCP_PROJECT)
        
        conditions = [
            "category IS NOT NULL",
            "category != ''",
            "latitude IS NOT NULL",
            "longitude IS NOT NULL"
        ]
        if status:
            conditions.append("status = @status")
        
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
                COALESCE(assigned_ward, 'Ward-14') AS assigned_ward, 
                COALESCE(status, 'OPEN') AS status, 
                sla_deadline, 
                created_at, 
                updated_at
            FROM `{GCP_PROJECT}.{BQ_DATASET}.incidents`
            {where_clause}
            ORDER BY priority_score DESC, updated_at DESC
            LIMIT @limit
        """
        params = [bigquery.ScalarQueryParameter("limit", "INT64", limit)]
        if status:
            params.append(bigquery.ScalarQueryParameter("status", "STRING", status))

        rows = client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()
        
        incidents = []
        for r in rows:
            rec = dict(r)
            for k in ["created_at", "updated_at", "sla_deadline"]:
                if rec.get(k):
                    rec[k] = str(rec[k])
            incidents.append(rec)

        return {"total": len(incidents), "incidents": incidents}
    except Exception as e:
        print(f"Fetch incidents error: {e}")
        raise HTTPException(status_code=500, detail=str(e))