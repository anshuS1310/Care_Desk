"""The single source of truth for selectable patient values."""

GENDERS = ("Female", "Male", "Other")
WARDS = (
    "General Ward",
    "ICU",
    "Emergency Ward",
    "Pediatric Ward",
    "Maternity Ward",
    "Surgical Ward",
    "Orthopedic Ward",
)
DEPARTMENTS = (
    "General Medicine",
    "Cardiology",
    "Neurology",
    "Orthopedics",
    "Pediatrics",
    "Gynecology",
    "General Surgery",
    "Emergency Medicine",
)
DOCTORS = (
    "Dr. Sharma",
    "Dr. Mehta",
    "Dr. Iyer",
    "Dr. Khan",
    "Dr. Patel",
    "Dr. Reddy",
    "Dr. Nair",
    "Dr. Rao",
)

OPTIONS = {
    "genders": GENDERS,
    "wards": WARDS,
    "departments": DEPARTMENTS,
    "doctors": DOCTORS,
}

FIELD_OPTIONS = {
    "gender": GENDERS,
    "ward": WARDS,
    "department": DEPARTMENTS,
    "doctor": DOCTORS,
}
