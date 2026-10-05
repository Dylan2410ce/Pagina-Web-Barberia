"""Límites de entrada antes de Pydantic, uploads y consultas a PostgreSQL."""
import asyncio
import json
from uuid import UUID, uuid4

from app.config import config


class RequestGuardMiddleware:
    def __init__(self, app):
        self.app = app
        self.body_slots = asyncio.Semaphore(8)
        self.upload_slots = asyncio.Semaphore(2)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            request_id = str(UUID(headers.get(b"x-request-id", b"").decode("ascii")))
        except (ValueError, UnicodeError):
            request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def reject(status, code, message):
            payload = json.dumps({"error": {"code": code, "message": message, "details": None}}, ensure_ascii=False).encode()
            await send({"type": "http.response.start", "status": status, "headers": [
                (b"content-type", b"application/json; charset=utf-8"), (b"content-length", str(len(payload)).encode()),
                (b"cache-control", b"no-store"), (b"x-request-id", request_id.encode()),
                (b"x-content-type-options", b"nosniff"), (b"x-frame-options", b"DENY"),
            ]})
            await send({"type": "http.response.body", "body": payload})

        if len(scope.get("query_string", b"")) > 4096:
            return await reject(414, "query_too_long", "La consulta supera el tamaño permitido.")
        method = scope.get("method", "GET")
        if method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await self.app(scope, receive, send)
        if config.DATABASE_MIGRATION_MODE and scope.get("path", "").startswith("/api/"):
            return await reject(503, "maintenance", "Estamos actualizando la agenda. Vuelve en unos minutos.")
        upload = scope.get("path") == "/api/admin/gallery/upload"
        limit = (config.GALLERY_UPLOAD_MAX_MB + 1) * 1024 * 1024 if upload else 64 * 1024
        try:
            length = int(headers.get(b"content-length", b"0"))
            if not 0 <= length <= limit:
                return await reject(413, "payload_too_large", "La solicitud supera el tamaño permitido.")
        except ValueError:
            return await reject(400, "invalid_length", "La solicitud no tiene un tamaño válido.")
        content_type = headers.get(b"content-type", b"").split(b";", 1)[0].strip().lower()
        if (length or headers.get(b"transfer-encoding")) and not upload and content_type != b"application/json":
            return await reject(415, "unsupported_media_type", "Envía los datos en formato JSON.")

        async def read_body():
            chunks = []
            total = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return None
                if message["type"] != "http.request":
                    continue
                chunk = message.get("body", b"")
                total += len(chunk)
                if total > limit:
                    raise OverflowError
                chunks.append(chunk)
                if not message.get("more_body", False):
                    return b"".join(chunks)
        slots = self.upload_slots if upload else self.body_slots
        if slots.locked():
            return await reject(429, "request_capacity", "Hay varias solicitudes en curso. Intenta en unos segundos.")
        try:
            async with slots:
                body = await asyncio.wait_for(read_body(), timeout=60 if upload else 15)
        except OverflowError:
            return await reject(413, "payload_too_large", "La solicitud supera el tamaño permitido.")
        except asyncio.TimeoutError:
            return await reject(408, "request_timeout", "La solicitud tardó demasiado en llegar.")
        if body is None:
            return
        if body and not upload and content_type != b"application/json":
            return await reject(415, "unsupported_media_type", "Envía los datos en formato JSON.")
        consumed = False

        async def replay():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()
        await self.app(scope, replay, send)
