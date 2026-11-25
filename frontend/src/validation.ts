import type { Options, PatientDraft, PatientFields } from "./types";

export const blankDraft = (): PatientDraft => ({
  name: "",
  age: "",
  gender: "",
  ward: "",
  department: "",
  doctor: "",
  admission_date: "",
});

export const draftFromPatient = (patient: PatientFields): PatientDraft => ({
  ...patient,
  age: String(patient.age),
});

const NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?: \p{L}[\p{L}\p{M}]*)*$/u;

export function indiaToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return value("year") + "-" + value("month") + "-" + value("day");
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export function validateDraft(
  draft: PatientDraft,
  options: Options,
): { values?: PatientFields; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const rawName = draft.name.normalize("NFC");
  const name = rawName.trim().replace(/\s+/gu, " ");
  if (/\p{Cf}/u.test(rawName)) errors.name = "Name can contain letters only";
  else if (!name) errors.name = "Name is required";
  else if ([...name].length > 100) errors.name = "Name must be 100 characters or fewer";
  else if (!NAME_PATTERN.test(name)) errors.name = "Name can contain letters only";

  const ageText = draft.age.trim();
  if (!ageText) errors.age = "Age is required";
  else if (!/^\d+$/.test(ageText)) errors.age = "Age must be a whole number";
  else if (Number(ageText) > 120) errors.age = "Age must be between 0 and 120";

  const choices: [keyof Options, keyof PatientDraft][] = [
    ["genders", "gender"],
    ["wards", "ward"],
    ["departments", "department"],
    ["doctors", "doctor"],
  ];
  for (const [list, field] of choices) {
    if (!options[list].includes(draft[field])) {
      errors[field] = "Please select a valid " + field;
    }
  }
  if (!draft.admission_date) errors.admission_date = "Admission date is required";
  else if (!validCalendarDate(draft.admission_date)) errors.admission_date = "Please enter a valid admission date";
  else if (draft.admission_date > indiaToday()) errors.admission_date = "Admission date cannot be in the future";

  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    values: {
      name,
      age: Number(ageText),
      gender: draft.gender,
      ward: draft.ward,
      department: draft.department,
      doctor: draft.doctor,
      admission_date: draft.admission_date,
    },
  };
}
