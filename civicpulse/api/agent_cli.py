import os
import sys
import json
import argparse
from dotenv import load_dotenv

load_dotenv()

AGENT_TEMPLATE = '''import os
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

class {class_prefix}Result(BaseModel):
    status: str = Field(..., description="Execution status: SUCCESS | FAILED")
    summary: str = Field(..., description="Summary of the agent action")
    data: dict = Field(default_factory=dict, description="Structured agent payload")

class {class_prefix}Agent:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set.")
        self.client = genai.Client(api_key=api_key)

    def execute(self, prompt: str) -> {class_prefix}Result:
        response = self.client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema={class_prefix}Result,
                temperature=0.1
            )
        )
        return {class_prefix}Result.model_validate_json(response.text)
'''

def create_agent(agent_name: str):
    """Scaffolds a new agent file directly from command line."""
    agents_dir = os.path.join(os.path.dirname(__file__), "agents")
    os.makedirs(agents_dir, exist_ok=True)
    
    # Clean name (e.g. resolution_agent -> Resolution)
    clean_name = agent_name.lower().replace("_agent", "").replace(".py", "")
    file_name = f"{clean_name}_agent.py"
    file_path = os.path.join(agents_dir, file_name)
    
    if os.path.exists(file_path):
        print(f"⚠️  Agent file '{file_name}' already exists at {file_path}")
        return
    
    class_prefix = clean_name.capitalize()
    content = AGENT_TEMPLATE.format(class_prefix=class_prefix)
    
    with open(file_path, "w") as f:
        f.write(content)
        
    print(f"✨ Successfully created new agent: agents/{file_name}")
    print(f"   Class: {class_prefix}Agent")
    print(f"   Schema: {class_prefix}Result")

def run_resolution(intake_img: str, repair_img: str):
    """Runs the Resolution Agent on before/after photos"""
    from agents.resolution_agent import ResolutionAgent
    if not os.path.exists(intake_img) or not os.path.exists(repair_img):
        print("❌ Error: Both intake and completion image files must exist.")
        return
    
    print(f"🔬 [Resolution Agent] Comparing Before: {intake_img} vs After: {repair_img}...")
    agent = ResolutionAgent()
    with open(intake_img, "rb") as f1, open(repair_img, "rb") as f2:
        res = agent.verify_repair(f1.read(), f2.read())
    print("\n✅ Verification Verdict:")
    print(json.dumps(res.model_dump(), indent=2))

def run_operations(incident_id: str, category: str, priority: float, lat: float, lng: float):
    """Runs the Operations Agent to calculate routing and SLA"""
    from agents.operations_agent import OperationsAgent
    print(f"⚙️ [Operations Agent] Routing Incident: {incident_id} ({category})...")
    agent = OperationsAgent()
    res = agent.route_and_assign_sla(incident_id, category, priority, lat, lng)
    print("\n✅ Operations Routing Output:")
    print(json.dumps(res, indent=2))

def main():
    parser = argparse.ArgumentParser(description="CivicPulse Agent CLI & Scaffolding Tool")
    subparsers = parser.add_subparsers(dest="command")

    # 1. CREATE COMMAND: Scaffold any new agent
    create_parser = subparsers.add_parser("create", help="Create/Scaffold a new Agent file")
    create_parser.add_argument("--name", required=True, help="Agent name (e.g. resolution_agent, weather_agent)")

    # 2. RUN RESOLUTION
    res_parser = subparsers.add_parser("run-resolution", help="Run Resolution Agent on before/after images")
    res_parser.add_argument("--before", required=True, help="Intake defect image path")
    res_parser.add_argument("--after", required=True, help="Completion repair image path")

    # 3. RUN OPERATIONS
    ops_parser = subparsers.add_parser("run-operations", help="Run Operations Agent for SLA & routing")
    ops_parser.add_argument("--incident-id", default="INC-001", help="Incident ID")
    ops_parser.add_argument("--category", default="POTHOLE", help="Defect category")
    ops_parser.add_argument("--priority", type=float, default=0.85, help="Priority score")
    ops_parser.add_argument("--lat", type=float, default=12.9716, help="Latitude")
    ops_parser.add_argument("--lng", type=float, default=77.5946, help="Longitude")

    args = parser.parse_args()

    if args.command == "create":
        create_agent(args.name)
    elif args.command == "run-resolution":
        run_resolution(args.before, args.after)
    elif args.command == "run-operations":
        run_operations(args.incident_id, args.category, args.priority, args.lat, args.lng)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()