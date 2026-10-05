import json
import asyncio
import unittest
from unittest.mock import patch
from uuid import UUID

from app.config import config
from app.middleware.request_guard import RequestGuardMiddleware
from app.services.rate_limit_service import BurstLimiter
from app.tasks.reminder_cron import run_delivery_job
from app.main import unexpected_exception_handler
from starlette.requests import Request


class RequestGuardTests(unittest.IsolatedAsyncioTestCase):
    async def run_request(self, chunks=(), headers=(), method="POST", path="/api/public/appointments", query=b"", capacity=8):
        messages = []
        seen = []
        incoming = [{"type": "http.request", "body": chunk, "more_body": index < len(chunks) - 1} for index, chunk in enumerate(chunks)] or [{"type": "http.request", "body": b"", "more_body": False}]

        async def receive():
            return incoming.pop(0) if incoming else {"type": "http.disconnect"}

        async def send(message):
            messages.append(message)

        async def endpoint(scope, receive, send):
            seen.append(scope["state"]["request_id"])
            if method == "POST":
                seen.append((await receive())["body"])
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

        scope = {"type": "http", "method": method, "path": path, "query_string": query, "headers": list(headers)}
        middleware = RequestGuardMiddleware(endpoint)
        middleware.body_slots = asyncio.Semaphore(capacity)
        await middleware(scope, receive, send)
        return messages, seen

    async def test_chunked_body_cannot_bypass_size_limit(self):
        messages, seen = await self.run_request([b"a" * 40000, b"b" * 40000], [(b"content-type", b"application/json")])
        self.assertEqual(messages[0]["status"], 413)
        self.assertEqual(seen, [])

    async def test_body_is_replayed_without_changes(self):
        messages, seen = await self.run_request([b'{"name":', b'"Cliente"}'], [(b"content-type", b"application/json")])
        self.assertEqual(messages[0]["status"], 200)
        self.assertEqual(seen[1], b'{"name":"Cliente"}')

    async def test_unknown_content_type_and_invalid_length_rejected(self):
        messages, _ = await self.run_request([b"x"], [(b"content-type", b"text/plain")])
        self.assertEqual(messages[0]["status"], 415)
        messages, _ = await self.run_request(headers=[(b"content-length", b"invalid")])
        self.assertEqual(messages[0]["status"], 400)

    async def test_request_id_cannot_inject_log_content(self):
        _, seen = await self.run_request(headers=[(b"x-request-id", b"private-client-email@example.com")], method="GET")
        UUID(seen[0])
        self.assertNotIn("@", seen[0])

    async def test_long_query_rejected(self):
        messages, _ = await self.run_request(method="GET", query=b"a" * 4097)
        self.assertEqual(messages[0]["status"], 414)

    async def test_busy_body_reader_rejects_without_buffering_more_requests(self):
        messages, seen = await self.run_request(capacity=0)
        self.assertEqual(messages[0]["status"], 429)
        self.assertEqual(seen, [])

    async def test_migration_blocks_mutations_but_keeps_read_access(self):
        with patch.object(config, "DATABASE_MIGRATION_MODE", True):
            messages, seen = await self.run_request()
            self.assertEqual(messages[0]["status"], 503)
            self.assertEqual(json.loads(messages[1]["body"])["error"]["code"], "maintenance")
            self.assertEqual(seen, [])
            messages, _ = await self.run_request(method="GET")
            self.assertEqual(messages[0]["status"], 200)

    async def test_migration_does_not_dispatch_emails(self):
        with patch.object(config, "DATABASE_MIGRATION_MODE", True), patch("app.tasks.reminder_cron.AsyncSessionLocal") as sessions:
            self.assertEqual(await run_delivery_job(), {"paused": True})
            sessions.assert_not_called()

    async def test_error_response_preserves_cors_only_for_allowed_origins(self):
        for origin, allowed in [(config.FRONTEND_URL, True), ("https://malicious.example", False)]:
            request = Request({"type": "http", "method": "GET", "path": "/api/test", "headers": [(b"origin", origin.encode())]})
            response = await unexpected_exception_handler(request, ValueError("private-data"))
            self.assertEqual("access-control-allow-origin" in response.headers, allowed)
            self.assertNotIn("private-data", response.body.decode())


class BurstLimiterTests(unittest.TestCase):
    def test_burst_limit_recovers_and_memory_is_bounded(self):
        limiter = BurstLimiter(limit=2, window_seconds=10, max_entries=2)
        self.assertTrue(limiter.allow("a", 0))
        self.assertTrue(limiter.allow("a", 1))
        self.assertFalse(limiter.allow("a", 2))
        self.assertTrue(limiter.allow("a", 10))
        limiter.allow("b", 11)
        limiter.allow("c", 11)
        self.assertEqual(len(limiter.buckets), 2)
