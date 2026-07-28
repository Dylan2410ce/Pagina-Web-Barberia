import hashlib
import json
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

from app.config import config


class CloudinaryError(RuntimeError):
    pass


class CloudinaryService:
    folder = "sebas-barber/gallery"

    def enabled(self) -> bool:
        return bool(
            config.CLOUDINARY_CLOUD_NAME
            and config.CLOUDINARY_API_KEY
            and config.CLOUDINARY_API_SECRET
        )

    def upload(
        self,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> dict:
        if not self.enabled():
            raise CloudinaryError(
                "La carga de imágenes necesita configurar Cloudinary en Render"
            )
        timestamp = int(time.time())
        fields = {
            "api_key": config.CLOUDINARY_API_KEY,
            "folder": self.folder,
            "timestamp": str(timestamp),
        }
        fields["signature"] = self._signature(
            {"folder": self.folder, "timestamp": timestamp}
        )
        boundary = f"----SebasBarber{uuid4().hex}"
        body = self._multipart_body(
            boundary,
            fields,
            content,
            filename,
            content_type,
        )
        request = Request(
            (
                "https://api.cloudinary.com/v1_1/"
                f"{config.CLOUDINARY_CLOUD_NAME}/image/upload"
            ),
            data=body,
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Content-Length": str(len(body)),
            },
            method="POST",
        )
        payload = self._send(request)
        if not payload.get("secure_url") or not payload.get("public_id"):
            raise CloudinaryError("Cloudinary no devolvió una imagen válida")
        return {
            "image_url": payload["secure_url"],
            "public_id": payload["public_id"],
        }

    def delete(self, public_id: str) -> None:
        if not self.enabled() or not public_id:
            return
        timestamp = int(time.time())
        fields = {
            "api_key": config.CLOUDINARY_API_KEY,
            "public_id": public_id,
            "timestamp": str(timestamp),
            "signature": self._signature(
                {"public_id": public_id, "timestamp": timestamp}
            ),
        }
        request = Request(
            (
                "https://api.cloudinary.com/v1_1/"
                f"{config.CLOUDINARY_CLOUD_NAME}/image/destroy"
            ),
            data=urlencode(fields).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        self._send(request)

    def _signature(self, values: dict) -> str:
        source = "&".join(
            f"{key}={values[key]}"
            for key in sorted(values)
        )
        return hashlib.sha1(
            f"{source}{config.CLOUDINARY_API_SECRET}".encode("utf-8")
        ).hexdigest()

    @staticmethod
    def _multipart_body(
        boundary: str,
        fields: dict,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> bytes:
        chunks = []
        for name, value in fields.items():
            chunks.extend(
                [
                    f"--{boundary}\r\n".encode(),
                    (
                        f'Content-Disposition: form-data; name="{name}"'
                        "\r\n\r\n"
                    ).encode(),
                    str(value).encode(),
                    b"\r\n",
                ]
            )
        safe_filename = re.sub(r"[^A-Za-z0-9._-]", "_", filename)[:120]
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                (
                    'Content-Disposition: form-data; name="file"; '
                    f'filename="{safe_filename}"\r\n'
                ).encode(),
                f"Content-Type: {content_type}\r\n\r\n".encode(),
                content,
                b"\r\n",
                f"--{boundary}--\r\n".encode(),
            ]
        )
        return b"".join(chunks)

    @staticmethod
    def _send(request: Request) -> dict:
        try:
            with urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise CloudinaryError(
                f"Cloudinary rechazó la imagen: {detail[:240]}"
            ) from exc
        except (URLError, TimeoutError, KeyError, json.JSONDecodeError) as exc:
            raise CloudinaryError(
                "No se pudo completar la carga de la imagen"
            ) from exc
