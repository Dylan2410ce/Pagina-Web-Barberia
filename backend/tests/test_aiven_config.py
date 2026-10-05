import importlib.util
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

from app.config import config, normalize_database_url
from app.database import database_connect_args

RUTA = Path(__file__).resolve().parents[1] / "scripts" / "migrate_aiven.py"
ESPECIFICACION = importlib.util.spec_from_file_location("migrate_aiven", RUTA)
migracion = importlib.util.module_from_spec(ESPECIFICACION)
ESPECIFICACION.loader.exec_module(migracion)


class AivenConfigTests(unittest.TestCase):
    def test_aiven_uri_is_normalized_without_losing_host_or_port(self):
        self.assertEqual(normalize_database_url("postgres://user:example@db.aivencloud.com:27706/defaultdb?sslmode=require"),
            "postgresql+asyncpg://user:example@db.aivencloud.com:27706/defaultdb")

    def test_database_loads_project_ca_without_disabling_tls(self):
        contexto = MagicMock()
        with patch.object(config, "DATABASE_URL", "postgresql+asyncpg://user:example@host/db"), patch.object(config, "DATABASE_SSL", "require"), patch.object(config, "DATABASE_CA_CERT_FILE", "/etc/secrets/aiven-ca.pem"), patch.object(config, "DATABASE_CA_CERT", ""), patch("app.database.ssl.create_default_context", return_value=contexto):
            argumentos = database_connect_args()
        contexto.load_verify_locations.assert_called_once_with(cafile="/etc/secrets/aiven-ca.pem")
        self.assertIs(argumentos["ssl"], contexto)

    def test_migration_credentials_use_environment_not_process_arguments(self):
        with patch.dict("os.environ", {"SOURCE_DATABASE_URL": "postgresql://user:example@source.example:5432/source"}):
            url = migracion.parametros("SOURCE_DATABASE_URL")
            entorno = migracion.entorno_pg(url)
        self.assertEqual(entorno["PGPASSWORD"], "example")
        self.assertEqual(entorno["PGSSLMODE"], "verify-full")
        self.assertEqual(entorno["PGSSLROOTCERT"], "system")

    def test_migration_uses_quoted_database_identifiers(self):
        self.assertEqual(migracion.identificador('a"b'), '"a""b"')
