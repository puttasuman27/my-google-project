import os
import uuid
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google.cloud import bigquery

# Import Agent Pipeline
from agents.vision_agent import VisionAgent
from agents.incident_agent import IncidentAgent
from agents.operations_agent import OperationsAgent
from agents.resolution_agent import ResolutionAgent

load_dotenv()

app = FastAPI(
    title="CivicPulse AI Resolution Intelligence API",
    description="Agentic Municipal Infrastructure Management Platform powered by Google Cloud & Gemini",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Agents
vision_agent = VisionAgent()
incident_agent = IncidentAgent()
operations_agent = OperationsAgent()
resolution_agent = ResolutionAgent()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "civicpulse-agentic-core",
        "version": "2.0.0"
    }

# -------------------------------------------------------------
# 1. CITIZEN INTAKE & MULTI-AGENT INGESTION PIPELINE
# -------------------------------------------------------------
@app.post("/api/v1/citizen/report")
async def report_issue(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    citizen_notes: Optional[str] = Form(None),
    road_class: Optional[str] = Form("SECONDARY")
):
    try:
        image_bytes = await image.read()
        mime_type = image.content_type or "image/jpeg"

        # Stage 1: Vision Agent Analysis
        vision_result = vision_agent.analyze(image_bytes, mime_type)

        if not vision_result.is_valid_civic_issue:
            return {
                "success": False,
                "status": "REJECTED_INVALID_IMAGE",
                "message": "The uploaded photo does not contain a recognizable municipal infrastructure defect.",
                "analysis": vision_result.model_dump()
            }

        # Mock image storage URL (or GCS bucket upload)
        mock_image_url = f"https://storage.googleapis.com/{os.getenv('GCS_BUCKET_NAME', 'civicpulse-evidence')}/{uuid.uuid4().hex}.jpg"

        # Stage 2: Incident Agent (BigQuery GIS Deduplication & Spatial Clustering)
        clustering_result = incident_agent.process_and_cluster(
            vision_result=vision_result,
            lat=latitude,
            lng=longitude,
            citizen_notes=citizen_notes,
            image_url=mock_image_url,
            road_class=road_class
        )

        # Stage 3: Operations Agent (Routing & SLA Assignment)
        ops_result = operations_agent.route_and_assign_sla(
            incident_id=clustering_result.canonical_incident_id,
            category=vision_result.category,
            priority_score=clustering_result.updated_priority_score,
            lat=latitude,
            lng=longitude
        )

        return {
            "success": True,
            "status": "PROCESSED",
            "vision_telemetry": vision_result.model_dump(),
            "clustering": clustering_result.model_dump(),
            "operations_dispatch": ops_result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# 2. CONTRACTOR CLOSED-LOOP VERIFICATION PIPELINE
# -------------------------------------------------------------
@app.post("/api/v1/contractor/verify-repair")
async def verify_contractor_repair(
    incident_id: str = Form(...),
    contractor_id: str = Form(...),
    intake_image: UploadFile = File(...),
    completion_image: UploadFile = File(...)
):
    try:
        intake_bytes = await intake_image.read()
        completion_bytes = await completion_image.read()
        mime_type = intake_image.content_type or "image/jpeg"

        # Stage 4: Resolution Agent (Before/After Visual Verification)
        verification = resolution_agent.verify_repair(
            intake_image_bytes=intake_bytes,
            completion_image_bytes=completion_bytes,
            mime_type=mime_type
        )

        # Update BigQuery Incident status based on Verdict
        project_id = os.getenv("GCP_PROJECT_ID")
        dataset_id = os.getenv("BIGQUERY_DATASET", "civicpulse_data")
        client = bigquery.Client(project=project_id)
        
        incidents_table = f"{project_id}.{dataset_id}.canonical_incidents"
        verifications_table = f"{project_id}.{dataset_id}.resolution_verifications"

        new_status = "RESOLVED" if verification.verdict == "PASS" else "AUDIT_FAILED_REOPENED"

        # Update Incident Table
        update_query = f"""
            UPDATE `{incidents_table}`
            SET status = @status, updated_at = CURRENT_TIMESTAMP()
            WHERE incident_id = @incident_id
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("status", "STRING", new_status),
                bigquery.ScalarQueryParameter("incident_id", "STRING", incident_id),
            ]
        )
        client.query(update_query, job_config=job_config).result()

        # Record Verification Audit Entry
        verification_id = str(uuid.uuid4())
        insert_verif = f"""
            INSERT INTO `{verifications_table}` (
                verification_id, canonical_incident_id, contractor_id, verdict,
                confidence_score, reasoning, verified_at
            )
            VALUES (
                @verif_id, @inc_id, @contractor_id, @verdict,
                @conf_score, @reasoning, CURRENT_TIMESTAMP()
            )
        """
        verif_job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("verif_id", "STRING", verification_id),
                bigquery.ScalarQueryParameter("inc_id", "STRING", incident_id),
                bigquery.ScalarQueryParameter("contractor_id", "STRING", contractor_id),
                bigquery.ScalarQueryParameter("verdict", "STRING", verification.verdict),
                bigquery.ScalarQueryParameter("conf_score", "FLOAT64", verification.confidence_score),
                bigquery.ScalarQueryParameter("reasoning", "STRING", verification.reasoning),
            ]
        )
        client.query(insert_verif, job_config=verif_job_config).result()

        return {
            "success": True,
            "incident_id": incident_id,
            "new_status": new_status,
            "verification_audit": verification.model_dump()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# 3. ADMIN & OPERATIONS DATA QUERIES
# -------------------------------------------------------------
@app.get("/api/v1/incidents")
def list_canonical_incidents(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200)
):
    try:
        project_id = os.getenv("GCP_PROJECT_ID")
        dataset_id = os.getenv("BIGQUERY_DATASET", "civicpulse_data")
        client = bigquery.Client(project=project_id)

        filter_clause = "WHERE status = @status" if status else ""
        query = f"""
            SELECT 
                incident_id, category, status, priority_score, severity_score, 
                report_count, road_class, hazard_type, latitude, longitude,
                primary_image_url, assigned_ward, assigned_department, 
                sla_deadline, created_at, updated_at
            FROM `{project_id}.{dataset_id}.canonical_incidents`
            {filter_clause}
            ORDER BY priority_score DESC, created_at DESC
            LIMIT @limit
        """
        params = [bigquery.ScalarQueryParameter("limit", "INT64", limit)]
        if status:
            params.append(bigquery.ScalarQueryParameter("status", "STRING", status))

        job_config = bigquery.QueryJobConfig(query_parameters=params)
        rows = client.query(query, job_config=job_config).result()

        incidents = [dict(row) for row in rows]
        return {
            "total": len(incidents),
            "incidents": incidents
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))