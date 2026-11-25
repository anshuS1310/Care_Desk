"""Add a few clearly fictional records; safe to run more than once."""

import sys
from datetime import datetime, timedelta
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal
from app.models import Patient


today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
rows = [
    ("Meera Nair", 42, "Female", "General Ward", "General Medicine", "Dr. Nair", 1, "Admitted"),
    ("Arjun Patel", 29, "Male", "ICU", "Cardiology", "Dr. Mehta", 2, "Admitted"),
    ("Kavya Iyer", 8, "Female", "Pediatric Ward", "Pediatrics", "Dr. Iyer", 3, "Admitted"),
    ("Rahul Rao", 56, "Male", "Surgical Ward", "General Surgery", "Dr. Rao", 4, "Admitted"),
    ("Sana Khan", 34, "Female", "Maternity Ward", "Gynecology", "Dr. Khan", 5, "Discharged"),
    ("Dev Reddy", 67, "Male", "Orthopedic Ward", "Orthopedics", "Dr. Reddy", 7, "Discharged"),
]

added = 0
with SessionLocal() as session:
    for name, age, gender, ward, department, doctor, days_ago, status in rows:
        patient_id = uuid5(NAMESPACE_URL, "care-desk-demo:" + name)
        if session.get(Patient, patient_id) is not None:
            continue
        session.add(Patient(
            id=patient_id,
            name=name,
            age=age,
            gender=gender,
            ward=ward,
            department=department,
            doctor=doctor,
            admission_date=today - timedelta(days=days_ago),
            status=status,
        ))
        added += 1
    session.commit()

print(f"Added {added} fictional demo records. Existing records were left alone.")
