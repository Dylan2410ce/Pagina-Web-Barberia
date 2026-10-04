import io
import json
import os
import runpy
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError
from uuid import uuid4

from googleapiclient.errors import HttpError
from httplib2 import Response

from app.config import config
from app.services.brevo_service import BrevoEmailService
from app.services.calendar_service import CalendarError, CalendarService, rfc3339_costa_rica
from app.services.emailjs_service import EmailJSError


class BrevoTests(unittest.TestCase):
    def setUp(self):
        for name, value in {
            "BREVO_API_KEY": "test-only", "BREVO_TEMPLATE_CLIENTE": "1",
            "BREVO_TEMPLATE_BARBERO": "2", "BREVO_SENDER_EMAIL": "sender@example.com",
        }.items():
            patcher = patch.object(config, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.service = BrevoEmailService()
        self.payload = {"to_email": "test@example.com", "client_name": "José & Ana",
                        "maps_url": "https://maps.example.com/?a=1&b=2", "email_subject": "Tu cita"}

    def test_payload_uses_numeric_template_and_unescaped_parameters(self):
        response = MagicMock(status=201)
        response.read.return_value = b'{"messageId":"accepted"}'
        opener = MagicMock()
        opener.return_value.__enter__.return_value = response
        with patch("app.services.brevo_service.urlopen", opener), self.assertLogs("sebas_barber.brevo", level="INFO") as logs:
            self.service.send("1", self.payload, idempotency_key="delivery-id")
        request = opener.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(request.full_url, "https://api.brevo.com/v3/smtp/email")
        self.assertEqual(body["templateId"], 1)
        self.assertEqual(body["params"]["client_name"], "José & Ana")
        self.assertEqual(body["params"]["maps_url"], self.payload["maps_url"])
        self.assertEqual(body["headers"]["idempotencyKey"], "delivery-id")
        self.assertNotIn("test@example.com", str(logs.output))

    def test_missing_confirmation_is_uncertain(self):
        response = MagicMock(status=201)
        response.read.return_value = b'{}'
        with patch("app.services.brevo_service.urlopen") as opener:
            opener.return_value.__enter__.return_value = response
            with self.assertRaises(EmailJSError) as raised:
                self.service.send("1", self.payload)
        self.assertTrue(raised.exception.uncertain)

    def test_rate_limit_rejection_logs_safe_code(self):
        error = HTTPError("https://api.brevo.com", 429, "error", {}, io.BytesIO(b'{"code":"too_many_requests","message":"secret@example.com"}'))
        with patch("app.services.brevo_service.urlopen", side_effect=error), self.assertLogs("sebas_barber.brevo", level="ERROR") as logs:
            with self.assertRaises(EmailJSError) as raised:
                self.service.send("1", self.payload)
        self.assertTrue(raised.exception.retryable)
        self.assertIn("too_many_requests", str(logs.output))
        self.assertNotIn("secret@example.com", str(logs.output))

    def test_transport_failure_is_not_safely_retryable(self):
        with patch("app.services.brevo_service.urlopen", side_effect=URLError("timeout")):
            with self.assertRaises(EmailJSError) as raised:
                self.service.send("1", self.payload)
        self.assertTrue(raised.exception.uncertain)
        self.assertFalse(raised.exception.retryable)

    def test_invalid_configuration_is_not_available(self):
        with patch.object(config, "BREVO_TEMPLATE_CLIENTE", "0"):
            self.assertFalse(self.service.available())
            self.assertIn("BREVO_TEMPLATE_CLIENTE", self.service.configuration_errors())

    def test_render_aliases_and_provider_detection(self):
        with patch.dict(os.environ, {"BREVO_API_KEY": "test-only", "SENDER_EMAIL": "sender@example.com",
                                    "TEMPLATE_ID_CLIENTE": "3", "TEMPLATE_ID_BARBERO": "4"}, clear=True):
            settings = runpy.run_path(str(Path(__file__).parents[1] / "app" / "config.py"))["Config"]()
        self.assertEqual(settings.EMAIL_PROVIDER, "brevo")
        self.assertEqual(settings.BREVO_SENDER_EMAIL, "sender@example.com")
        self.assertEqual(settings.BREVO_TEMPLATE_CLIENTE, "3")
        self.assertEqual(settings.BREVO_TEMPLATE_BARBERO, "4")


class CalendarIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.service = CalendarService()
        self.service.enabled = True
        self.service.service = MagicMock()
        start = datetime(2026, 10, 6, 14, tzinfo=timezone.utc)
        self.appointment = SimpleNamespace(id=uuid4(), starts_at=start, ends_at=start + timedelta(minutes=45),
                                           service_name="Corte Premium", client_name="Cliente", client_phone="88887777",
                                           total_price=6000, notes=None)
        patcher = patch.object(config, "CALENDAR_REQUIRED", True)
        patcher.start()
        self.addCleanup(patcher.stop)

    @staticmethod
    def error(status, reason="forbidden"):
        return HttpError(Response({"status": str(status)}), json.dumps({"error": {"errors": [{"reason": reason}], "message": "secret@example.com"}}).encode())

    def test_strict_timezone_and_stable_id(self):
        insert = self.service.service.events.return_value.insert
        insert.return_value.execute.return_value = {"id": "accepted"}
        self.assertEqual(self.service.create_event("calendar", self.appointment), "accepted")
        body = insert.call_args.kwargs["body"]
        self.assertEqual(body["start"], {"dateTime": "2026-10-06T08:00:00-06:00", "timeZone": "America/Costa_Rica"})
        self.assertEqual(body["end"]["dateTime"], "2026-10-06T08:45:00-06:00")
        self.service.create_event("calendar", self.appointment)
        self.assertEqual(body["id"], insert.call_args.kwargs["body"]["id"])
        self.assertRegex(body["id"], r"^[a-v0-9]{5,1024}$")

    def test_naive_datetime_is_rejected(self):
        with self.assertRaises(ValueError):
            rfc3339_costa_rica(datetime(2026, 10, 6, 8))

    def test_duplicate_insert_recovers_same_booking(self):
        events = self.service.service.events.return_value
        events.insert.return_value.execute.side_effect = self.error(409, "duplicate")
        events.get.return_value.execute.return_value = {
            "extendedProperties": {"private": {"appointment_id": str(self.appointment.id)}},
            "start": {"dateTime": self.appointment.starts_at.isoformat()},
            "end": {"dateTime": self.appointment.ends_at.isoformat()},
        }
        recovered = self.service.create_event("calendar", self.appointment)
        self.assertEqual(recovered, events.insert.call_args.kwargs["body"]["id"])

    def test_forbidden_reports_reason_without_personal_data(self):
        self.service.service.events.return_value.insert.return_value.execute.side_effect = self.error(403)
        with self.assertLogs("sebas_barber.calendar", level="ERROR") as logs:
            with self.assertRaises(CalendarError) as raised:
                self.service.create_event("calendar", self.appointment)
        self.assertEqual(raised.exception.status, 403)
        self.assertIn("reason=forbidden", str(logs.output))
        self.assertNotIn("secret@example.com", str(logs.output))

    def test_already_deleted_event_is_success(self):
        self.service.service.events.return_value.delete.return_value.execute.side_effect = self.error(410, "deleted")
        self.service.delete_event("calendar", "event")

    def test_read_diagnostic_does_not_claim_write_permissions(self):
        result = self.service.check_access("calendar")
        self.assertTrue(result["read_access"])
        self.assertEqual(result["write_access"], "not_verified")
        self.service.service.events.return_value.insert.assert_not_called()

    def test_failed_read_diagnostic_returns_safe_failure(self):
        self.service.service.events.return_value.list.return_value.execute.side_effect = self.error(404, "notFound")
        result = self.service.check_access("calendar")
        self.assertFalse(result["available"])
        self.assertEqual(result["status"], 404)
        self.assertNotIn("secret@example.com", result["message"])
