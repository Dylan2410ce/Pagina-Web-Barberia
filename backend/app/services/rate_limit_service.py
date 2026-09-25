import hashlib
import hmac
import ipaddress
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import SQLAlchemyError

from app.config import config
from app.database import AsyncSessionLocal
from app.models import RateLimitBucket


@dataclass(frozen=True)
class RateRule:
    scope: str
    limit: int
    window_seconds: int


RULES = {
    ("POST", "/api/public/appointments"): RateRule("booking", 6, 600),
    ("POST", "/api/public/waitlist"): RateRule("waitlist", 6, 900),
    ("POST", "/api/public/reviews"): RateRule("reviews", 5, 3600),
    ("POST", "/api/public/feedback"): RateRule("feedback", 5, 3600),
    ("POST", "/api/admin/login"): RateRule("admin-login", 10, 900),
    ("POST", "/api/admin/reset-password"): RateRule("password-reset", 3, 3600),
    ("POST", "/api/admin/change-password"): RateRule("password-change", 5, 3600),
    ("POST", "/api/admin/gallery/upload"): RateRule("gallery-upload", 20, 3600),
    ("POST", "/api/public/appointments/lookup"): RateRule("booking-lookup", 30, 600),
    ("POST", "/api/public/appointments/history"): RateRule("booking-lookup", 30, 600),
}
GLOBAL_RULE = RateRule("global", 300, 300)
CLIENT_MUTATION_RULE = RateRule("booking-change", 12, 3600)


def client_address(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    networks = [
        ipaddress.ip_network(value.strip()) for value in config.TRUSTED_PROXY_CIDRS.split(",")
        if value.strip()
    ]

    def trusted(value):
        try:
            return any(ipaddress.ip_address(value) in network for network in networks)
        except ValueError:
            return False

    # Solo el proxy de confianza puede aportar la cadena; se recorre desde el salto cercano.
    if trusted(peer):
        chain = request.headers.get("x-forwarded-for", "").split(",")
        for candidate in reversed(chain):
            candidate = candidate.strip()
            try:
                address = ipaddress.ip_address(candidate)
            except ValueError:
                return peer
            if not trusted(str(address)):
                return str(address)
    return peer


class RateLimiter:
    def __init__(self, session_factory=AsyncSessionLocal):
        self.session_factory = session_factory
        self.last_cleanup = 0.0

    @staticmethod
    def _rule(request):
        if request.method == "PATCH" and request.url.path.startswith("/api/public/appointments/"):
            return CLIENT_MUTATION_RULE
        return RULES.get((request.method, request.url.path), GLOBAL_RULE)

    async def check(self, request):
        rule = self._rule(request)
        now = time.time()
        window = int(now // rule.window_seconds)
        expires = datetime.fromtimestamp((window + 1) * rule.window_seconds, timezone.utc)
        digest = hmac.new(config.SECRET_KEY.encode(), client_address(request).encode(), hashlib.sha256).hexdigest()
        key = f"{rule.scope}:{digest}:{window}"
        async with self.session_factory() as db:
            insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
            stmt = insert(RateLimitBucket).values(key=key, count=1, expires_at=expires)
            stmt = stmt.on_conflict_do_update(
                index_elements=["key"],
                set_={"count": RateLimitBucket.count + 1},
                where=RateLimitBucket.count < rule.limit,
            ).returning(RateLimitBucket.count)
            count = (await db.execute(stmt)).scalar_one_or_none()
            if now - self.last_cleanup > 300:
                await db.execute(delete(RateLimitBucket).where(
                    RateLimitBucket.expires_at < datetime.now(timezone.utc)
                ))
                self.last_cleanup = now
            await db.commit()
        if count is None:
            return False, max(1, int(expires.timestamp() - now)), rule
        return True, max(rule.limit - count, 0), rule


rate_limiter = RateLimiter()


async def rate_limit_middleware(request: Request, call_next):
    if (
        not config.RATE_LIMIT_ENABLED or request.method == "OPTIONS"
        or not request.url.path.startswith("/api/")
        or request.url.path.startswith("/api/tasks/")
    ):
        return await call_next(request)
    try:
        allowed, value, rule = await rate_limiter.check(request)
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"error": {
            "code": "security_unavailable", "message": "La agenda está despertando. Intenta nuevamente.",
            "details": None,
        }}, headers={"Retry-After": "10"})
    if not allowed:
        return JSONResponse(status_code=429, content={"error": {
            "code": "rate_limit_exceeded", "message": "Recibimos demasiadas solicitudes. Espera un momento.",
            "details": {"scope": rule.scope},
        }}, headers={"Retry-After": str(value)})
    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(rule.limit)
    response.headers["X-RateLimit-Remaining"] = str(value)
    return response
