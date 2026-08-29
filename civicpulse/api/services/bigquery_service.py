import os
from typing import Dict, Any, List
from google.cloud import bigquery

DATASET_ID = os.getenv("BIGQUERY_DATASET", "civicpulse_analytics")

class BigQueryService:
    def __init__(self):
        self.client = bigquery.Client()

    def get_recent_incidents(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Fetches recent canonical incidents from BigQuery ordered by latest first."""
        table_id = f"{self.client.project}.{DATASET_ID}.incidents"
        
        query = f"""
        SELECT 
            incident_id,
            category,
            latitude,
            longitude,
            severity_score,
            duplicate_count,
            assigned_ward,
            status,
            created_at,
            updated_at
        FROM `{table_id}`
        ORDER BY created_at DESC
        LIMIT @limit
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("limit", "INT64", limit)
            ]
        )
        
        query_job = self.client.query(query, job_config=job_config)
        results = query_job.result()
        
        cat_images = {
            "Pothole": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80",
            "Streetlight": "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=800&q=80",
            "Drainage": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
            "Garbage": "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80",
        }

        dept_map = {
            "Streetlight": "Electrical & Public Lighting",
            "Pothole": "Public Works Department",
            "Drainage": "Water & Sanitation Unit",
            "Garbage": "Solid Waste Management"
        }

        incidents = []
        for row in results:
            score = float(row.severity_score or 5.0)
            if score >= 8.0:
                severity_label = "P1 - High"
            elif score >= 5.0:
                severity_label = "P2 - Moderate"
            else:
                severity_label = "P3 - Low"

            cat_str = str(row.category) if row.category else "Pothole"
            incidents.append({
                "id": str(row.incident_id),
                "title": f"Reported {cat_str} Flaw",
                "category": cat_str,
                "location": f"{row.assigned_ward} (GPS: {row.latitude:.4f}, {row.longitude:.4f})",
                "ward": str(row.assigned_ward) if row.assigned_ward else "Ward 14 - Central Core",
                "severity": severity_label,
                "severityScore": round(score / 10.0, 2),
                "upvotes": int(row.duplicate_count or 1) * 2,
                "userUpvoted": False,
                "department": dept_map.get(cat_str, "General Municipal Services"),
                "slaCountdown": "04h 15m remaining" if str(row.status) != "CLOSED" else "Resolved",
                "status": "RESOLVED" if str(row.status) in ["CLOSED", "RESOLVED"] else "IN_PROGRESS",
                "reportsMerged": int(row.duplicate_count or 1),
                "image": cat_images.get(cat_str, cat_images["Pothole"]),
                "createdAt": row.created_at.isoformat() if row.created_at else None
            })
            
        return incidents

    def insert_report(self, report_data: Dict[str, Any]) -> bool:
        """Inserts a citizen report into the BigQuery reports fact table."""
        table_id = f"{self.client.project}.{DATASET_ID}.reports"
        
        query = f"""
        INSERT INTO `{table_id}` (
            report_id, incident_id, citizen_id, category, severity_level,
            confidence_score, safety_hazard, image_uri, latitude, longitude,
            location, reported_at
        ) VALUES (
            @report_id, @incident_id, @citizen_id, @category, @severity_level,
            @confidence_score, @safety_hazard, @image_uri, @latitude, @longitude,
            ST_GEOGPOINT(@longitude, @latitude), TIMESTAMP(@reported_at)
        )
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("report_id", "STRING", report_data["report_id"]),
                bigquery.ScalarQueryParameter("incident_id", "STRING", report_data["incident_id"]),
                bigquery.ScalarQueryParameter("citizen_id", "STRING", report_data.get("citizen_id", "anonymous")),
                bigquery.ScalarQueryParameter("category", "STRING", report_data["category"]),
                bigquery.ScalarQueryParameter("severity_level", "STRING", report_data["severity_level"]),
                bigquery.ScalarQueryParameter("confidence_score", "FLOAT64", float(report_data["confidence_score"])),
                bigquery.ScalarQueryParameter("safety_hazard", "BOOL", bool(report_data["safety_hazard"])),
                bigquery.ScalarQueryParameter("image_uri", "STRING", str(report_data.get("image_uri", ""))[:300]),
                bigquery.ScalarQueryParameter("latitude", "FLOAT64", float(report_data["latitude"])),
                bigquery.ScalarQueryParameter("longitude", "FLOAT64", float(report_data["longitude"])),
                bigquery.ScalarQueryParameter("reported_at", "STRING", report_data["reported_at"]),
            ]
        )
        
        query_job = self.client.query(query, job_config=job_config)
        query_job.result()
        print(f"[BigQuery] Inserted report {report_data['report_id']}")
        return True

    def create_or_update_incident(
        self, 
        incident_id: str, 
        category: str, 
        lat: float, 
        lng: float, 
        severity_level: str,
        is_duplicate: bool = False
    ) -> str:
        """Creates or updates a canonical incident cluster in BigQuery."""
        table_id = f"{self.client.project}.{DATASET_ID}.incidents"
        
        severity_map = {"Low": 2.5, "Medium": 5.0, "High": 7.5, "Critical": 10.0}
        numeric_severity = severity_map.get(severity_level, 5.0)

        if is_duplicate:
            query = f"""
            UPDATE `{table_id}`
            SET duplicate_count = duplicate_count + 1,
                severity_score = GREATEST(severity_score, @severity_score),
                updated_at = CURRENT_TIMESTAMP()
            WHERE incident_id = @incident_id
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("incident_id", "STRING", incident_id),
                    bigquery.ScalarQueryParameter("severity_score", "FLOAT64", float(numeric_severity)),
                ]
            )
        else:
            query = f"""
            INSERT INTO `{table_id}` (
                incident_id, category, latitude, longitude, location,
                severity_score, priority_score, duplicate_count, assigned_ward,
                status, created_at, updated_at
            ) VALUES (
                @incident_id, @category, @latitude, @longitude, ST_GEOGPOINT(@longitude, @latitude),
                @severity_score, @priority_score, 1, 'Ward 14 - Central Core',
                'OPEN', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
            )
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("incident_id", "STRING", incident_id),
                    bigquery.ScalarQueryParameter("category", "STRING", category),
                    bigquery.ScalarQueryParameter("latitude", "FLOAT64", float(lat)),
                    bigquery.ScalarQueryParameter("longitude", "FLOAT64", float(lng)),
                    bigquery.ScalarQueryParameter("severity_score", "FLOAT64", float(numeric_severity)),
                    bigquery.ScalarQueryParameter("priority_score", "FLOAT64", float(numeric_severity * 0.4)),
                ]
            )

        query_job = self.client.query(query, job_config=job_config)
        query_job.result()
        print(f"[BigQuery] Updated incident {incident_id}")
        return incident_id