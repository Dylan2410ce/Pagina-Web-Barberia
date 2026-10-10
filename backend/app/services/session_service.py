"""Sesiones del navegador: el JWT nunca se entrega a JavaScript."""
import hmac

from fastapi import HTTPException, Request, Response

from app.config import config

MARCADOR_SESION = "cookie"


def nombre_cookie() -> str:
    return "__Host-sebas-admin" if config.ENVIRONMENT == "production" else "sebas-admin"


def origen_permitido(request: Request) -> bool:
    origen = request.headers.get("origin", "").rstrip("/")
    if origen == config.FRONTEND_URL.rstrip("/"):
        return True
    if config.ENVIRONMENT == "development":
        from urllib.parse import urlsplit
        try:
            url = urlsplit(origen)
            return (url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1"}
                and not (url.username or url.password or url.path or url.query or url.fragment))
        except ValueError:
            return False
    return False


def exigir_origen(request: Request):
    if not origen_permitido(request):
        raise HTTPException(status_code=403, detail="Origen de la solicitud no permitido")


def validar_csrf(request: Request, claims: dict):
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return
    exigir_origen(request)
    esperado = claims.get("csrf", "")
    recibido = request.headers.get("x-csrf-token", "")
    if not esperado or not hmac.compare_digest(esperado.encode("utf-8"), recibido.encode("utf-8")):
        raise HTTPException(status_code=403, detail="Actualiza el panel antes de continuar")


def guardar_cookie(response: Response, token: str):
    response.set_cookie(nombre_cookie(), token, max_age=4 * 60 * 60, path="/",
        secure=config.ENVIRONMENT == "production", httponly=True, samesite="strict")
    response.headers["Cache-Control"] = "no-store"


def eliminar_cookie(response: Response):
    response.delete_cookie(nombre_cookie(), path="/", secure=config.ENVIRONMENT == "production",
        httponly=True, samesite="strict")
