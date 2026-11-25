"""Raw HTTP validation and a reversible workflow against the configured database."""

from datetime import datetime, timedelta
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
TODAY = datetime.now(ZoneInfo("Asia/Kolkata")).date()


def draft(**changes):
    values = {
        "name": "Test Patient",
        "age": 25,
        "gender": "Female",
        "ward": "General Ward",
        "department": "General Medicine",
        "doctor": "Dr. Sharma",
        "admission_date": TODAY.isoformat(),
    }
    return values | changes


@pytest.mark.parametrize("bad_age", ["25", 25.0, True, -1, 121])
def test_strict_age_raw_json(bad_age):
    response = client.post("/api/patients", json=draft(age=bad_age))
    assert response.status_code == 422
    assert "age" in response.json()["field_errors"]


@pytest.mark.parametrize("name", ["", "  ", "Ramesh2", "O'Brien", "\u200dRamesh", "\u0301Ramesh"])
def test_invalid_names(name):
    response = client.post("/api/patients", json=draft(name=name))
    assert response.status_code == 422
    assert "name" in response.json()["field_errors"]


@pytest.mark.parametrize("name", ["रमेश", "தமிழ்", "Élodie", "  Anita   Rao  "])
def test_valid_names(name):
    # Validation without writing a record. The date is an ordinary JSON string.
    from app.schemas import PatientInput

    parsed = PatientInput.model_validate(draft(name=name))
    assert parsed.name == " ".join(name.split())


def test_shared_name_fixtures():
    from app.schemas import clean_name

    path = Path(__file__).resolve().parents[2] / "shared" / "name-fixtures.json"
    cases = json.loads(path.read_text(encoding="utf-8"))
    cases += [
        {"name": "A" * 100, "valid": True, "cleaned": "A" * 100},
        {"name": "A" * 101, "valid": False},
    ]
    for case in cases:
        if case["valid"]:
            assert clean_name(case["name"]) == case["cleaned"]
        else:
            with pytest.raises(ValueError):
                clean_name(case["name"])


def test_bad_fields_and_body():
    cases = [
        (draft(status="Discharged"), "status"),
        (draft(ward="Unknown Ward"), "ward"),
        (draft(department="Unknown"), "department"),
        (draft(doctor="Unknown"), "doctor"),
        (draft(foo="bar"), "foo"),
        (draft(admission_date=(TODAY + timedelta(days=1)).isoformat()), "admission_date"),
    ]
    for payload, field in cases:
        response = client.post("/api/patients", json=payload)
        assert response.status_code == 422
        assert field in response.json()["field_errors"]
    assert client.post("/api/patients").json()["field_errors"] == {}
    assert client.post("/api/patients", content="{bad", headers={"Content-Type": "application/json"}).json()["field_errors"] == {}
    assert client.post("/api/patients", json=[]).json()["field_errors"] == {}


@pytest.mark.parametrize("suffix,field", [("?ward=", "ward"), ("?ward=Unknown", "ward"), ("?page=abc", "page"), ("?page=0", "page")])
def test_invalid_queries(suffix, field):
    response = client.get("/api/patients" + suffix)
    assert response.status_code == 422
    assert field in response.json()["field_errors"]


def test_patient_workflow():
    assert client.get("/health").json() == {"status": "ok"}
    assert "wards" in client.get("/api/options").json()
    before = client.get("/api/summary")
    assert before.status_code == 200
    assert before.json()["total"] == before.json()["admitted"] + before.json()["discharged"]
    created = client.post("/api/patients", json=draft(name="Test Patient"))
    assert created.status_code == 201, created.text
    patient_id = created.json()["id"]
    try:
        assert client.get("/api/summary").json()["total"] == before.json()["total"] + 1
        listed = client.get("/api/patients?search=patient&ward=General%20Ward")
        assert listed.status_code == 200, listed.text
        assert any(item["id"] == patient_id for item in listed.json()["patients"])
        assert client.get("/api/patients?page=999999").json()["page"] >= 1

        changed = client.put(f"/api/patients/{patient_id}", json=draft(name="Test Revised", age=26))
        assert changed.status_code == 200, changed.text
        assert changed.json()["status"] == "Admitted"
        assert changed.json()["name"] == "Test Revised"

        discharged = client.patch(f"/api/patients/{patient_id}/discharge")
        assert discharged.status_code == 200, discharged.text
        assert discharged.json()["status"] == "Discharged"
        again = client.patch(f"/api/patients/{patient_id}/discharge")
        assert again.status_code == 409
        assert "already discharged" in again.json()["message"]
    finally:
        deleted = client.delete(f"/api/patients/{patient_id}")
        assert deleted.status_code == 204, deleted.text
    assert client.delete(f"/api/patients/{patient_id}").status_code == 404
    assert client.get("/api/summary").json()["total"] == before.json()["total"]
    assert client.put(f"/api/patients/{patient_id}", json=draft()).status_code == 404
    assert client.patch(f"/api/patients/{patient_id}/discharge").status_code == 404
