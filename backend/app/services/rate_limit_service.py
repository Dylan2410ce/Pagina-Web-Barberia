import hashlib
import hmac
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import config


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
}
GLOBAL_RULE = RateRule("global", 300, 300)
LOOKUP_RULE = RateRule("booking-lookup", 60, 600)
CLIENT_MUTATION_RULE = RateRule("booking-change", 12, 3600)


class RateLimiter:
    def __init__(self):
        self._events: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_cleanup = 0.0

    @staticmethod
    def _client_key(request: Request) -> str:
        host = request.client.host if request.client else "unknown"
        return hmac.new(
            config.SECRET_KEY.encode("utf-8"),
            host.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:24]

    @staticmethod
    def _rule(request: Request) -> RateRule:
        exact = RULES.get((request.method, request.url.path))
        if exact:
            return exact
        if request.url.path.startswith("/api/public/appointments/manage/"):
            return LOOKUP_RULE
        if request.url.path.startswith("/api/public/appointments/history/"):
            return LOOKUP_RULE
        if (
            request.method == "PATCH"
            and request.url.path.startswith("/api/public/appointments/")
        ):
            return CLIENT_MUTATION_RULE
        if request.url.path.startswith("/api/public/loyalty/"):
            return LOOKUP_RULE
        return GLOBAL_RULE

    def check(self, request: Request) -> tuple[bool, int, RateRule]:
        now = time.monotonic()
        rule = self._rule(request)
        key = (self._client_key(request), rule.scope)
        cutoff = now - rule.window_seconds

        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= rule.limit:
                retry_after = max(1, int(rule.window_seconds - (now - events[0])))
                return False, retry_after, rule
            events.append(now)
            remaining = max(rule.limit - len(events), 0)
            if now - self._last_cleanup > 600:
                self._cleanup(now)
            return True, remaining, rule

    def _cleanup(self, now: float) -> None:
        stale = []
        for key, events in self._events.items():
            while events and events[0] <= now - 3600:
                events.popleft()
            if not events:
                stale.append(key)
        for key in stale:
            self._events.pop(key, None)
        self._last_cleanup = now


rate_limiter = RateLimiter()


async def rate_limit_middleware(request: Request, call_next):
    if not config.RATE_LIMIT_ENABLED or request.method == "OPTIONS":
        return await call_next(request)
    allowed, value, rule = rate_limiter.check(request)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "rate_limit_exceeded",
                    "message": "Recibimos demasiadas solicitudes. Espera un momento.",
                    "details": {"scope": rule.scope},
                }
            },
            headers={"Retry-After": str(value)},
        )
    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(rule.limit)
    response.headers["X-RateLimit-Remaining"] = str(value)
    return response
