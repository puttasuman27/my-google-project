from google.adk import Agent
from schemas.report import VisionAnalysisResult

vision_agent = Agent(
    name="vision_agent",
    model="gemini-2.5-flash",
    instruction="Analyze civic issue photos and output structured inspection JSON.",
    response_schema=VisionAnalysisResult
)