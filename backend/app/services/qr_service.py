import base64
from io import BytesIO

import qrcode
from qrcode.constants import ERROR_CORRECT_M


def qr_png_data_url(value: str) -> str:
    content = str(value or "").strip()
    if not content:
        return ""

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(content)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#171914", back_color="#fffaf0")
    output = BytesIO()
    image.save(output, format="PNG")
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
