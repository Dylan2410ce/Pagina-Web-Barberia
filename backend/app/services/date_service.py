from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


try:
    TZ = ZoneInfo("America/Costa_Rica")
except Exception:
    TZ = timezone(timedelta(hours=-6), name="America/Costa_Rica")


def range_from_minutes(day: date, start_min: int, duration_min: int) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time(start_min // 60, start_min % 60), tzinfo=TZ)
    end = start + timedelta(minutes=duration_min)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def day_range(day: date) -> tuple[datetime, datetime]:
    return range_from_minutes(day, 0, 24 * 60)


def label_from_minutes(minutes: int) -> str:
    hour, minute = divmod(minutes, 60)
    suffix = "PM" if hour >= 12 else "AM"
    display_hour = hour - 12 if hour > 12 else hour
    return f"{display_hour}:{minute:02d} {suffix}"
