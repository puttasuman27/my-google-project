import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Any


class OperationsAgent:
    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")

    def route_and_assign_sla(
        self,
        incident_id: str,
        category: str,
        priority_score: float,
        lat: float,
        lng: float,
        ward_name: str = "Ward 14 - Central Core"
    ) -> Dict[str, Any]:
        """
        Operations Decision Engine:
        Applies deterministic municipal governance rules for department routing,
        SLA enforcement, dispatch priority, and recommended crew sizing.
        """
        cat = str(category).upper().strip()

        # 1. Deterministic Municipal Department Routing
        dept_map = {
            "POTHOLE": "Roads & Highway Infrastructure Dept",
            "ROAD_DAMAGE": "Roads & Highway Infrastructure Dept",
            "DRAINAGE": "Water Supply & Sewerage Board",
            "GARBAGE": "Solid Waste Management Dept",
            "STREETLIGHT": "Municipal Electrical Dept",
            "TRAFFIC_SIGNAL": "Traffic Management Department",
        }
        department = dept_map.get(cat, "Public Works Department")

        # 2. SLA & Escalation Tier Decision Rules
        if priority_score >= 0.8:
            sla_hours = 12
            dispatch_priority = "CRITICAL"
            recommended_crew_size = 4
            escalation_tier = "EXECUTIVE_ESCALATION"
        elif priority_score >= 0.5:
            sla_hours = 24
            dispatch_priority = "HIGH"
            recommended_crew_size = 2
            escalation_tier = "ZONAL_SUPERINTENDENT"
        else:
            sla_hours = 48
            dispatch_priority = "STANDARD"
            recommended_crew_size = 2
            escalation_tier = "WARD_INSPECTOR"

        deadline = (datetime.now(timezone.utc) + timedelta(hours=sla_hours)).isoformat()

        return {
            "assigned_department": department,
            "assigned_ward": ward_name,
            "dispatch_priority": dispatch_priority,
            "priority_level": "Critical" if priority_score >= 0.8 else ("High" if priority_score >= 0.5 else "Medium"),
            "sla_hours": sla_hours,
            "sla_deadline": deadline,
            "recommended_crew_size": recommended_crew_size,
            "escalation_tier": escalation_tier
        }