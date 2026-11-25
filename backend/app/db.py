"""Database configuration. Neon supplies the connection URL via the environment."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env.local", override=False)
load_dotenv(PROJECT_ROOT / ".env", override=False)
load_dotenv(PROJECT_ROOT / "backend" / ".env", override=False)


def sqlalchemy_url() -> str:
    raw = os.getenv("DATABASE_URL", "").strip()
    if not raw:
        raise RuntimeError("DATABASE_URL is required. Run neon deploy or set it in the environment.")
    if raw.startswith("postgresql://"):
        return "postgresql+psycopg://" + raw[len("postgresql://") :]
    if raw.startswith("postgres://"):
        return "postgresql+psycopg://" + raw[len("postgres://") :]
    if raw.startswith("postgresql+psycopg://"):
        return raw
    raise RuntimeError("DATABASE_URL must be a PostgreSQL connection URL.")


class Base(DeclarativeBase):
    pass


engine = create_engine(
    sqlalchemy_url(),
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
    connect_args={"prepare_threshold": None},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session():
    with SessionLocal() as session:
        yield session
