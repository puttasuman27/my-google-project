import os
import uuid
from google.cloud import bigquery
from pydantic import BaseModel

class IncidentClusteringResult(BaseModel):
    canonical_incident_id: str
    is_duplicate: bool
    duplicate_count: int
    updated_priority_score: float
    explanation: str

class IncidentAgent:
    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
        self.dataset_id = os.getenv("BIGQUERY_DATASET", "civicpulse_analytics")
        self.client = bigquery.Client(project=self.project_id)
        self.radius_meters = 25.0

    def process_and_cluster(
        self,
        vision_result,
        lat: float,
        lng: float,
        citizen_notes: str = "",
        image_url: str = "",
        road_class: str = "ARTERIAL"
    ) -> IncidentClusteringResult:
        category = getattr(vision_result, "category", "POTHOLE")
        severity = getattr(vision_result, "severity_score", 0.85)
        table_ref = f"`{self.project_id}.{self.dataset_id}.incidents`"

        # 1. BigQuery GIS Query: Find any active incident within 25 meters
        query = f"""
            SELECT 
                incident_id,
                duplicate_count,
                priority_score,
                ST_DISTANCE(location, ST_GEOGPOINT(@lng, @lat)) AS distance_m
            FROM {table_ref}
            WHERE category = @category
              AND status != 'RESOLVED'
              AND ST_DWITHIN(location, ST_GEOGPOINT(@lng, @lat), @radius)
            ORDER BY distance_m ASC
            LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("category", "STRING", category),
                bigquery.ScalarQueryParameter("lng", "FLOAT64", lng),
                bigquery.ScalarQueryParameter("lat", "FLOAT64", lat),
                bigquery.ScalarQueryParameter("radius", "FLOAT64", self.radius_meters),
            ]
        )

        rows = list(self.client.query(query, job_config=job_config).result())

        # 2. MATCH FOUND -> MERGE DUPLICATE
        if rows:
            match = rows[0]
            canonical_id = match["incident_id"]
            new_count = int(match["duplicate_count"] or 1) + 1
            
            # Recalculate priority with extra citizen weight
            new_prio = round(min(severity * 0.4 + (new_count * 0.15) + 0.3, 0.99), 3)

            # Update existing row in BigQuery
            update_query = f"""
                UPDATE {table_ref}
                SET 
                    duplicate_count = @new_count,
                    priority_score = @new_prio,
                    updated_at = CURRENT_TIMESTAMP()
                WHERE incident_id = @canonical_id
            """
            u_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("new_count", "INT64", new_count),
                    bigquery.ScalarQueryParameter("new_prio", "FLOAT64", new_prio),
                    bigquery.ScalarQueryParameter("canonical_id", "STRING", canonical_id),
                ]
            )
            self.client.query(update_query, job_config=u_config).result()

            return IncidentClusteringResult(
                canonical_incident_id=canonical_id,
                is_duplicate=True,
                duplicate_count=new_count,
                updated_priority_score=new_prio,
                explanation=f"Spatial cluster merged: Defect located {round(match['distance_m'], 1)}m from Canonical ID {canonical_id}."
            )

        # 3. NO MATCH -> INSERT NEW CANONICAL INCIDENT
        new_id = f"INC-{str(uuid.uuid4())[:8].upper()}"
        initial_prio = round(severity * 0.5 + 0.35, 3)
        ward_id = f"Ward-{int((lat % 1) * 100):02d}"

        insert_query = f"""
            INSERT INTO {table_ref} (
                incident_id, category, latitude, longitude, location,
                severity_score, priority_score, duplicate_count,
                assigned_ward, status, created_at, updated_at
            )
            VALUES (
                @id, @category, @lat, @lng, ST_GEOGPOINT(@lng, @lat),
                @sev, @prio, 1,
                @ward, 'OPEN', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
            )
        """
        i_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("id", "STRING", new_id),
                bigquery.ScalarQueryParameter("category", "STRING", category),
                bigquery.ScalarQueryParameter("lat", "FLOAT64", lat),
                bigquery.ScalarQueryParameter("lng", "FLOAT64", lng),
                bigquery.ScalarQueryParameter("sev", "FLOAT64", severity),
                bigquery.ScalarQueryParameter("prio", "FLOAT64", initial_prio),
                bigquery.ScalarQueryParameter("ward", "STRING", ward_id),
            ]
        )
        self.client.query(insert_query, job_config=i_config).result()

        return IncidentClusteringResult(
            canonical_incident_id=new_id,
            is_duplicate=False,
            duplicate_count=1,
            updated_priority_score=initial_prio,
            explanation="New canonical incident created with GIS point partition."
        )

__all__ = ["IncidentAgent", "IncidentClusteringResult"]