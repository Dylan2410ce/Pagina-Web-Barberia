import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import config


class Base(DeclarativeBase):
    pass


def database_connect_args():
    if not config.DATABASE_URL.startswith("postgresql+asyncpg://"):
        return {}
    tls = False if config.DATABASE_SSL == "disable" else ssl.create_default_context()
    return {"ssl": tls, "timeout": 15, "command_timeout": 30}


engine_options = {}
if config.DATABASE_URL.startswith("postgresql+asyncpg://"):
    engine_options.update(
        {
            "pool_pre_ping": True,
            "pool_recycle": 300,
            "pool_use_lifo": True,
            "pool_size": 2,
            "max_overflow": 1,
            "pool_timeout": 15,
        }
    )
    engine_options["connect_args"] = database_connect_args()

engine = create_async_engine(config.DATABASE_URL, hide_parameters=True, **engine_options)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db
