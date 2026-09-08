-- Canonical BigQuery Schema: civicpulse_analytics

CREATE TABLE IF NOT EXISTS `civicpulse_analytics.incidents` (
    incident_id STRING NOT NULL,
    category STRING NOT NULL,
    hazard_type STRING,
    road_class STRING,
    latitude FLOAT64 NOT NULL,
    longitude FLOAT64 NOT NULL,
    location GEOGRAPHY,
    severity_score FLOAT64,
    priority_score FLOAT64,
    duplicate_count INT64,
    assigned_department STRING,
    assigned_ward STRING,
    status STRING,
    intake_image_url STRING,
    resolved_image_url STRING,
    sla_deadline TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `civicpulse_analytics.ward_boundaries` (
    ward_id STRING NOT NULL,
    ward_name STRING NOT NULL,
    zone_name STRING,
    boundary_geom GEOGRAPHY NOT NULL
);

CREATE TABLE IF NOT EXISTS `civicpulse_analytics.admins` (
    admin_id STRING NOT NULL,
    name STRING NOT NULL,
    email STRING NOT NULL,
    password_hash STRING NOT NULL,
    role STRING NOT NULL,
    assigned_ward STRING,
    designation STRING,
    created_at TIMESTAMP
);
