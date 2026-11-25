"""Apply the small, rerunnable Care Desk schema using Neon's direct URL."""

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local", override=False)
load_dotenv(ROOT / ".env", override=False)
load_dotenv(ROOT / "backend" / ".env", override=False)

url = os.getenv("DATABASE_URL_UNPOOLED")
if not url:
    raise SystemExit("DATABASE_URL_UNPOOLED is required for schema setup.")

statements = [statement.strip() for statement in (ROOT / "backend" / "schema.sql").read_text().split(";") if statement.strip()]
with psycopg.connect(url) as connection:
    with connection.cursor() as cursor:
        for statement in statements:
            cursor.execute(statement)
        cursor.execute("SELECT to_regclass('public.patients'), gen_random_uuid()")
        table, _ = cursor.fetchone()
    if table != "patients":
        raise SystemExit("Schema check failed: patients table was not found.")

print(f"Applied {len(statements)} schema statements; patients table and UUID default verified.")
