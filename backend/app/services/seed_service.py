from sqlalchemy.orm import Session

from app.config import config
from app.models import Barber, BusinessHour, Service
from app.services.password_service import hash_password

SERVICES = [
    ("Corte de Cabello", 45, 5000, False),
    ("Corte de Cabello Sebastian", 45, 6000, False),
    ("Barba Completa", 45, 3000, False),
    ("Mantenimiento de Barba", 45, 2000, False),
    ("Perfilado de Cejas", 0, 1000, True),
    ("Mascarilla Facial", 0, 5000, True),
    ("Colorimetria / Rayitos", 120, 15000, False),
    ("Tinte Completo", 120, 20000, False),
]

BARBERS = [
    ("Sebastian", "Master Barber", "88887777", "sebas"),
]


def seed_data(db: Session):
    service_names = {name for name, _, _, _ in SERVICES}
    if db.query(Service).count() == 0:
        for name, duration, price, is_addon in SERVICES:
            db.add(
                Service(
                    name=name,
                    duration_min=duration,
                    base_price=max(price - 1000, 0),
                    price=price,
                    is_addon=is_addon,
                )
            )
    else:
        service_map = {name: (duration, price, is_addon) for name, duration, price, is_addon in SERVICES}
        for service in db.query(Service).all():
            if service.name in service_map:
                duration, price, is_addon = service_map[service.name]
                service.is_addon = is_addon
                service.duration_min = 0 if is_addon else duration
                service.price = price
                service.base_price = max(price - 1000, 0)
                service.is_active = True
            elif service.name not in service_names:
                service.is_active = False
        existing_names = {service.name for service in db.query(Service).all()}
        for name, duration, price, is_addon in SERVICES:
            if name not in existing_names:
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
