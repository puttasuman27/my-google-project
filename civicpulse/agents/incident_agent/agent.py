import os
import uuid
from datetime import datetime, timezone
from google.cloud import bigquery
from schemas.vision_schema import VisionAnalysisResult
from schemas.incident_schema import DeduplicationResult

class IncidentAgent:
    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID")
        self.dataset_id = os.getenv("BIGQUERY_DATASET", "civicpulse_data")
        self.client = bigquery.Client(project=self.project_id)

    def calculate_priority(self, severity_score: float, report_count: int, road_class: str) -> float:
        """
        Priority Score Formula:
        (Severity * 0.35) + (Report_Count_Weight * 0.25) + (Road_Class_Impact * 0.40)
        """
        # Diminishing returns on report count weight (maxes at 1.0 for 10+ reports)
        report_count_weight = min(report_count / 10.0, 1.0)

        # Road class impact factor
        road_impact_map = {
            "PRIMARY_ARTERIAL": 1.0,
            "SECONDARY": 0.65,
            "RESIDENTIAL": 0.35
        }
        road_class_impact = road_impact_map.get(road_class.upper(), 0.5)

        priority = (severity_score * 0.35) + (report_count_weight * 0.25) + (road_class_impact * 0.40)
        return round(min(priority, 1.0), 3)

    def process_and_cluster(
        self,
        vision_result: VisionAnalysisResult,
        lat: float,
        lng: float,
        citizen_notes: str,
        image_url: str,
        road_class: str = "SECONDARY"
    ) -> DeduplicationResult:
        """
        Executes BigQuery GIS spatial query (ST_DWithin 25m over 72h window) to deduplicate or create incident.
        """
        table_ref = f"{self.project_id}.{self.dataset_id}.incidents"
        submissions_table_ref = f"{self.project_id}.{self.dataset_id}.raw_submissions"

        # 1. Query for nearby matching active incidents within 25 meters in past 72 hours
        query = f"""
            SELECT 
                incident_id, 
                report_count, 
                severity_score, 
                road_class,
                ST_DISTANCE(location, ST_GEOGPOINT(@lng, @lat)) as distance_meters
            FROM `{table_ref}`
            WHERE 
                category = @category
                AND status != 'RESOLVED'
                AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 72 HOUR)
                AND ST_DWITHIN(location, ST_GEOGPOINT(@lng, @lat), 25.0)
            ORDER BY distance_meters ASC
            LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("category", "STRING", vision_result.category),
                bigquery.ScalarQueryParameter("lng", "FLOAT64", lng),
                bigquery.ScalarQueryParameter("lat", "FLOAT64", lat),
            ]
        )
        query_job = self.client.query(query, job_config=job_config)
        results = list(query_job.result())

        submission_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        if results:
            # MATCH FOUND: Deduplicate and update Canonical Incident
            match = results[0]
            canonical_id = match.incident_id
            new_report_count = match.report_count + 1
            matched_distance = float(match.distance_meters)

            # Max severity of existing vs new report
            combined_severity = max(match.severity_score, vision_result.severity_score)
            new_priority = self.calculate_priority(combined_severity, new_report_count, match.road_class or road_class)

            update_query = f"""
                UPDATE `{table_ref}`
                SET 
                    report_count = @report_count,
                    priority_score = @priority_score,
                    severity_score = @severity_score,
                    updated_at = TIMESTAMP(@now)
                WHERE incident_id = @incident_id
            """
            update_job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("report_count", "INT64", new_report_count),
                    bigquery.ScalarQueryParameter("priority_score", "FLOAT64", new_priority),
                    bigquery.ScalarQueryParameter("severity_score", "FLOAT64", combined_severity),
                    bigquery.ScalarQueryParameter("now", "STRING", now),
                    bigquery.ScalarQueryParameter("incident_id", "STRING", canonical_id),
                ]
            )
            self.client.query(update_query, job_config=update_job_config).result()

            # Record raw submission linked to canonical incident
            self._insert_submission(submissions_table_ref, submission_id, canonical_id, citizen_notes, image_url, lat, lng, now)

            return DeduplicationResult(
                is_duplicate=True,
                canonical_incident_id=canonical_id,
                matched_distance_meters=round(matched_distance, 2),
                action_taken="ATTACHED_TO_EXISTING",
                updated_priority_score=new_priority,
                total_reports=new_report_count
            )

        else:
            # NO MATCH: Create new Canonical Incident
            canonical_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
            initial_priority = self.calculate_priority(vision_result.severity_score, 1, road_class)

            insert_query = f"""
                INSERT INTO `{table_ref}` (
                    incident_id, category, status, priority_score, severity_score, 
                    report_count, road_class, hazard_type, location, latitude, longitude, 
                    primary_image_url, created_at, updated_at
                )
                VALUES (
                    @incident_id, @category, 'OPEN', @priority_score, @severity_score,
                    1, @road_class, @hazard_type, ST_GEOGPOINT(@lng, @lat), @lat, @lng,
                    @primary_image_url, TIMESTAMP(@now), TIMESTAMP(@now)
                )
            """
            insert_job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("incident_id", "STRING", canonical_id),
                    bigquery.ScalarQueryParameter("category", "STRING", vision_result.category),
                    bigquery.ScalarQueryParameter("priority_score", "FLOAT64", initial_priority),
                    bigquery.ScalarQueryParameter("severity_score", "FLOAT64", vision_result.severity_score),
                    bigquery.ScalarQueryParameter("road_class", "STRING", road_class),
                    bigquery.ScalarQueryParameter("hazard_type", "STRING", vision_result.hazard_type),
                    bigquery.ScalarQueryParameter("lat", "FLOAT64", lat),
                    bigquery.ScalarQueryParameter("lng", "FLOAT64", lng),
                    bigquery.ScalarQueryParameter("primary_image_url", "STRING", image_url),
                    bigquery.ScalarQueryParameter("now", "STRING", now),
                ]
            )
            self.client.query(insert_query, job_config=insert_job_config).result()

            # Record raw submission
            self._insert_submission(submissions_table_ref, submission_id, canonical_id, citizen_notes, image_url, lat, lng, now)

            return DeduplicationResult(
                is_duplicate=False,
                canonical_incident_id=canonical_id,
                matched_distance_meters=None,
                action_taken="CREATED_NEW",
                updated_priority_score=initial_priority,
                total_reports=1
            )

    def _insert_submission(self, table_ref: str, sub_id: str, can_id: str, notes: str, img: str, lat: float, lng: float, now: str):
        query = f"""
            INSERT INTO `{table_ref}` (
                submission_id, canonical_incident_id, citizen_notes, image_url, location, latitude, longitude, submitted_at
            )
            VALUES (
                @sub_id, @can_id, @notes, @img, ST_GEOGPOINT(@lng, @lat), @lat, @lng, TIMESTAMP(@now)
            )
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("sub_id", "STRING", sub_id),
                bigquery.ScalarQueryParameter("can_id", "STRING", can_id),
                bigquery.ScalarQueryParameter("notes", "STRING", notes or ""),
                bigquery.ScalarQueryParameter("img", "STRING", img or ""),
                bigquery.ScalarQueryParameter("lat", "FLOAT64", lat),
                bigquery.ScalarQueryParameter("lng", "FLOAT64", lng),
                bigquery.ScalarQueryParameter("now", "STRING", now),
            ]
        )
        self.client.query(query, job_config=job_config).result()
