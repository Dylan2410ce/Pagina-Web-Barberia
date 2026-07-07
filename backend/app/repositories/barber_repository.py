from sqlalchemy.orm import Session

from app.models import Barber

PUBLIC_USERNAMES = ("sebas", "gabriel")


class BarberRepository:
    def __init__(self, db: Session):
        self.db = db

    def all_active(self) -> list[Barber]:
        rows = (
            self.db.query(Barber)
            .filter(Barber.is_active.is_(True), Barber.username.in_(PUBLIC_USERNAMES))
            .all()
        )
        order = {username: index for index, username in enumerate(PUBLIC_USERNAMES)}
        return sorted(rows, key=lambda barber: order.get(barber.username, 99))

    def by_id(self, barber_id):
        return self.db.query(Barber).filter(Barber.id == barber_id, Barber.is_active.is_(True)).first()

    def by_username(self, username: str):
        return self.db.query(Barber).filter(Barber.username == username, Barber.is_active.is_(True)).first()
