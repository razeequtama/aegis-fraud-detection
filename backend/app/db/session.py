import os
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Memuat variabel dari file .env
load_dotenv()

# Mengambil URL dari environment variable dengan fallback aman
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+psycopg2://aegis_user:aegis_password@db:5432/aegis_db"
)

database_host = os.getenv("DATABASE_HOST")
if database_host:
    SQLALCHEMY_DATABASE_URL = make_url(SQLALCHEMY_DATABASE_URL).set(
        host=database_host
    )

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