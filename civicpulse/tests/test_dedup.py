# tests/test_dedup.py

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from agents.incident_agent.agent import (
    calculate_haversine_distance,
    evaluate_spatial_deduplication,
)

# Coordinates for testing (Mumbai region)
BASE_LAT, BASE_LNG = 19.0760, 72.8777

# Mock Active Incidents in Firestore/BigQuery
mock_active_incidents = [
    {
        "incident_id": "INC-1001",
        "category": "Streetlight",
        "latitude": 19.0762,  # ~25 meters away from base
        "longitude": 72.8778,
    },
    {
        "incident_id": "INC-1002",
        "category": "Pothole",
        "latitude": 19.0761,  # ~15 meters away from base
        "longitude": 72.8777,
    },
    {
        "incident_id": "INC-1003",
        "category": "Pothole",
        "latitude": 19.0800,  # ~500 meters away (Far)
        "longitude": 72.8800,
    },
]


def run_tests():
    print("\n--- TEST 1: Haversine Distance Check ---")
    dist = calculate_haversine_distance(BASE_LAT, BASE_LNG, 19.0762, 72.8778)
    print(f"Calculated Distance: {dist:.2f} meters")
    assert dist > 0, "Distance calculation failed!"

    print("\n--- TEST 2: Duplicate Detection (Pothole within 15m) ---")
    result_dup = evaluate_spatial_deduplication(
        report_category="Pothole",
        report_lat=BASE_LAT,
        report_lng=BASE_LNG,
        active_incidents=mock_active_incidents,
        max_radius_meters=50.0,
    )
    print(result_dup.model_dump_json(indent=2))
    assert result_dup.is_duplicate is True
    assert result_dup.matched_incident_id == "INC-1002"

    print("\n--- TEST 3: Category Mismatch Check (Streetlight vs Pothole) ---")
    result_cat = evaluate_spatial_deduplication(
        report_category="Drainage",
        report_lat=BASE_LAT,
        report_lng=BASE_LNG,
        active_incidents=mock_active_incidents,
        max_radius_meters=50.0,
    )
    print(result_cat.model_dump_json(indent=2))
    assert result_cat.is_duplicate is False

    print("\n--- TEST 4: Out of Radius Check (>50m away) ---")
    result_far = evaluate_spatial_deduplication(
        report_category="Pothole",
        report_lat=19.0850,
        report_lng=72.8900,
        active_incidents=mock_active_incidents,
        max_radius_meters=50.0,
    )
    print(result_far.model_dump_json(indent=2))
    assert result_far.is_duplicate is False

    print("\n ALL TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_tests()