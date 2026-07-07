from sqlalchemy.orm import Session

from app.models import Barber


class BarberRepository:
    def __init__(self, db: Session):
        self.db = db

    def all_active(self) -> list[Barber]:
        return self.db.query(Barber).filter(Barber.is_active.is_(True)).order_by(Barber.name).all()

    def by_id(self, barber_id):
        return self.db.query(Barber).filter(Barber.id == barber_id, Barber.is_active.is_(True)).first()

    def by_username(self, username: str):
        return self.db.query(Barber).filter(Barber.username == username, Barber.is_active.is_(True)).first()

