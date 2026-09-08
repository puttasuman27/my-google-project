import os
import sys
import logging
from google.cloud import bigquery

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("setup_bigquery")

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
DATASET_ID = os.getenv("BIGQUERY_DATASET", "civicpulse_analytics")


def setup_canonical_bigquery_tables():
    if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ and not os.path.exists(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]):
        os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

    client = bigquery.Client(project=PROJECT_ID)

    # 1. Dataset Verification
    dataset_ref = bigquery.DatasetReference(PROJECT_ID, DATASET_ID)
    dataset = bigquery.Dataset(dataset_ref)
    dataset.location = "US"
    try:
        client.create_dataset(dataset, exists_ok=True)
        logger.info(f"✅ BigQuery Dataset verified: `{PROJECT_ID}.{DATASET_ID}`")
    except Exception as e:
        logger.error(f"Dataset notice: {e}")

    # 2. Incidents Table Schema
    incidents_table_id = f"{PROJECT_ID}.{DATASET_ID}.incidents"
    incidents_schema = [
        bigquery.SchemaField("incident_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("latitude", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("longitude", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("location", "GEOGRAPHY", mode="NULLABLE"),
        bigquery.SchemaField("severity_score", "FLOAT64", mode="NULLABLE"),
        bigquery.SchemaField("priority_score", "FLOAT64", mode="NULLABLE"),
        bigquery.SchemaField("duplicate_count", "INT64", mode="NULLABLE"),
        bigquery.SchemaField("assigned_ward", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("status", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("intake_image_url", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("resolved_image_url", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("sla_deadline", "TIMESTAMP", mode="NULLABLE"),
        bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
        bigquery.SchemaField("updated_at", "TIMESTAMP", mode="NULLABLE"),
    ]
    incidents_table = bigquery.Table(incidents_table_id, schema=incidents_schema)
    client.create_table(incidents_table, exists_ok=True)
    logger.info(f"✅ BigQuery Table verified: `{incidents_table_id}`")

    # 3. Ward Boundaries Schema
    ward_table_id = f"{PROJECT_ID}.{DATASET_ID}.ward_boundaries"
    ward_schema = [
        bigquery.SchemaField("ward_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("ward_name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("zone_name", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("boundary_geom", "GEOGRAPHY", mode="REQUIRED"),
    ]
    ward_table = bigquery.Table(ward_table_id, schema=ward_schema)
    client.create_table(ward_table, exists_ok=True)
    logger.info(f"✅ BigQuery Table verified: `{ward_table_id}`")

    # 4. Admins Table Schema
    admins_table_id = f"{PROJECT_ID}.{DATASET_ID}.admins"
    admins_schema = [
        bigquery.SchemaField("admin_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("email", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("password_hash", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("role", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("assigned_ward", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("designation", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
    ]
    admins_table = bigquery.Table(admins_table_id, schema=admins_schema)
    client.create_table(admins_table, exists_ok=True)
    logger.info(f"✅ BigQuery Table verified: `{admins_table_id}`")


if __name__ == "__main__":
    setup_canonical_bigquery_tables()
