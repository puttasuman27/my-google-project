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
        lng: float
    ) -> Dict[str, Any]:
        cat = str(category).upper().strip()

        dept_map = {
            "POTHOLE": "Roads & Highway Infrastructure Dept",
            "ROAD_DAMAGE": "Roads & Highway Infrastructure Dept",
            "DRAINAGE": "Water Supply & Sewerage Board",
            "GARBAGE": "Solid Waste Management Dept",
            "STREETLIGHT": "Municipal Electrical Dept",
            "TRAFFIC_SIGNAL": "Traffic Management Department",
        }
        department = dept_map.get(cat, "Public Works Department")

        if priority_score >= 0.8:
            sla_hours = 12
        elif priority_score >= 0.5:
            sla_hours = 24
        else:
            sla_hours = 48

        deadline = (datetime.now(timezone.utc) + timedelta(hours=sla_hours)).isoformat()
        ward = f"Ward-{int((lat % 1) * 100):02d}"

        return {
            "assigned_department": department,
            "assigned_ward": ward,
            "sla_hours": sla_hours,
            "sla_deadline": deadline
        }