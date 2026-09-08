import pytest
from pydantic import BaseModel
from agents.incident_agent import IncidentAgent, IncidentClusteringResult, calculate_haversine_distance
from agents.operations_agent import OperationsAgent
from agents.resolution_agent import ResolutionAgent


class MockVisionResult(BaseModel):
    is_valid_civic_issue: bool = True
    category: str = "POTHOLE"
    severity_level: str = "High"
    severity_score: float = 0.88
    hazard_type: str = "Deep Asphalt Cavity"
    estimated_dimensions_m: str = "1.2m x 0.8m"
    confidence_score: float = 0.95


def test_haversine_distance_calculation():
    # 25m distance check
    lat1, lng1 = 17.49367, 78.42035
    lat2, lng2 = 17.49380, 78.42045
    dist = calculate_haversine_distance(lat1, lng1, lat2, lng2)
    assert 0 < dist < 30.0


def test_incident_priority_formula():
    severity = 0.85
    report_count = 3
    road_class = "ARTERIAL"
    
    priority = IncidentAgent.calculate_priority(severity, report_count, road_class)
    # (0.85 * 0.35) + (0.3 * 0.25) + (0.8 * 0.40) = 0.2975 + 0.075 + 0.32 = 0.6925 -> 0.693
    assert priority == pytest.approx(0.693, 0.01)


def test_operations_decision_agent_routing():
    ops = OperationsAgent()
    routing = ops.route_and_assign_sla(
        incident_id="INC-TEST01",
        category="POTHOLE",
        priority_score=0.85,
        lat=17.49367,
        lng=78.42035
    )
    
    assert routing["assigned_department"] == "Roads & Highway Infrastructure Dept"
    assert routing["sla_hours"] == 12
    assert "sla_deadline" in routing
    assert routing["dispatch_priority"] == "CRITICAL"


def test_resolution_agent_fail_safe():
    res_agent = ResolutionAgent()
    # Test with invalid/empty image to verify safe failure
    verdict = res_agent.verify_resolution(after_image_bytes=b"")
    assert verdict.is_resolved is False
    assert verdict.quality_verdict in ["FAIL", "INCONCLUSIVE"]