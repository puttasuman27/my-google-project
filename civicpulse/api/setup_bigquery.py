import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID")
DATASET_ID = os.getenv("BIGQUERY_DATASET", "civicpulse_data")

def init_bigquery():
    client = bigquery.Client(project=PROJECT_ID)
    dataset_ref = f"{PROJECT_ID}.{DATASET_ID}"
    
    # 1. Create Dataset if not exists
    dataset = bigquery.Dataset(dataset_ref)
    dataset.location = "US"
    dataset = client.create_dataset(dataset, exists_ok=True)
    print(f"[OK] Dataset {dataset_ref} verified/created.")

    # 2. Canonical Incidents Table
    incidents_table_id = f"{dataset_ref}.incidents"
    incidents_schema = [
        bigquery.SchemaField("incident_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("priority_score", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("severity_score", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("report_count", "INT64", mode="REQUIRED"),
        bigquery.SchemaField("road_class", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("hazard_type", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("location", "GEOGRAPHY", mode="REQUIRED"),
        bigquery.SchemaField("latitude", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("longitude", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("primary_image_url", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("assigned_ward", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("assigned_department", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("sla_deadline", "TIMESTAMP", mode="NULLABLE"),
        bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED"),
    ]
    incidents_table = bigquery.Table(incidents_table_id, schema=incidents_schema)
    client.create_table(incidents_table, exists_ok=True)
    print(f"[OK] Table {incidents_table_id} verified/created.")

    # 3. Raw Citizen Submissions Table (Evidence Trail)
    submissions_table_id = f"{dataset_ref}.raw_submissions"
    submissions_schema = [
        bigquery.SchemaField("submission_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("canonical_incident_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("citizen_notes", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("image_url", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("location", "GEOGRAPHY", mode="REQUIRED"),
        bigquery.SchemaField("latitude", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("longitude", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("submitted_at", "TIMESTAMP", mode="REQUIRED"),
    ]
    submissions_table = bigquery.Table(submissions_table_id, schema=submissions_schema)
    client.create_table(submissions_table, exists_ok=True)
    print(f"[OK] Table {submissions_table_id} verified/created.")

    # 4. Contractor Resolution Verifications Table
    verifications_table_id = f"{dataset_ref}.resolution_verifications"
    verifications_schema = [
        bigquery.SchemaField("verification_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("canonical_incident_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("contractor_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("verdict", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("confidence_score", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("reasoning", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("before_image_url", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("after_image_url", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("verified_at", "TIMESTAMP", mode="REQUIRED"),
    ]
    verifications_table = bigquery.Table(verifications_table_id, schema=verifications_schema)
    client.create_table(verifications_table, exists_ok=True)
    print(f"[OK] Table {verifications_table_id} verified/created.")

if __name__ == "__main__":
    init_bigquery()