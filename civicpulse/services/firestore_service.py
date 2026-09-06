import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

try:
    from google.cloud import firestore
    FIRESTORE_AVAILABLE = True
except ImportError:
    firestore = None
    FIRESTORE_AVAILABLE = False
    logger.warning("google-cloud-firestore package not installed locally. Using internal in-memory profile store.")


class FirestoreService:
    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
        self.db = None
        self._local_users = {
            "puttasuman27@gmail.com": {
                "uid": "ADM-001",
                "email": "puttasuman27@gmail.com",
                "name": "Sumanth Puttaswamy",
                "role": "MUNICIPAL_COMMISSIONER",
                "assigned_ward": "ALL",
                "designation": "Chief Municipal Operations Officer",
                "is_verified_admin": True
            }
        }

        if FIRESTORE_AVAILABLE:
            try:
                self.db = firestore.Client(project=self.project_id)
                logger.info("Firestore client initialized successfully.")
            except Exception as e:
                logger.warning(f"Firestore initialization fallback: {e}")
                self.db = None

    def get_user_role(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        if self.db:
            try:
                doc_ref = self.db.collection("users").document(clean_email)
                doc = doc_ref.get()
                if doc.exists:
                    return doc.to_dict()
            except Exception as e:
                logger.error(f"Firestore get_user error: {e}")

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
            "email": clean_email,
            "name": name,
            "role": role.upper(),
            "assigned_ward": assigned_ward,
            "designation": designation,
            "is_verified_admin": role.upper() in ["MUNICIPAL_COMMISSIONER", "WARD_OFFICER", "CONTRACTOR", "ADMIN"],
            "updated_at": firestore.SERVER_TIMESTAMP if (self.db and firestore) else None
        }

        if self.db:
            try:
                self.db.collection("users").document(clean_email).set(user_data, merge=True)
            except Exception as e:
                logger.error(f"Firestore set_user error: {e}")

        if not self.db:
            self._local_users[clean_email] = user_data

        return user_data
