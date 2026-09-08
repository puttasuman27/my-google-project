-- Standardized Dataset: civicpulse_analytics
CREATE TABLE IF NOT EXISTS `civicpulse_analytics.ward_boundaries` (
    ward_id STRING,
    ward_name STRING,
    zone_name STRING,
    boundary_geom GEOGRAPHY
);

-- Seed Municipal Ward Polygons
INSERT INTO `civicpulse_analytics.ward_boundaries` (ward_id, ward_name, zone_name, boundary_geom)
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