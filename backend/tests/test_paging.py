"""Verify paging and stable ordering against more than one full page."""

from datetime import datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db import SessionLocal
from app.main import app
from app.models import Patient


def letters(number: int) -> str:
    return chr(65 + number // 26) + chr(65 + number % 26)


def test_more_than_one_page_and_clamping():
    ids = [uuid4() for _ in range(101)]
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    try:
        with SessionLocal() as session:
            session.add_all([
                Patient(
                    id=patient_id,
                    name="Pagecase " + letters(index),
                    age=30,
                    gender="Female",
                    ward="General Ward",
                    department="General Medicine",
                    doctor="Dr. Sharma",
                    admission_date=today,
                    status="Admitted",
                )
                for index, patient_id in enumerate(ids)
            ])
            session.commit()
        client = TestClient(app)
        first = client.get("/api/patients?search=Pagecase&page=1")
        second = client.get("/api/patients?search=Pagecase&page=2")
        beyond = client.get("/api/patients?search=Pagecase&page=999")
        assert first.status_code == second.status_code == beyond.status_code == 200
        assert first.json()["total"] == 101
        assert first.json()["total_pages"] == 2
        assert len(first.json()["patients"]) == 100
        assert len(second.json()["patients"]) == 1
        assert beyond.json()["page"] == 2
        assert beyond.json()["patients"] == second.json()["patients"]
        assert not ({row["id"] for row in first.json()["patients"]} & {row["id"] for row in second.json()["patients"]})
    finally:
        with SessionLocal() as session:
            session.execute(delete(Patient).where(Patient.id.in_(ids)))
            session.commit()
