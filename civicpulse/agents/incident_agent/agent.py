# agents/incident_agent/agent.py

import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Dynamically ensure project root directory is on sys.path
project_root = Path(__file__).resolve().parents[2]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

load_dotenv()

from google.adk.agents import Agent
from schemas.incident import IncidentMatchResult


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Calculates the great-circle distance between two GPS coordinates in meters.

    Args:
        lat1: Latitude of the first coordinate point.
        lon1: Longitude of the first coordinate point.
        lat2: Latitude of the second coordinate point.
        lon2: Longitude of the second coordinate point.

    Returns:
        float: Distance between points in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def evaluate_spatial_deduplication(
    report_category: str,
    report_lat: float,
    report_lng: float,
    active_incidents: List[Dict[str, Any]],
    max_radius_meters: float = 50.0,
) -> IncidentMatchResult:
    """Evaluates active municipal incidents against new report parameters to detect
    duplicates within a specified geographical radius.

    Args:
        report_category: Issue category (e.g., 'Pothole', 'Streetlight', 'Drainage').
        report_lat: Latitude of the incoming report.
        report_lng: Longitude of the incoming report.
        active_incidents: List of currently open/active incident dictionaries containing
            'incident_id', 'category', 'latitude', and 'longitude'.
        max_radius_meters: Search radius in meters for deduplication (default 50.0).

    Returns:
        IncidentMatchResult: Structured result indicating duplicate status, matching ID,
            confidence score, and explanation.
    """
    candidate_matches = []

    for incident in active_incidents:
        # Require matching category before evaluating distance
        if incident.get("category") != report_category:
            continue

        try:
            inc_lat = float(incident["latitude"])
            inc_lng = float(incident["longitude"])
        except (KeyError, TypeError, ValueError):
            continue

        distance = calculate_haversine_distance(
            report_lat,
            report_lng,
            inc_lat,
            inc_lng,
        )

        if distance <= max_radius_meters:
            candidate_matches.append((distance, incident))

    if not candidate_matches:
        return IncidentMatchResult(
            is_duplicate=False,
            matched_incident_id=None,
            confidence=0.98,
            explanation=(
                f"No active '{report_category}' incidents detected within "
                f"{max_radius_meters}m radius. Initializing new canonical incident."
            ),
            distance_meters=None,
        )

    # Select closest matching incident within threshold
    candidate_matches.sort(key=lambda item: item[0])
    closest_dist, matched_incident = candidate_matches[0]

    # Calculate confidence based on proximity relative to max radius
    proximity_confidence = min(
        1.0, max(0.70, 1.0 - (closest_dist / max_radius_meters) * 0.3)
    )

    return IncidentMatchResult(
        is_duplicate=True,
        matched_incident_id=str(matched_incident["incident_id"]),
        confidence=round(proximity_confidence, 2),
        explanation=(
            f"Merged report into active incident '{matched_incident['incident_id']}'. "
            f"Located {closest_dist:.1f}m away with matching category '{report_category}'."
        ),
        distance_meters=round(closest_dist, 2),
    )


# Configure ADK Agent for Incident Intelligence & Deduplication
incident_agent = Agent(
    name="incident_agent",
    model="gemini-3.6-flash",
    instruction=(
        "You are the Incident Intelligence & Spatial Deduplication Agent for CivicPulse AI. "
        "Your mission is to process incoming citizen reports, evaluate active incidents within a 50-meter radius, "
        "and determine whether a report is a duplicate that should be consolidated into an existing canonical incident "
        "or if a new incident record must be established. Produce strictly structured JSON decisions matching IncidentMatchResult."
    ),
    output_schema=IncidentMatchResult,
    tools=[calculate_haversine_distance, evaluate_spatial_deduplication],
)

# Root entrypoint for ADK web loader
root_agent = incident_agent