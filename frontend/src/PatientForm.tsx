import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, X } from "lucide-react";
import { api, ApiError } from "./api";
import type { Options, Patient, PatientDraft } from "./types";
import { blankDraft, draftFromPatient, indiaToday, validateDraft } from "./validation";

type Props = {
  patient: Patient | null;
  options: Options;
  onClose: () => void;
  onSaved: (action: "added" | "updated") => void;
  onListChanged: () => void;
};

export default function PatientForm({ patient, options, onClose, onSaved, onListChanged }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<PatientDraft>(() =>
    patient ? draftFromPatient(patient) : blankDraft(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus());
  }, []);

  function change(field: keyof PatientDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setMessage("");
  }

  function dismiss() {
    if (!saving) dialogRef.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || missing) return;
    const checked = validateDraft(draft, options);
    setErrors(checked.errors);
    if (!checked.values) {
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (patient) {
        await api.edit(patient.id, checked.values);
        onSaved("updated");
      } else {
        await api.add(checked.values);
        onSaved("added");
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setMessage(error.message);
        if (error.status === 404) {
          setMissing(true);
          onListChanged();
        }
      } else {
        setMessage("Could not save this patient. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  const error = (field: keyof PatientDraft) => errors[field];
  const invalid = (field: keyof PatientDraft) => Boolean(error(field));
  const select = (
    field: "gender" | "ward" | "department" | "doctor",
    label: string,
    values: string[],
  ) => (
    <div className="field">
      <label htmlFor={"patient-" + field}>{label}</label>
      <select
        id={"patient-" + field}
        name={field}
        value={draft[field]}
        onChange={(event) => change(field, event.target.value)}
        onBlur={() => {
          if (!draft[field]) setErrors((current) => ({ ...current, [field]: "Please select a valid " + field }));
        }}
        aria-invalid={invalid(field)}
        aria-describedby={invalid(field) ? field + "-error" : undefined}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {values.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
      {error(field) && <span className="field-error" id={field + "-error"}>{error(field)}</span>}
    </div>
  );

  return (
    <dialog
      ref={dialogRef}
      className="form-dialog"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClose={onClose}
      aria-labelledby="patient-form-title"
    >
      <div className="dialog-heading">
        <div>
          <div className="eyebrow">PATIENT DETAILS</div>
          <h2 id="patient-form-title">{patient ? "Edit patient" : "Add a patient"}</h2>
          <p>{patient ? "Update the details below. Status stays as it is." : "Create a new admission in the register."}</p>
        </div>
        <button type="button" className="icon-button close-button" onClick={dismiss} aria-label="Close form" disabled={saving}>
          <X size={20} strokeWidth={1.8} />
        </button>
      </div>
      <form ref={formRef} onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field field-wide">
            <label htmlFor="patient-name">Patient name</label>
            <input
              id="patient-name"
              name="name"
              type="text"
              autoComplete="off"
              placeholder="e.g. Anita Rao"
              value={draft.name}
              onChange={(event) => change("name", event.target.value)}
              onBlur={() => {
                if (!draft.name.trim()) setErrors((current) => ({ ...current, name: "Name is required" }));
              }}
              aria-invalid={invalid("name")}
              aria-describedby={invalid("name") ? "name-error" : undefined}
            />
            {error("name") && <span className="field-error" id="name-error">{error("name")}</span>}
          </div>
          <div className="field">
            <label htmlFor="patient-age">Age</label>
            <input
              id="patient-age"
              name="age"
              type="number"
              min="0"
              max="120"
              step="1"
              inputMode="numeric"
              placeholder="Years"
              value={draft.age}
              onChange={(event) => change("age", event.target.value)}
              onBlur={() => {
                if (!draft.age.trim()) setErrors((current) => ({ ...current, age: "Age is required" }));
              }}
              aria-invalid={invalid("age")}
              aria-describedby={invalid("age") ? "age-error" : undefined}
            />
            {error("age") && <span className="field-error" id="age-error">{error("age")}</span>}
          </div>
          {select("gender", "Gender", options.genders)}
          {select("ward", "Ward", options.wards)}
          {select("department", "Department", options.departments)}
          {select("doctor", "Doctor", options.doctors)}
          <div className="field">
            <label htmlFor="patient-date">Admission date</label>
            <div className="date-field">
              <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
              <input
                id="patient-date"
                name="admission_date"
                type="date"
                max={indiaToday()}
                value={draft.admission_date}
                onChange={(event) => change("admission_date", event.target.value)}
                aria-invalid={invalid("admission_date")}
                aria-describedby={invalid("admission_date") ? "date-error" : undefined}
              />
            </div>
            {error("admission_date") && <span className="field-error" id="date-error">{error("admission_date")}</span>}
          </div>
          {patient && (
            <div className="field">
              <span className="label-like">Status</span>
              <div className="readonly-field">{patient.status}</div>
              <small>Status changes through the discharge action.</small>
            </div>
          )}
        </div>
        {message && <div className="form-alert" role="alert">{message}</div>}
        <div className="dialog-footer">
          <button type="button" className="button button-quiet" onClick={dismiss} disabled={saving}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={saving || missing}>
            {saving ? "Saving…" : patient ? "Save changes" : "Add patient"}
            {!saving && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </div>
      </form>
    </dialog>
  );
}
