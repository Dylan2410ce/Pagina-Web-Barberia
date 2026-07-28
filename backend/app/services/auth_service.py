import asyncio
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.database import get_db
from app.models import Barber
from app.repositories.barber_repository import BarberRepository
from app.services.password_service import verify_password

security = HTTPBearer()
DUMMY_PASSWORD_HASH = (
    "$2b$12$VqyDQpsmOujx1STVz9cSXu.pTr.AW3w23DYy5UVoHlLdJ/H8wG7my"
)


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:24]


async def login(db: AsyncSession, username: str, password: str) -> str:
    barber = await BarberRepository(db).by_username(username.lower())
    if not barber:
        await asyncio.to_thread(
            verify_password,
            password,
            DUMMY_PASSWORD_HASH,
        )
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    if not await asyncio.to_thread(verify_password, password, barber.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(barber.id),
        "username": barber.username,
        "role": "sebastian" if barber.username == "sebas" else barber.username,
        "title": barber.role,
        "pwd": password_fingerprint(barber.password_hash),
        "iss": config.JWT_ISSUER,
        "aud": config.JWT_AUDIENCE,
        "iat": now,
        "ver": barber.session_version,
        "exp": now + timedelta(hours=4),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


async def current_barber(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Barber:
    payload = None
    last_error = None
    for secret in (config.SECRET_KEY, config.SECRET_KEY_PREVIOUS):
        if not secret:
            continue
        try:
            payload = jwt.decode(
                credentials.credentials,
                secret,
                algorithms=["HS256"],
                audience=config.JWT_AUDIENCE,
                issuer=config.JWT_ISSUER,
            )
            break
        except InvalidTokenError as exc:
            last_error = exc
    if payload is None:
        raise HTTPException(status_code=401, detail="Token inválido") from last_error
    barber_id = payload.get("sub")

    barber = await BarberRepository(db).by_id(barber_id)
    if not barber:
        raise HTTPException(status_code=401, detail="Token inválido")
    if not hmac.compare_digest(str(payload.get("username", "")), barber.username):
        raise HTTPException(status_code=401, detail="Token inválido")
    expected_role = "sebastian" if barber.username == "sebas" else barber.username
    if not hmac.compare_digest(str(payload.get("role", "")), expected_role):
        raise HTTPException(status_code=401, detail="Token inválido")
    token_fingerprint = str(payload.get("pwd", ""))
    if not hmac.compare_digest(token_fingerprint, password_fingerprint(barber.password_hash)):
        raise HTTPException(status_code=401, detail="La sesión ya no es válida")
    if int(payload.get("ver", 0)) != barber.session_version:
        raise HTTPException(status_code=401, detail="La sesión ya no es válida")
    return barber
