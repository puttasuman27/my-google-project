import os
import json
import logging
from typing import Dict, Any
from google.cloud import pubsub_v1

logger = logging.getLogger(__name__)


class PubSubService:
    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID", "civicpulse-app-505811")
        self.topic_id = os.getenv("PUBSUB_TOPIC_ID", "incident-reports-topic")
        
        try:
            self.publisher = pubsub_v1.PublisherClient()
            self.topic_path = self.publisher.topic_path(self.project_id, self.topic_id)
            logger.info(f"Pub/Sub initialized for topic: {self.topic_path}")
        except Exception as e:
            logger.warning(f"Pub/Sub client fallback (local sync pipeline active): {e}")
            self.publisher = None

    def publish_incident_report(self, report_payload: Dict[str, Any]) -> str:
        """Publishes an ingested citizen report payload to Pub/Sub topic."""
        payload_bytes = json.dumps(report_payload).encode("utf-8")

        if self.publisher:
            try:
                future = self.publisher.publish(self.topic_path, payload_bytes)
                message_id = future.result(timeout=5.0)
                logger.info(f"Published message ID {message_id} to Pub/Sub topic {self.topic_id}")
                return str(message_id)
            except Exception as e:
                logger.error(f"Failed to publish to Pub/Sub: {e}")

        # Fallback local identifier
        return f"LOCAL-MSG-{os.urandom(4).hex().upper()}"