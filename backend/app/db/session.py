import os
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

# Retrieve DATABASE_URL strictly from process environment; fail immediately if missing or empty
raw_database_url = os.environ.get("DATABASE_URL")
if not raw_database_url or not raw_database_url.strip():
    raise RuntimeError(
        "DATABASE_URL environment variable is missing or empty. "
        "Please ensure DATABASE_URL is set in the process environment."
    )

database_url = raw_database_url.strip()

# Handle optional DATABASE_HOST and DATABASE_PORT override only when explicitly provided
database_host = os.environ.get("DATABASE_HOST")
database_port = os.environ.get("DATABASE_PORT")
if (database_host and database_host.strip()) or (database_port and database_port.strip()):
    url_obj = make_url(database_url)
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

SQLALCHEMY_DATABASE_URL = database_url

connect_args = {}
if str(SQLALCHEMY_DATABASE_URL).startswith("postgresql"):
    connect_args["connect_timeout"] = 3

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()