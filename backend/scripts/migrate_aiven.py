"""Migración lógica verificable. Nunca elimina ni modifica la base de origen."""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import sys

import asyncpg
from sqlalchemy.engine import make_url

DIRECTORIO = Path(__file__).resolve().parents[2] / ".backups"


def parametros(nombre):
    valor = os.environ.get(nombre, "").strip()
    if not valor:
        raise RuntimeError(f"Falta {nombre}")
    url = make_url(valor)
    if url.get_backend_name() not in {"postgres", "postgresql"} or not all((url.host, url.database, url.username, url.password)):
        raise RuntimeError(f"{nombre} no es una conexión PostgreSQL completa")
    return url


def contexto_tls(destino=False):
    contexto = ssl.create_default_context()
    if destino:
        archivo = os.environ.get("AIVEN_CA_CERT_FILE", "")
        if not archivo or not Path(archivo).is_file():
            raise RuntimeError("Falta un archivo AIVEN_CA_CERT_FILE válido")
        contexto.load_verify_locations(cafile=archivo)
    return contexto


async def conectar(url, destino=False):
    return await asyncpg.connect(host=url.host, port=url.port or 5432, database=url.database,
        user=url.username, password=url.password, ssl=contexto_tls(destino), timeout=20,
        command_timeout=300, server_settings={"timezone": "UTC", "DateStyle": "ISO, MDY"})


def entorno_pg(url, destino=False):
    entorno = os.environ.copy()
    for clave in tuple(entorno):
        if clave.startswith("PG"):
            entorno.pop(clave)
    entorno.update(PGHOST=url.host, PGPORT=str(url.port or 5432), PGDATABASE=url.database,
        PGUSER=url.username, PGPASSWORD=url.password, PGSSLMODE="verify-full", PGCONNECT_TIMEOUT="20")
    if destino:
        entorno["PGSSLROOTCERT"] = os.environ["AIVEN_CA_CERT_FILE"]
    else:
        entorno["PGSSLROOTCERT"] = "system"
    return entorno


def ejecutar_pg(programa, argumentos, url, destino=False):
    ruta = shutil.which(programa)
    if not ruta:
        raise RuntimeError(f"No se encontró {programa}; utiliza las herramientas oficiales de PostgreSQL 18")
    resultado = subprocess.run([ruta, *argumentos], env=entorno_pg(url, destino), capture_output=True)
    if resultado.returncode:
        # stderr puede incluir credenciales o datos de clientes; no se imprime.
        raise RuntimeError(f"{programa} terminó con código {resultado.returncode}; no se cambió la conexión de producción")


def identificador(nombre):
    return '"' + nombre.replace('"', '""') + '"'


async def resumen(conexion):
    tablas = await conexion.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    resultado = {}
    for tabla in tablas:
        nombre = tabla["tablename"]
        consulta = f"SELECT count(*) AS filas, md5(COALESCE(string_agg(huella, '' ORDER BY huella), '')) AS huella FROM (SELECT md5(to_jsonb(t)::text) AS huella FROM public.{identificador(nombre)} AS t) AS registros"
        resultado[nombre] = dict(await conexion.fetchrow(consulta))
    return resultado


async def ejecutar(accion):
    origen = parametros("SOURCE_DATABASE_URL")
    destino = parametros("AIVEN_DATABASE_URL")
    if not destino.host.endswith(".aivencloud.com") or (origen.host, origen.port, origen.database) == (destino.host, destino.port, destino.database):
        raise RuntimeError("El destino debe ser una base Aiven distinta del origen")
    contexto_tls(True)
    fuente = await conectar(origen)
    receptor = None
    try:
        receptor = await conectar(destino, True)
        tamaño = await fuente.fetchval("SELECT pg_database_size(current_database())")
        if tamaño > 700 * 1024 * 1024:
            raise RuntimeError("El origen supera el margen seguro de almacenamiento del plan gratuito")
        extension = await receptor.fetchval("SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='btree_gist')")
        if not extension:
            raise RuntimeError("El destino no ofrece la extensión btree_gist requerida")
        if accion == "check":
            print(json.dumps({"tls_verified": True, "source_bytes": tamaño, "target_postgres": receptor.get_server_version().major,
                "source_tables": len(await resumen(fuente)), "target_tables": len(await resumen(receptor))}))
            return
        if os.environ.get("MIGRATION_WRITES_PAUSED") != "true":
            raise RuntimeError("Activa DATABASE_MIGRATION_MODE en Render y confirma MIGRATION_WRITES_PAUSED=true antes de continuar")
        DIRECTORIO.mkdir(exist_ok=True)
        respaldo = DIRECTORIO / "neon-to-aiven.dump"
        manifiesto = DIRECTORIO / "neon-to-aiven.manifest.json"
        if accion == "export":
            if respaldo.exists() or manifiesto.exists():
                raise RuntimeError("Ya existe un respaldo: consérvalo o muévelo antes de iniciar otro")
            async with fuente.transaction(isolation="repeatable_read", readonly=True):
                instantanea = await fuente.fetchval("SELECT pg_export_snapshot()")
                datos = await resumen(fuente)
                await asyncio.to_thread(ejecutar_pg, "pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--snapshot=" + instantanea, "--file=" + str(respaldo)], origen)
            manifiesto.write_text(json.dumps({"tables": datos, "sha256": hashlib.sha256(respaldo.read_bytes()).hexdigest()}, indent=2), encoding="utf-8")
            print(json.dumps({"exported": True, "tables": len(datos), "rows": sum(t["filas"] for t in datos.values())}))
            return
        if not respaldo.is_file() or not manifiesto.is_file():
            raise RuntimeError("Primero crea el respaldo y su manifiesto con export")
        esperado = json.loads(manifiesto.read_text(encoding="utf-8"))
        if hashlib.sha256(respaldo.read_bytes()).hexdigest() != esperado["sha256"]:
            raise RuntimeError("El respaldo no coincide con su checksum")
        if accion == "restore":
            tablas = await receptor.fetchval("SELECT count(*) FROM pg_tables WHERE schemaname='public'")
            if tablas:
                raise RuntimeError("El destino no está vacío: restauración detenida sin borrar datos")
            await asyncio.to_thread(ejecutar_pg, "pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction", "--dbname=" + destino.database, str(respaldo)], destino, True)
        actual = await resumen(receptor)
        fuente_actual = await resumen(fuente)
        if actual != esperado["tables"] or fuente_actual != esperado["tables"]:
            raise RuntimeError("Las filas o huellas no coinciden; mantén la API apuntando a Neon")
        if accion == "restore":
            await receptor.execute("ANALYZE")
        print(json.dumps({"verified": True, "tables": len(actual), "rows": sum(t["filas"] for t in actual.values()), "source_unchanged": True}))
    finally:
        await fuente.close()
        if receptor:
            await receptor.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("check", "export", "restore", "verify"))
    argumentos = parser.parse_args()
    try:
        asyncio.run(ejecutar(argumentos.action))
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception as error:
        print(f"Migración detenida: {type(error).__name__}. No se muestran datos de conexión.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
