import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.models import Barber, BusinessHour, Service
from app.services.password_service import hash_password

SERVICES = [
    ("Corte de Cabello", 45, 5000, False),
    ("Corte Premium", 45, 6000, False),
    ("Barba Completa", 45, 3000, False),
    ("Mantenimiento de Barba", 45, 2000, False),
    ("Perfilado de Cejas", 0, 1000, True),
    ("Mascarilla Facial", 0, 5000, True),
    ("Colorimetría / Rayitos", 120, 15000, False),
    ("Tinte Completo", 120, 20000, False),
]

BARBERS = [
    {
        "name": "Sebastián",
        "role": "Barbero principal",
        "phone": "83778700",
        "username": "sebas",
        "calendar_sync": True,
        "calendar_id": lambda: config.GOOGLE_CALENDAR_SEBASTIAN_ID,
        "instagram_url": "https://www.instagram.com/andres29?igsh=dnVxdnNkYm16OXU1",
        "password": lambda: config.ADMIN_DEFAULT_PASSWORD,
        "password_hash": lambda: config.ADMIN_PASSWORD_HASH,
        "password_configured": lambda: config.ADMIN_PASSWORD_CONFIGURED,
    },
    {
        "name": "Gabriel",
        "role": "Barbero",
        "phone": "00000000",
        "username": "gabriel",
        "calendar_sync": True,
        "calendar_id": lambda: config.GOOGLE_CALENDAR_GABRIEL_ID,
        "instagram_url": "https://www.instagram.com/gabriel_madriz01?igsh=dmk4NnZ2cGg3Z21q",
        "password": lambda: config.GABRIEL_DEFAULT_PASSWORD,
        "password_hash": lambda: config.GABRIEL_PASSWORD_HASH,
        "password_configured": lambda: config.GABRIEL_PASSWORD_CONFIGURED,
    },
]

SERVICE_RENAMES = {
    "Corte de Cabello Sebastian": "Corte Premium",
    "Corte de Cabello Sebastián": "Corte Premium",
    "Corte Sebastian": "Corte Premium",
    "Corte Sebastián": "Corte Premium",
    "Colorimetria / Rayitos": "Colorimetría / Rayitos",
}


def normalized_service_name(name: str, price: int) -> str:
    normalized = SERVICE_RENAMES.get(name)
    if normalized:
        return normalized

    key = name.casefold()
    if price == 6000 and key.startswith("corte") and "sebasti" in key:
        return "Corte Premium"
    return name


async def seed_data(db: AsyncSession):
    services_result = await db.execute(select(Service))
    services = list(services_result.scalars().all())
    current_names = {service.name for service in services}
    for service in services:
        new_name = normalized_service_name(service.name, service.price)
        if new_name != service.name and new_name not in current_names:
            current_names.discard(service.name)
            service.name = new_name
            current_names.add(new_name)
        elif new_name != service.name:
            service.is_active = False

    existing_service_names = {service.name for service in services}
    for name, duration, price, is_addon in SERVICES:
        if name not in existing_service_names:
            db.add(
                Service(
                    name=name,
                    duration_min=duration,
                    base_price=max(price - 1000, 0),
                    price=price,
                    is_addon=is_addon,
                    is_active=True,
                )
            )

    barbers_result = await db.execute(select(Barber))
    existing_barbers = {barber.username: barber for barber in barbers_result.scalars().all()}
    active_usernames = {item["username"] for item in BARBERS}
    active_barbers: list[Barber] = []

    for profile in BARBERS:
        barber = existing_barbers.get(profile["username"])
        if not barber:
            configured_hash = profile["password_hash"]()
            credentials_initialized = False
            if configured_hash:
                password_hash = configured_hash
                credentials_initialized = True
            elif profile["password_configured"]():
                password_hash = await asyncio.to_thread(
                    hash_password,
                    profile["password"](),
                )
                credentials_initialized = True
            else:
                password_hash = "unconfigured"
            barber = Barber(
                username=profile["username"],
                password_hash=password_hash,
                credentials_initialized=credentials_initialized,
            )
            db.add(barber)
        elif not barber.credentials_initialized:
            if profile["username"] == "sebas" and barber.password_hash != "unconfigured":
                barber.credentials_initialized = True
            else:
                configured_hash = profile["password_hash"]()
                if configured_hash:
                    barber.password_hash = configured_hash
                    barber.credentials_initialized = True
                elif profile["password_configured"]():
                    barber.password_hash = await asyncio.to_thread(
                        hash_password,
                        profile["password"](),
                    )
                    barber.credentials_initialized = True
                else:
                    barber.password_hash = "unconfigured"

        barber.name = profile["name"]
        barber.role = profile["role"]
        barber.phone = profile["phone"]
        barber.calendar_sync = profile["calendar_sync"]
        barber.calendar_id = profile["calendar_id"]() or None
        barber.instagram_url = profile["instagram_url"]
        barber.is_active = True
        active_barbers.append(barber)

    for username, barber in existing_barbers.items():
        if username not in active_usernames:
            barber.is_active = False

    await db.flush()

    hours_result = await db.execute(select(BusinessHour))
    existing_hours = {
        (item.barber_id, item.weekday): item
        for item in hours_result.scalars().all()
    }
    for barber in active_barbers:
        for weekday in range(7):
            if (barber.id, weekday) not in existing_hours:
                db.add(
                    BusinessHour(
                        barber_id=barber.id,
                        weekday=weekday,
                        is_open=weekday not in (0, 6),
                        open_min=config.OPEN_MIN,
                        close_min=config.CLOSE_MIN,
                    )
                )

    await db.commit()
