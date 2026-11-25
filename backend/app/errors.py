"""Plain-language error responses for staff-facing API requests."""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def _field_message(field: str, error: dict) -> str:
    kind = error["type"]
    if kind == "extra_forbidden":
        return "Status can only be changed through Discharge" if field == "status" else "This field is not allowed"
    if field == "age":
        if kind == "missing":
            return "Age is required"
        if kind in {"greater_than_equal", "less_than_equal"}:
            return "Age must be between 0 and 120"
        return "Age must be a whole number"
    if field == "page":
        return "Page must be a whole number starting at 1"
    if kind == "missing":
        return {
            "name": "Name is required",
            "admission_date": "Admission date is required",
        }.get(field, f"Please select a valid {field}")
    if field in {"gender", "ward", "department", "doctor"}:
        return f"Please select a valid {field}"
    if kind == "value_error":
        message = error.get("msg", "")
        return message.removeprefix("Value error, ") or "Please check this value"
    if field == "admission_date":
        return "Please enter a valid admission date"
    if field == "name":
        return "Please enter a valid name"
    return "Please check this value"


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    field_errors: dict[str, str] = {}
    top_message = "Please correct the highlighted fields."
    for error in exc.errors():
        location = error.get("loc", ())
        field = location[-1] if len(location) >= 2 and isinstance(location[-1], str) else None
        if field:
            field_errors.setdefault(field, _field_message(field, error))
        elif error["type"] == "missing":
            top_message = "Patient details are required."
        elif error["type"] == "json_invalid":
            top_message = "Request body must be valid JSON."
        else:
            top_message = "Patient details must be a valid JSON object."
    return JSONResponse(
        status_code=422,
        content={"message": top_message, "field_errors": field_errors},
    )


async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": str(exc.detail), "field_errors": {}},
    )
