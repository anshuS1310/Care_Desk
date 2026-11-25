"""Care Desk HTTP API."""

import math
import os
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, func, select, text, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import engine, get_session
from .errors import http_error_handler, validation_error_handler
from .models import Patient
from .options import OPTIONS
from .schemas import PatientInput, PatientOutput, PatientPage, PatientQuery, PatientSummary

app = FastAPI(title="Care Desk API", version="1.0.0")
origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(StarletteHTTPException, http_error_handler)


def output(patient: Patient) -> PatientOutput:
    return PatientOutput(
        id=str(patient.id),
        name=patient.name,
        age=patient.age,
        gender=patient.gender,
        ward=patient.ward,
        department=patient.department,
        doctor=patient.doctor,
        admission_date=patient.admission_date,
        status=patient.status,
    )


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Care Desk is temporarily unavailable") from None
    return {"status": "ok"}


@app.get("/api/options")
def options():
    return OPTIONS


@app.get("/api/summary", response_model=PatientSummary)
def summary(session: Annotated[Session, Depends(get_session)]):
    counts = dict(session.execute(
        select(Patient.status, func.count()).group_by(Patient.status)
    ).all())
    admitted = counts.get("Admitted", 0)
    discharged = counts.get("Discharged", 0)
    active_wards = session.scalar(
        select(func.count(func.distinct(Patient.ward))).where(Patient.status == "Admitted")
    ) or 0
    return PatientSummary(
        total=admitted + discharged,
        admitted=admitted,
        discharged=discharged,
        active_wards=active_wards,
    )


@app.get("/api/patients", response_model=PatientPage)
def list_patients(
    query: Annotated[PatientQuery, Query()],
    session: Annotated[Session, Depends(get_session)],
):
    conditions = []
    if query.search:
        conditions.append(func.lower(Patient.name).contains(query.search.lower(), autoescape=True))
    for field in ("ward", "department", "doctor"):
        value = getattr(query, field)
        if value is not None:
            conditions.append(getattr(Patient, field) == value)
    total = session.scalar(select(func.count()).select_from(Patient).where(*conditions)) or 0
    total_pages = max(1, math.ceil(total / 100))
    actual_page = min(query.page, total_pages)
    rows = session.scalars(
        select(Patient)
        .where(*conditions)
        .order_by(
            case((Patient.status == "Admitted", 0), else_=1),
            Patient.admission_date.desc(),
            Patient.id.desc(),
        )
        .limit(100)
        .offset((actual_page - 1) * 100)
    ).all()
    return PatientPage(
        patients=[output(row) for row in rows],
        total=total,
        page=actual_page,
        total_pages=total_pages,
    )


@app.post("/api/patients", response_model=PatientOutput, status_code=201)
def add_patient(
    data: PatientInput,
    session: Annotated[Session, Depends(get_session)],
):
    patient = Patient(**data.model_dump(), status="Admitted")
    session.add(patient)
    session.commit()
    session.refresh(patient)
    return output(patient)


@app.put("/api/patients/{patient_id}", response_model=PatientOutput)
def edit_patient(
    patient_id: UUID,
    data: PatientInput,
    session: Annotated[Session, Depends(get_session)],
):
    patient = session.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="This patient record was already removed")
    for field, value in data.model_dump().items():
        setattr(patient, field, value)
    session.commit()
    session.refresh(patient)
    return output(patient)


@app.patch("/api/patients/{patient_id}/discharge", response_model=PatientOutput)
def discharge_patient(
    patient_id: UUID,
    session: Annotated[Session, Depends(get_session)],
):
    updated = session.execute(
        update(Patient)
        .where(Patient.id == patient_id, Patient.status == "Admitted")
        .values(status="Discharged")
        .returning(Patient.id)
    ).scalar_one_or_none()
    if updated is None:
        exists = session.get(Patient, patient_id)
        if exists is None:
            raise HTTPException(status_code=404, detail="This patient record was already removed")
        raise HTTPException(status_code=409, detail="This patient was already discharged")
    session.commit()
    patient = session.get(Patient, patient_id)
    return output(patient)


@app.delete("/api/patients/{patient_id}", status_code=204)
def delete_patient(
    patient_id: UUID,
    session: Annotated[Session, Depends(get_session)],
):
    patient = session.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="This patient record was already removed")
    session.delete(patient)
    session.commit()
