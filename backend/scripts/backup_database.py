"""Respaldo logico privado previo a migraciones; no modifica PostgreSQL."""
import asyncio
import gzip
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.database import engine


async def main():
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Este respaldo requiere PostgreSQL")
    directory = Path(__file__).resolve().parents[2] / ".backups"
    directory.mkdir(exist_ok=True)
    target = directory / (datetime.now(timezone.utc).strftime("neon-%Y%m%d-%H%M%S") + ".json.gz")
    schema = {}
    counts = {}
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
            tables = (await connection.execute(text(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
            ))).scalars().all()
            for name, query in {
                "columns": "SELECT * FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position",
                "enums": "SELECT t.typname, e.enumlabel, e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname, e.enumsortorder",
                "constraints": "SELECT c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'",
                "indexes": "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'",
            }.items():
                schema[name] = [dict(row) for row in (await connection.execute(text(query))).mappings()]
            with gzip.open(target, "wt", encoding="utf-8") as output:
                output.write('{"format":"sebas-logical-v1","created_at":')
                json.dump(datetime.now(timezone.utc).isoformat(), output)
                output.write(',"schema":')
                json.dump(schema, output, default=str, ensure_ascii=False)
                output.write(',"tables":{')
                for index, table in enumerate(tables):
                    if index:
                        output.write(",")
                    json.dump(table, output)
                    output.write(":[")
                    identifier = connection.dialect.identifier_preparer.quote(table)
                    rows = await connection.stream(text(f"SELECT to_jsonb(t) FROM public.{identifier} AS t"))
                    count = 0
                    async for row in rows:
                        if count:
                            output.write(",")
                        json.dump(row[0], output, ensure_ascii=False, default=str)
                        count += 1
                    output.write("]")
                    counts[table] = count
                output.write("}}")
            await connection.rollback()
        with gzip.open(target, "rt", encoding="utf-8") as saved:
            snapshot = json.load(saved)
        if counts != {table: len(rows) for table, rows in snapshot["tables"].items()}:
            raise RuntimeError("El respaldo no supera la verificacion de filas")
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        print(json.dumps({"path": str(target), "tables": len(counts), "rows": sum(counts.values()), "sha256": digest}))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
