# agents/routing_agent/agent.py

from typing import Dict, Any
from pydantic import BaseModel, Field

class RoutingDecision(BaseModel):
    assigned_department: str = Field(description="Target municipal department")
    priority_level: str = Field(description="Routing priority: CRITICAL, HIGH, MEDIUM, LOW")
    sla_hours: int = Field(description="Target response time in hours")
    auto_dispatch: bool = Field(description="Whether auto-dispatch is enabled")

DEPARTMENT_MAPPING = {
    "Streetlight": "Electrical & Public Lighting Dept",
    "Pothole": "Roads & Public Works Dept",
    "Garbage": "Solid Waste Management Dept",
    "Water Leakage": "Water Supply & Sewerage Board",
    "Default": "General Civic Grievance Dept"
}

def determine_routing_and_priority(category: str, severity: str, safety_hazard: bool) -> RoutingDecision:
    department = DEPARTMENT_MAPPING.get(category, DEPARTMENT_MAPPING["Default"])
    
    # Priority & SLA Logic
    if safety_hazard or severity == "Critical":
        priority = "CRITICAL"
        sla = 4
        auto_dispatch = True
    elif severity == "High":
        priority = "HIGH"
        sla = 12
        auto_dispatch = True
    elif severity == "Medium":
        priority = "MEDIUM"
        sla = 24
        auto_dispatch = False
    else:
        priority = "LOW"
        sla = 48
        auto_dispatch = False

    return RoutingDecision(
        assigned_department=department,
        priority_level=priority,
        sla_hours=sla,
        auto_dispatch=auto_dispatch
    )