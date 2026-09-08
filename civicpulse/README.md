# CivicPulse: AI-Driven Municipal Resolution Intelligence Platform

> **Google Cloud & Agentic AI Blueprint for Patchamomma 2026**  
> Transforming municipal infrastructure reporting from a passive complaint log into an active, verifiable **Resolution Intelligence Engine**.

---

## 🏛️ Executive Summary & Value Proposition

Modern municipal grievance systems suffer from critical operational bottlenecks:
1. **Signal-to-Noise Overload**: 50 citizens reporting the same 18cm pothole generate 50 redundant tickets, overwhelming dispatchers.
2. **Subjective Prioritization**: Tickets are prioritized on a first-come, first-served basis rather than empirical risk scoring.
3. **Zero Fix Auditability**: Work orders are closed administratively without physical verification of repair quality.

**CivicPulse** eliminates these bottlenecks using a **closed-loop multi-agent architecture** powered by **Gemini 2.0/3.6 Multimodal Vision**, **BigQuery GIS (50m spatial deduplication)**, **Cloud Pub/Sub**, **Cloud Run**, and **Firebase/Firestore**.

---

## 🏗️ Architecture & Data Flow

                 [ Citizen (Mobile / Web / GPS / Voice) ]
                                   │
                                   ▼
                   [ Google Cloud Run (FastAPI API) ]
                                   │
                                   ▼
                 [ Gemini Multimodal Vision AI ]
                 (Validates authenticity, extracts dimensions)
                                   │
                                   ▼
                   [ Google Cloud Pub/Sub Broker ]
                     (Topic: incident-reports-topic)
                                   │
                                   ▼
                   [ BigQuery GIS Spatial Engine ]
                     (ST_DWithin 50m Deduplication)
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
      [ Existing 50m Cluster? ]             [ New Defect Location ]
      Increment duplicate_count             Insert Canonical Incident
      Boost Priority Score                  ST_WITHIN Ward Polygon Lookup
                 └─────────────────┬─────────────────┘
                                   ▼
                  [ Operations Decision Engine ]
                    (12h/24h/48h SLAs, Department Routing)
                                   │
                                   ▼
               [ Municipal Field Crew / Contractor ]
                    (Dispatched -> En Route)
                                   │
                                   ▼
                 [ Gemini Resolution Agent Audit ]
                    (Before vs. After Photo Diffing)
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
        [ PASS (Confidence ≥ 85%) ]          [ FAIL / INCONCLUSIVE ]
        BigQuery Status -> RESOLVED          Escalate -> Human Review

---

## 🛠️ Google Cloud Technologies Used

| Technology | Product / Service | Architectural Role in CivicPulse |
| :--- | :--- | :--- |
| **Multimodal Vision** | **Gemini 2.0/3.6 Flash** | Real-time image validation, defect classification, structural damage scoring. |
| **Spatial Deduplication** | **BigQuery GIS (`ST_DWithin`)** | 50m spatial cluster matching, query analytics, ward defect partitioning. |
| **Ward Spatial Mapping** | **BigQuery GIS (`ST_WITHIN`)** | Point-in-polygon municipal boundary assignment against `ward_boundaries`. |
| **Event Broker** | **Google Cloud Pub/Sub** | Asynchronous event streaming on `incident-reports-topic` for decoupled ingestion. |
| **Serverless Compute** | **Google Cloud Run** | Containerized Python 3.12 FastAPI backend serving high-throughput REST APIs. |
| **Identity & RBAC** | **Cloud Firestore & IAM** | Role-Based Access Control (Citizens vs. Verified Municipal Commissioners). |
| **Location Engine** | **OpenGIS & Leaflet** | Interactive map picker, geocoding autocomplete, and live reverse-geocoding. |

---

## 🔑 Demo & Admin Credentials

| Field | Value |
| :--- | :--- |
| **Role** | Chief Municipal Operations Commissioner |
| **Officer Name** | Putta Suman |
| **Login Email** | `puttasuman27@gmail.com` |
| **Password** | `12345678` |

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Python 3.12+
- Node.js 18+ & npm
- Google Cloud SDK (`gcloud` CLI)

### 2. Environment Configuration
Create a `.env` file in the project root:
```bash
cp .env.example .env
Configure your environment variables in .env:

GCP_PROJECT_ID=civicpulse-app-505811
BIGQUERY_DATASET=civicpulse_analytics
GEMINI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=your_gemini_api_key_here
DEMO_ADMIN_NAME="Putta Suman"
DEMO_ADMIN_EMAIL=puttasuman27@gmail.com
DEMO_ADMIN_PASSWORD=12345678
PUBSUB_TOPIC_ID=incident-reports-topic
PORT=8000
3. Initialize BigQuery Tables & Ward GIS Polygons
python3 setup_bigquery.py
4. Run the Backend API (FastAPI)
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
API Documentation available at: http://localhost:8000/docs

5. Run the Frontend (React + Vite)
In a separate terminal tab:

cd frontend
npm install
npm run dev
Open http://localhost:5173 in your browser.

🧪 Running Automated Tests
Run the full end-to-end integration and unit test suite:

python3 -m pip install pytest
python3 -m pytest tests/test_e2e_pipeline.py -v
📡 Core API Specification
Endpoint	Method	Description
/health	GET	Health check reporting active BigQuery, Gemini, and Pub/Sub status.
/api/v1/reports	POST	Ingests citizen report, runs Gemini Vision, Pub/Sub stream, and BigQuery 50m GIS dedup.
/api/v1/incidents	GET	Fetches active and resolved incident clusters from BigQuery with ward filters.
/api/v1/incidents/{id}/status	PATCH	Updates work order lifecycle (OPEN -> IN_PROGRESS -> RESOLVED).
/api/v1/incidents/{id}/resolve	POST	Audits contractor repair photo using Gemini Resolution Agent (PASS/FAIL/INCONCLUSIVE).
/api/v1/auth/login	POST	Authenticates municipal officials against SHA-256 BigQuery records and Firestore RBAC.
/api/v1/geocode	GET	Autocompletes search queries into geocoded coordinates and ward boundaries.
/api/v1/reverse-geocode	GET	Resolves lat/lng coordinates into real street addresses.
🔒 Security & Safety Protocol
Fail-Safe AI Resolution: If Gemini times out or is unreachable, the system never automatically approves repairs; it flags the ticket as INCONCLUSIVE for mandatory human supervisor review.
Strict CORS: Origins are strictly restricted to configured production domains (civicpulse-app-505811.web.app).
Cryptographic Security: Passwords and session identities are verified using cryptographic SHA-256 hashes against BigQuery and Firestore.
👥 Authors & License
Built by Putta Suman for the Google Cloud Patchamomma 2026 Open Innovation Challenge.
Licensed under the Apache 2.0 License.
