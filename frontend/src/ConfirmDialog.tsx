import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { api, ApiError } from "./api";
import type { Patient } from "./types";

type Props = {
  patient: Patient;
  action: "discharge" | "delete";
  onClose: () => void;
  onDone: (action: "discharged" | "deleted") => void;
  onListChanged: () => void;
};

export default function ConfirmDialog({ patient, action, onClose, onDone, onListChanged }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    window.requestAnimationFrame(() => cancelRef.current?.focus());
  }, []);

  function dismiss() {
    if (!busy) dialogRef.current?.close();
  }

  async function confirm() {
    if (busy || stale) return;
    setBusy(true);
    setMessage("");
    try {
      if (action === "discharge") {
        await api.discharge(patient.id);
        onDone("discharged");
      } else {
        await api.delete(patient.id);
        onDone("deleted");
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
        if (error.status === 404 || error.status === 409) {
          setStale(true);
          onListChanged();
        }
      } else {
        setMessage("Could not complete this action. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const deleting = action === "delete";
  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClose={onClose}
      aria-labelledby="confirm-title"
    >
      <div className="confirm-top">
        <span className={deleting ? "confirm-icon danger" : "confirm-icon"}>
          <AlertTriangle size={24} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <button type="button" className="icon-button" onClick={dismiss} aria-label="Close confirmation" disabled={busy}>
          <X size={20} strokeWidth={1.8} />
        </button>
      </div>
      <h2 id="confirm-title">{deleting ? "Delete this record?" : "Mark as discharged?"}</h2>
      <p>
        {deleting
          ? "Delete the record for " + patient.name + "? This cannot be undone."
          : "Mark " + patient.name + " as discharged? Their record will stay in the register."}
      </p>
      <div className="confirm-patient">
        <strong>{patient.name}</strong>
        <span>{patient.ward} · {patient.admission_date} · #{patient.id.slice(0, 8)}</span>
      </div>
      {message && <div className="form-alert" role="alert">{message}</div>}
      <div className="dialog-footer">
        <button ref={cancelRef} type="button" className="button button-quiet" onClick={dismiss} disabled={busy}>Cancel</button>
        <button type="button" className={deleting ? "button button-danger" : "button button-primary"} onClick={confirm} disabled={busy || stale}>
          {busy ? "Working…" : deleting ? "Delete record" : "Discharge patient"}
          {!busy && <ArrowRight size={17} aria-hidden="true" />}
        </button>
      </div>
    </dialog>
  );
}
