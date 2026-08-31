import sys
from pathlib import Path

# Ensure project root is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from agents import VisionAgent, IncidentAgent, OperationsAgent, ResolutionAgent

def test_e2e_scenarios():
    print("==================================================")
    print(" CIVICPULSE MULTI-AGENT E2E SCENARIO VALIDATION  ")
    print("==================================================")

    # 1. Deduplication Engine Test (25m proximity)
    incident_agent = IncidentAgent()
    existing_reports = [
        {"id": "INC-BANGALORE-01", "lat": 12.971598, "lng": 77.594562, "category": "Pothole", "status": "OPEN"}
    ]
    # Point ~10m away
    dup_check = incident_agent.evaluate_deduplication(12.971650, 77.594590, "Pothole", existing_reports)
    print(f"\n[Test 1] Spatial Clustering: {dup_check['action']} (Distance: {dup_check['distance_m']}m)")
    assert dup_check["is_duplicate"] is True

    # 2. Operations Dynamic Priority Test
    ops_agent = OperationsAgent()
    prio_arterial = ops_agent.compute_priority(severity_score=0.85, report_count=4, road_class="ARTERIAL")
    prio_local = ops_agent.compute_priority(severity_score=0.85, report_count=1, road_class="LOCAL")
    print(f"[Test 2] Priority Engine: Arterial Road ({prio_arterial}) vs Local Road ({prio_local})")
    assert prio_arterial > prio_local

    print("\n All local agent logic tests passed successfully!")

if __name__ == "__main__":
    test_e2e_scenarios()