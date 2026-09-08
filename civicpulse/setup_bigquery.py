import os
import sys
import hashlib
import logging
from google.cloud import bigquery

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("setup_bigquery")

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
DATASET_ID = os.getenv("BIGQUERY_DATASET", "civicpulse_analytics")


def hash_password(password: str) -> str:
    """Computes SHA-256 cryptographic hash for secure database storage."""
    return hashlib.sha256(password.strip().encode("utf-8")).hexdigest()


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
        logger.info(f"Dataset notice: {e}")

    # 2. Incidents Table Schema
    incidents_table_id = f"{PROJECT_ID}.{DATASET_ID}.incidents"
    incidents_schema = [
        bigquery.SchemaField("incident_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("hazard_type", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("road_class", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("latitude", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("longitude", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("location", "GEOGRAPHY", mode="NULLABLE"),
        bigquery.SchemaField("severity_score", "FLOAT64", mode="NULLABLE"),
        bigquery.SchemaField("priority_score", "FLOAT64", mode="NULLABLE"),
        bigquery.SchemaField("duplicate_count", "INT64", mode="NULLABLE"),
        bigquery.SchemaField("assigned_department", "STRING", mode="NULLABLE"),
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
    logger.info(f"✅ Incidents table verified: `{incidents_table_id}`")

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
    logger.info(f"✅ Ward boundaries table verified: `{ward_table_id}`")

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
    logger.info(f"✅ Admins table verified: `{admins_table_id}`")

    # 5. Seed Municipal Ward GIS Polygons
    seed_wards_sql = f"""
        DELETE FROM `{ward_table_id}` WHERE 1=1;
        INSERT INTO `{ward_table_id}` (ward_id, ward_name, zone_name, boundary_geom)
        VALUES
        (
            "WARD-14", "Ward 14 - Central Core", "Central Zone",
            ST_GEOGFROMTEXT('POLYGON((78.410 17.485, 78.435 17.485, 78.435 17.505, 78.410 17.505, 78.410 17.485))')
        ),
        (
            "WARD-49", "Ward 49 - West District", "West Zone",
            ST_GEOGFROMTEXT('POLYGON((78.435 17.485, 78.460 17.485, 78.460 17.505, 78.435 17.505, 78.435 17.485))')
        ),
        (
            "WARD-94", "Ward 94 - North Commercial", "North Zone",
            ST_GEOGFROMTEXT('POLYGON((78.410 17.505, 78.460 17.505, 78.460 17.530, 78.410 17.530, 78.410 17.505))')
        );
    """
    client.query(seed_wards_sql).result()
    logger.info("✅ Municipal Ward GIS Polygons seeded.")

    # 6. Seed Administrator Profiles using Cryptographic SHA-256 Hashes
    admin_pass = os.getenv("DEMO_ADMIN_PASSWORD", "putta_admin_2026")
    admin_hash = hash_password(admin_pass)

    seed_admin_sql = f"""
        DELETE FROM `{admins_table_id}` WHERE email IN ("puttasuman27@gmail.com", "ananya.ward14@civicpulse.org");
        INSERT INTO `{admins_table_id}` 
        (admin_id, name, email, password_hash, role, assigned_ward, designation, created_at)
        VALUES 
        (
            "ADM-001",
            "Putta Suman",
            "puttasuman27@gmail.com",
            "{admin_hash}",
            "MUNICIPAL_COMMISSIONER",
            "ALL",
            "Chief Municipal Operations Commissioner",
            CURRENT_TIMESTAMP()
        ),
        (
            "ADM-002",
            "Ananya Sharma",
            "ananya.ward14@civicpulse.org",
            "{admin_hash}",
            "WARD_OFFICER",
            "Ward 14 - Central Core",
            "Ward 14 Zonal Superintendent",
            CURRENT_TIMESTAMP()
        );
    """
    client.query(seed_admin_sql).result()
    logger.info("✅ Administrator profiles securely seeded with cryptographic SHA-256 hashes.")


if __name__ == "__main__":
    setup_canonical_bigquery_tables()
