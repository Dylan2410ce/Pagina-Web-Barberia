import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import config
from app.database import get_db
from app.models import Barber
from app.repositories.barber_repository import BarberRepository
from app.services.password_service import verify_password

security = HTTPBearer()


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:24]


def login(db: Session, username: str, password: str) -> str:
    barber = BarberRepository(db).by_username(username)
    if not barber or not verify_password(password, barber.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o password incorrecto")

    payload = {
        "sub": str(barber.id),
        "pwd": password_fingerprint(barber.password_hash),
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def current_barber(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Barber:
    try:
        payload = jwt.decode(credentials.credentials, config.SECRET_KEY, algorithms=["HS256"])
        barber_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Token invalido") from exc

    barber = BarberRepository(db).by_id(barber_id)
    if not barber:
        raise HTTPException(status_code=401, detail="Token invalido")
    token_fingerprint = str(payload.get("pwd", ""))
    if not hmac.compare_digest(token_fingerprint, password_fingerprint(barber.password_hash)):
        raise HTTPException(status_code=401, detail="La sesion ya no es valida")
    return barber
