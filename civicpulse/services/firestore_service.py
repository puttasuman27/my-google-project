import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

try:
    from google.cloud import firestore
    FIRESTORE_AVAILABLE = True
except ImportError:
    firestore = None
    FIRESTORE_AVAILABLE = False


class FirestoreService:
    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
        self.db = None
        self._local_users = {
            "puttasuman27@gmail.com": {
                "uid": "ADM-001",
                "admin_id": "ADM-001",
                "email": "puttasuman27@gmail.com",
                "name": "Putta Suman",
                "role": "MUNICIPAL_COMMISSIONER",
                "assigned_ward": "ALL",
                "designation": "Chief Municipal Operations Officer",
                "is_verified_admin": True
            }
        }

        if FIRESTORE_AVAILABLE:
            try:
                if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ and not os.path.exists(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]):
                    os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
                self.db = firestore.Client(project=self.project_id)
                logger.info("Firestore client initialized successfully.")
            except Exception as e:
                logger.warning(f"Firestore initialization notice (using memory cache): {e}")
                self.db = None

    def get_user_role(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        if self.db:
            try:
                doc_ref = self.db.collection("users").document(clean_email)
                doc = doc_ref.get()
                if doc.exists:
                    data = doc.to_dict()
                    data.pop("updated_at", None)
                    return data
            except Exception as e:
                logger.warning(f"Firestore get_user notice: {e}")

        return self._local_users.get(clean_email)

    def set_user_role(
        self,
        email: str,
        name: str,
        role: str = "CITIZEN",
        assigned_ward: str = "Ward-14",
        designation: str = "Citizen Volunteer"
    ) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        
        user_data = {
            "admin_id": "ADM-001" if "puttasuman27" in clean_email else f"ADM-{abs(hash(clean_email)) % 1000:03d}",
            "email": clean_email,
            "name": name,
            "role": role.upper(),
            "assigned_ward": assigned_ward,
            "designation": designation,
            "is_verified_admin": role.upper() in ["MUNICIPAL_COMMISSIONER", "WARD_OFFICER", "CONTRACTOR", "ADMIN"]
        }

        if self.db:
            try:
                db_data = dict(user_data)
                db_data["updated_at"] = firestore.SERVER_TIMESTAMP
                self.db.collection("users").document(clean_email).set(db_data, merge=True)
            except Exception as e:
                logger.warning(f"Firestore write notice: {e}")

        self._local_users[clean_email] = user_data
        return user_data