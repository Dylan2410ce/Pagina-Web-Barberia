from sqlalchemy.ext.asyncio import AsyncSession

from app.services.notification_service import NotificationService


class ReminderService:
    """Compatibility facade for the protected scheduler endpoint."""

    def __init__(self, db: AsyncSession):
        self.notifications = NotificationService(db)

    async def process_due(self) -> dict:
        return await self.notifications.process_due()
