import asyncio
import os
import sys
from dotenv import load_dotenv

# Ensure the parent directory is in sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from backend.app.models import Appointment

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL no encontrada en el archivo .env")
    sys.exit(1)

# Fix postgresql:// vs postgresql+asyncpg:// if needed
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DATABASE_URL)
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)

async def cleanup():
    print("Conectando a la base de datos para limpieza...")
    async with SessionLocal() as session:
        query = text("""
            DELETE FROM appointments 
            WHERE client_name ILIKE '%prueba%' 
               OR client_name ILIKE '%test%' 
               OR client_email ILIKE '%prueba%'
               OR client_email ILIKE '%test%'
            RETURNING id;
        """)
        
        result = await session.execute(query)
        deleted_ids = result.scalars().all()
        await session.commit()
        
        print(f"✅ Se han eliminado {len(deleted_ids)} citas de prueba exitosamente.")

if __name__ == "__main__":
    asyncio.run(cleanup())
