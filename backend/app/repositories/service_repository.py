from sqlalchemy.orm import Session

from app.models import Service


class ServiceRepository:
    def __init__(self, db: Session):
        self.db = db

    def all_active(self) -> list[Service]:
        return self.db.query(Service).filter(Service.is_active.is_(True)).order_by(Service.is_addon, Service.price).all()

    def by_id(self, service_id):
        return self.db.query(Service).filter(Service.id == service_id, Service.is_active.is_(True)).first()

    def by_ids(self, ids: list):
        if not ids:
            return []
        return self.db.query(Service).filter(Service.id.in_(ids), Service.is_active.is_(True)).all()

