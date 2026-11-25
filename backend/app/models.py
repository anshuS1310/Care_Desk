"""Persistent patient record. Schema creation is kept in backend/schema.sql."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, DateTime, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint("age BETWEEN 0 AND 120", name="patients_age_check"),
        CheckConstraint("status IN ('Admitted', 'Discharged')", name="patients_status_check"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    gender: Mapped[str] = mapped_column(Text, nullable=False)
    ward: Mapped[str] = mapped_column(Text, nullable=False)
    department: Mapped[str] = mapped_column(Text, nullable=False)
    doctor: Mapped[str] = mapped_column(Text, nullable=False)
    admission_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="Admitted")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
