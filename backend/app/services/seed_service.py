from sqlalchemy.orm import Session

from app.config import config
from app.models import Barber, BusinessHour, Service
from app.services.password_service import hash_password

SERVICES = [
    ("Corte Clasico", 45, 4000, False),
    ("Corte Fade / Moderno", 45, 5000, False),
    ("Corte Premium + Lavado", 45, 7000, False),
    ("Colorimetria / Rayitos", 120, 15000, False),
    ("Tinte Completo", 120, 20000, False),
    ("Barba Hot Towel", 0, 2000, True),
    ("Perfilado de Cejas", 0, 1000, True),
    ("Mascarilla Black", 0, 2000, True),
    ("Depilacion con Cera", 0, 3000, True),
]

BARBERS = [
    ("Sebastian", "Master Barber", "88887777", "sebas"),
]


def seed_data(db: Session):
    if db.query(Service).count() == 0:
        for name, duration, base_price, is_addon in SERVICES:
            db.add(
                Service(
                    name=name,
                    duration_min=duration,
                    base_price=base_price,
                    price=base_price + 1000,
                    is_addon=is_addon,
                )
            )
    else:
        service_map = {name: (duration, is_addon) for name, duration, _, is_addon in SERVICES}
        for service in db.query(Service).all():
            if service.name in service_map:
                duration, is_addon = service_map[service.name]
                service.is_addon = is_addon
                service.duration_min = 0 if is_addon else duration

    password_hash = config.ADMIN_PASSWORD_HASH or hash_password(config.ADMIN_DEFAULT_PASSWORD)
    active_usernames = {username for _, _, _, username in BARBERS}

    for name, role, phone, username in BARBERS:
        barber = db.query(Barber).filter(Barber.username == username).first()
        if barber:
            barber.name = name
            barber.role = role
            barber.phone = phone
            barber.is_active = True
        else:
            db.add(Barber(name=name, role=role, phone=phone, username=username, password_hash=password_hash))

    for barber in db.query(Barber).filter(~Barber.username.in_(active_usernames)).all():
        barber.is_active = False

    if db.query(BusinessHour).count() == 0:
        for weekday in range(7):
            db.add(
                BusinessHour(
                    weekday=weekday,
                    is_open=weekday not in (0, 6),
                    open_min=config.OPEN_MIN,
                    close_min=config.CLOSE_MIN,
                )
            )

    db.commit()
