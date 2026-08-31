import os
from datetime import datetime, timedelta, timezone
from google.cloud import bigquery

class OperationsAgent:
    ROAD_CLASS_WEIGHTS = {
        "EXPRESSWAY": 1.0,
        "ARTERIAL": 0.8,
        "COLLECTOR": 0.5,
        "SECONDARY": 0.5,
        "LOCAL": 0.2
    }

    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
        self.dataset_id = os.getenv("BIGQUERY_DATASET", "civicpulse_analytics")
        
        # Safely initialize BigQuery client
        try:
            self.client = bigquery.Client(project=self.project_id) if self.project_id else None
        except Exception as e:
            print(f"BigQuery client initialization note: {e}")
            self.client = None

    def compute_priority(
        self,
        severity_score: float,
        report_count: int = 1,
        road_class: str = "LOCAL"
    ) -> float:
        """
        Calculates dynamic priority score:
        Priority = (Severity * 0.35) + (Normalized Report Count * 0.25) + (Road Class * 0.40)
        """
        road_impact = self.ROAD_CLASS_WEIGHTS.get(road_class.upper(), 0.2)
        report_weight = min(report_count / 10.0, 1.0)  # Capped at 10 reports

        score = (severity_score * 0.35) + (report_weight * 0.25) + (road_impact * 0.40)
        return round(score, 3)

    def route_to_ward(self, lat: float, lng: float) -> str:
        """Determines municipal ward based on geographic coordinates."""
        return f"Ward-{int((lat % 1) * 100):02d}"

    def route_and_assign_sla(
        self,
        incident_id: str,
        category: str,
        priority_score: float,
        lat: float,
        lng: float
    ) -> dict:
        """
        Calculates ward, department, SLA deadlines, and persists updates to BigQuery.
        """
        table_ref = f"{self.project_id}.{self.dataset_id}.incidents"

        # Department routing by category
        dept_map = {
            "POTHOLE": "Roads & Highway Infrastructure Dept",
            "ROAD_CRACK": "Roads & Highway Infrastructure Dept",
            "STREETLIGHT": "Municipal Electrical & Lighting Dept",
            "DRAINAGE_LEAKAGE": "Stormwater & Drainage Maintenance Dept",
            "DRAINAGE": "Stormwater & Drainage Maintenance Dept",
            "GARBAGE": "Solid Waste Management Dept",
            "OTHER": "General Public Works"
        }
        assigned_dept = dept_map.get(category.upper(), "General Public Works")
        ward_id = self.route_to_ward(lat, lng)

        # Dynamic SLA Calculation based on priority
        if priority_score >= 0.8:
            sla_hours = 12
        elif priority_score >= 0.5:
            sla_hours = 48
        else:
            sla_hours = 96

        sla_deadline = (datetime.now(timezone.utc) + timedelta(hours=sla_hours)).isoformat()

        # Update BigQuery incidents table
        if self.client and self.project_id:
            try:
                update_query = f"""
                    UPDATE `{table_ref}`
                    SET 
                        assigned_ward = @ward,
                        sla_deadline = TIMESTAMP(@sla_deadline),
                        status = 'ASSIGNED',
                        updated_at = CURRENT_TIMESTAMP()
                    WHERE incident_id = @incident_id
                """
                job_config = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ScalarQueryParameter("ward", "STRING", ward_id),
                        bigquery.ScalarQueryParameter("sla_deadline", "STRING", sla_deadline),
                        bigquery.ScalarQueryParameter("incident_id", "STRING", incident_id),
                    ]
                )
                self.client.query(update_query, job_config=job_config).result()
            except Exception as e:
                print(f"Note: Table update skipped or schema difference: {e}")

        return {
            "incident_id": incident_id,
            "assigned_ward": ward_id,
            "assigned_department": assigned_dept,
            "sla_hours": sla_hours,
            "sla_deadline": sla_deadline
        }

__all__ = ["OperationsAgent"]