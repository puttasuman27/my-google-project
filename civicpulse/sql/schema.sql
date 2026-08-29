-- Create BigQuery Dataset in asia-south1 if it does not exist
CREATE SCHEMA IF NOT EXISTS `civicpulse_analytics`
OPTIONS(location="asia-south1");

-- Reports Fact Table
CREATE TABLE IF NOT EXISTS `civicpulse_analytics.reports` (
  report_id STRING NOT NULL,
  incident_id STRING NOT NULL,
  citizen_id STRING,
  category STRING,
  severity_level STRING,
  confidence_score FLOAT64,
  safety_hazard BOOL,
  image_uri STRING,
  latitude FLOAT64,
  longitude FLOAT64,
  location GEOGRAPHY,
  reported_at TIMESTAMP
)
PARTITION BY DATE(reported_at)
CLUSTER BY category;

-- Incidents Canonical Table
CREATE TABLE IF NOT EXISTS `civicpulse_analytics.incidents` (
  incident_id STRING NOT NULL,
  category STRING,
  latitude FLOAT64,
  longitude FLOAT64,
  location GEOGRAPHY,
  severity_score FLOAT64,
  priority_score FLOAT64,
  duplicate_count INT64,
  assigned_ward STRING,
  status STRING, -- OPEN, ASSIGNED, ESCALATED, RESOLVED_PENDING, CLOSED
  sla_deadline TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITION BY DATE(created_at)
CLUSTER BY assigned_ward, status;