import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from app.db.session import Base
from app.models.models import Transaction, InvestigationCase, TransactionModel, InvestigationCaseModel
from app.models.replay_run import ReplayRun

# this is the Alembic Config object...
config = context.config

# Retrieve DATABASE_URL strictly from process environment; fail immediately if missing or empty
raw_database_url = os.environ.get("DATABASE_URL")
if not raw_database_url or not raw_database_url.strip():
    raise RuntimeError(
        "DATABASE_URL environment variable is missing or empty. "
        "Alembic migrations require DATABASE_URL to be set in the process environment."
    )

database_url = raw_database_url.strip()

# Handle optional DATABASE_HOST and DATABASE_PORT override only when explicitly provided and not SQLite
database_host = os.environ.get("DATABASE_HOST")
database_port = os.environ.get("DATABASE_PORT")
if (database_host and database_host.strip()) or (database_port and database_port.strip()):
    from sqlalchemy.engine import make_url
    url_obj = make_url(database_url)
    if not str(url_obj.drivername).startswith("sqlite"):
        updates = {}
        if database_host and database_host.strip() and url_obj.host != database_host.strip():
            updates["host"] = database_host.strip()
        if database_port and database_port.strip():
            try:
                port_int = int(database_port.strip())
                if url_obj.port != port_int:
                    updates["port"] = port_int
            except ValueError:
                pass
        if updates:
            database_url = url_obj.set(**updates).render_as_string(hide_password=False)

# Safely escape '%' for Alembic's ConfigParser interpolation to handle special characters in credentials
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
