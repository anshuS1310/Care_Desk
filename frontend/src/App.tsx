import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Activity,
  ArrowRight,
  BedDouble,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import ConfirmDialog from "./ConfirmDialog";
import PatientForm from "./PatientForm";
import type { Filters, Options, Patient, PatientPage, PatientSummary } from "./types";
import { indiaToday } from "./validation";

const EMPTY_FILTERS: Filters = { search: "", ward: "", department: "", doctor: "" };

function prettyDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
}

function PatientBadge({ status }: { status: Patient["status"] }) {
  return (
    <span className={status === "Admitted" ? "status-badge admitted" : "status-badge discharged"}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

function PatientActions({
  patient,
  onEdit,
  onDischarge,
  onDelete,
}: {
  patient: Patient;
  onEdit: (event: MouseEvent<HTMLButtonElement>, patient: Patient) => void;
  onDischarge: (event: MouseEvent<HTMLButtonElement>, patient: Patient) => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>, patient: Patient) => void;
}) {
  return (
    <div className="patient-actions">
      <button type="button" className="action-button" onClick={(event) => onEdit(event, patient)} title={"Edit " + patient.name}>
        <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />
        <span>Edit</span>
      </button>
      {patient.status === "Admitted" && (
        <button type="button" className="action-button discharge-action" onClick={(event) => onDischarge(event, patient)} title={"Discharge " + patient.name}>
          <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Discharge</span>
        </button>
      )}
      <button type="button" className="action-button delete-action" onClick={(event) => onDelete(event, patient)} title={"Delete " + patient.name}>
        <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
        <span>Delete</span>
      </button>
    </div>
  );
}

export default function App() {
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [result, setResult] = useState<PatientPage | null>(null);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [listError, setListError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formPatient, setFormPatient] = useState<Patient | "add" | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ patient: Patient; action: "delete" | "discharge" } | null>(null);
  const [toast, setToast] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    api.health().catch(() => undefined);
    loadOptions();
  }, []);

  useEffect(() => {
    let current = true;
    api.summary()
      .then((data) => { if (current) setSummary(data); })
      .catch(() => { if (current) setSummary(null); });
    return () => { current = false; };
  }, [refreshKey]);

  function loadOptions() {
    setOptionsError("");
    api.options()
      .then(setOptions)
      .catch((error) => setOptionsError(error instanceof ApiError ? error.message : "Could not load form choices."));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchInput }));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setListError("");
    const timer = window.setTimeout(() => {
      if (current) setSlow(true);
    }, 3500);
    api.patients(filters, page)
      .then((data) => {
        if (!current) return;
        setResult(data);
        setPage(data.page);
        setListError("");
      })
      .catch((error) => {
        if (current) setListError(error instanceof ApiError ? error.message : "Could not load patient records.");
      })
      .finally(() => {
        if (current) {
          setLoading(false);
          setSlow(false);
        }
        window.clearTimeout(timer);
      });
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [filters, page, refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function updateFilter(field: "ward" | "department" | "doctor", value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  function openForm(event: MouseEvent<HTMLButtonElement>, patient: Patient | "add") {
    returnFocus.current = event.currentTarget;
    setFormPatient(patient);
  }

  function openConfirm(event: MouseEvent<HTMLButtonElement>, patient: Patient, action: "delete" | "discharge") {
    returnFocus.current = event.currentTarget;
    setConfirmTarget({ patient, action });
  }

  function closeOverlay() {
    setFormPatient(null);
    setConfirmTarget(null);
    window.requestAnimationFrame(() => returnFocus.current?.focus());
  }

  function onSaved(action: "added" | "updated") {
    closeOverlay();
    setToast(action === "added" ? "Patient added to the register." : "Patient details updated.");
    refresh();
  }

  function onConfirmed(action: "discharged" | "deleted") {
    closeOverlay();
    setToast(action === "discharged" ? "Patient marked as discharged." : "Patient record deleted.");
    refresh();
  }

  const filtered = Boolean(searchInput || filters.ward || filters.department || filters.doctor);
  const total = result?.total ?? 0;
  const firstShown = result && result.total ? (result.page - 1) * result.page_size + 1 : 0;
  const lastShown = result ? Math.min(result.page * result.page_size, result.total) : 0;
  const admittedRate = summary && summary.total > 0 ? Math.round((summary.admitted / summary.total) * 100) : 0;

  const actions = (patient: Patient) => (
    <PatientActions
      patient={patient}
      onEdit={(event, chosen) => openForm(event, chosen)}
      onDischarge={(event, chosen) => openConfirm(event, chosen, "discharge")}
      onDelete={(event, chosen) => openConfirm(event, chosen, "delete")}
    />
  );

  return (
    <div className="app-shell workspace-layout">
      <aside className="workspace-rail" aria-label="Workspace navigation">
        <a className="brand rail-brand" href="#overview" aria-label="Care Desk overview">
          <span className="brand-mark"><HeartPulse size={24} strokeWidth={2.1} aria-hidden="true" /></span>
          <span>Care<span className="brand-accent">Desk</span><span className="brand-period">.</span></span>
        </a>
        <nav className="rail-navigation" aria-label="Sections">
          <span className="rail-caption">WORKSPACE</span>
          <a className="rail-link rail-link-current" href="#overview"><LayoutDashboard size={19} aria-hidden="true" /> Overview</a>
          <a className="rail-link" href="#register"><UsersRound size={19} aria-hidden="true" /> Patient register</a>
          <button type="button" className="rail-link" onClick={refresh}><RefreshCw size={19} aria-hidden="true" /> Refresh records</button>
        </nav>
        <div className="rail-action-card">
          <div className="rail-action-icon"><Plus size={20} aria-hidden="true" /></div>
          <strong>New admission?</strong>
          <p>Start a patient record in a few simple steps.</p>
          <button type="button" onClick={(event) => openForm(event, "add")} disabled={!options}>Add a patient <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="rail-foot"><span className="tiny-live-dot" /> Fictional demo workspace</div>
      </aside>

      <div className="workspace-content">
        <header className="site-header">
          <div className="header-inner">
            <div className="header-title"><span className="header-kicker">CARE DESK / OVERVIEW</span><strong>Admissions workspace</strong></div>
            <div className="header-right">
              <span className="header-date"><CalendarDays size={17} aria-hidden="true" /> {prettyDate(indiaToday())}</span>
              <button type="button" className="button button-primary header-add" onClick={(event) => openForm(event, "add")} disabled={!options}>
                <Plus size={18} strokeWidth={2.2} aria-hidden="true" /> Add patient
              </button>
            </div>
          </div>
        </header>

      <main className="main-content">
        <section className="overview-panel" id="overview" aria-labelledby="page-title">
          <div className="overview-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> ONE PLACE FOR EVERY ADMISSION</div>
            <h1 id="page-title">Every patient,<br /><em>in clear view.</em></h1>
            <p>Keep the day moving with a register that makes admissions, ward details, and discharge status easy to find.</p>
            <div className="overview-meta"><span className="tiny-live-dot" /> Your register is ready <span className="meta-divider" /> India time</div>
          </div>
          <div className="overview-art" aria-hidden="true">
            <div className="orbit orbit-outer" /><div className="orbit orbit-inner" />
            <div className="flow-card flow-card-a"><span className="flow-icon blue"><UserRound size={17} /></span><span><strong>Patient details</strong><small>One clear record</small></span></div>
            <div className="flow-card flow-card-b"><span className="flow-icon mint"><BedDouble size={17} /></span><span><strong>Ward & care</strong><small>Easy to locate</small></span></div>
            <div className="flow-card flow-card-c"><span className="flow-icon cream"><CheckCircle2 size={17} /></span><span><strong>Discharge</strong><small>Status stays visible</small></span></div>
            <div className="art-cross art-cross-one">+</div><div className="art-cross art-cross-two">+</div>
          </div>
        </section>

        <section className="metric-grid" aria-label="Admissions overview">
          <article className="metric-card metric-card-featured">
            <div className="metric-top"><span>ALL RECORDS</span><ClipboardList size={20} aria-hidden="true" /></div>
            <strong className="metric-value">{summary ? summary.total.toLocaleString("en-IN") : "—"}</strong>
            <p>Patients in the register</p>
            <span className="metric-spark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>CURRENTLY ADMITTED</span><BedDouble size={20} aria-hidden="true" /></div>
            <strong className="metric-value">{summary ? summary.admitted.toLocaleString("en-IN") : "—"}</strong>
            <p>{summary ? admittedRate + "% of all records" : "Live status"}</p>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>DISCHARGED</span><CheckCircle2 size={20} aria-hidden="true" /></div>
            <strong className="metric-value">{summary ? summary.discharged.toLocaleString("en-IN") : "—"}</strong>
            <p>Records kept for reference</p>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>ACTIVE WARDS</span><Activity size={20} aria-hidden="true" /></div>
            <strong className="metric-value">{summary ? summary.active_wards.toLocaleString("en-IN") : "—"}</strong>
            <p>Wards with admitted patients</p>
          </article>
        </section>

        <section className="register-section" id="register" aria-labelledby="register-title">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE DAILY REGISTER</div>
              <h2 id="register-title">Patient register</h2>
              <p>Search, update, and follow each admission from one place.</p>
            </div>
            <button type="button" className="button button-outline refresh-button" onClick={refresh} disabled={loading}>
              <RefreshCw size={17} aria-hidden="true" className={loading ? "spinning" : ""} />
              Refresh
            </button>
          </div>

          <div className="filter-panel">
            <div className="filter-heading"><SlidersHorizontal size={18} aria-hidden="true" /> Search & filter</div>
            <div className="filter-grid">
              <div className="filter-field search-field">
                <label htmlFor="patient-search">Patient name</label>
                <div className="search-control">
                  <Search size={19} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    id="patient-search"
                    type="search"
                    placeholder="Search by name..."
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </div>
              </div>
              <div className="filter-field">
                <label htmlFor="ward-filter">Ward</label>
                <select id="ward-filter" value={filters.ward} onChange={(event) => updateFilter("ward", event.target.value)} disabled={!options}>
                  <option value="">All wards</option>
                  {options?.wards.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="department-filter">Department</label>
                <select id="department-filter" value={filters.department} onChange={(event) => updateFilter("department", event.target.value)} disabled={!options}>
                  <option value="">All departments</option>
                  {options?.departments.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="doctor-filter">Doctor</label>
                <select id="doctor-filter" value={filters.doctor} onChange={(event) => updateFilter("doctor", event.target.value)} disabled={!options}>
                  <option value="">All doctors</option>
                  {options?.doctors.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            </div>
            <div className="filter-footer">
              <span>{loading ? "Updating records…" : total === 0 ? "No records shown" : "Showing " + firstShown + "–" + lastShown + " of " + total + " patients"}</span>
              {filtered && <button type="button" className="text-button" onClick={clearFilters}><X size={15} aria-hidden="true" /> Clear filters</button>}
            </div>
          </div>

          {optionsError && (
            <div className="notice error-notice" role="alert">
              <span>{optionsError} Patient forms and filters are unavailable.</span>
              <button type="button" onClick={loadOptions}>Try again</button>
            </div>
          )}
          {slow && loading && (
            <div className="notice connection-notice" role="status">Connecting to Care Desk. The server may be waking up…</div>
          )}
          {listError && (
            <div className="notice error-notice" role="alert">
              <span>{listError}</span>
              <button type="button" onClick={refresh}>Try again</button>
            </div>
          )}

          <div className="list-surface">
            <div className="list-topline">
              <div className="list-title"><span className="list-title-icon"><UserRound size={18} aria-hidden="true" /></span> Patient records</div>
              <span className="list-count">{result ? result.total.toLocaleString("en-IN") + " total" : "Loading"}</span>
            </div>
            {loading && !result ? (
              <div className="skeleton-list" aria-label="Loading patients">
                {[1, 2, 3].map((item) => <div key={item} className="skeleton-row"><span /><span /><span /></div>)}
              </div>
            ) : result && result.patients.length > 0 ? (
              <>
                <div className="table-wrap">
                  <table className="patient-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Age / gender</th>
                        <th>Ward</th>
                        <th>Department</th>
                        <th>Doctor</th>
                        <th>Admitted on</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.patients.map((patient) => (
                        <tr key={patient.id}>
                          <td><div className="patient-identity"><span className="patient-avatar">{patient.name.charAt(0).toUpperCase()}</span><div><strong>{patient.name}</strong><small>#{patient.id.slice(0, 8)}</small></div></div></td>
                          <td>{patient.age} years <span className="muted-inline">· {patient.gender}</span></td>
                          <td>{patient.ward}</td>
                          <td>{patient.department}</td>
                          <td>{patient.doctor}</td>
                          <td>{prettyDate(patient.admission_date)}</td>
                          <td><PatientBadge status={patient.status} /></td>
                          <td>{actions(patient)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="patient-cards">
                  {result.patients.map((patient) => (
                    <article className="patient-card" key={patient.id}>
                      <div className="card-top">
                        <div className="patient-identity">
                          <span className="patient-avatar">{patient.name.charAt(0).toUpperCase()}</span>
                          <div><h3>{patient.name}</h3><small>#{patient.id.slice(0, 8)}</small></div>
                        </div>
                        <PatientBadge status={patient.status} />
                      </div>
                      <div className="card-details">
                        <div><span>Age / gender</span><strong>{patient.age} years · {patient.gender}</strong></div>
                        <div><span>Ward</span><strong>{patient.ward}</strong></div>
                        <div><span>Department</span><strong>{patient.department}</strong></div>
                        <div><span>Doctor</span><strong>{patient.doctor}</strong></div>
                        <div><span>Admitted on</span><strong>{prettyDate(patient.admission_date)}</strong></div>
                      </div>
                      {actions(patient)}
                    </article>
                  ))}
                </div>
              </>
            ) : !loading && !listError ? (
              <div className="empty-state">
                <div className="empty-icon">{filtered ? <Search size={29} strokeWidth={1.6} /> : <Building2 size={29} strokeWidth={1.6} />}</div>
                <h3>{filtered ? "No matching patients" : "Your register starts here"}</h3>
                <p>{filtered ? "Try a different search or clear your filters." : "Add the first patient to begin your admissions register."}</p>
                {filtered ? (
                  <button type="button" className="button button-outline" onClick={clearFilters}>Clear filters</button>
                ) : (
                  <button type="button" className="button button-primary" onClick={(event) => openForm(event, "add")} disabled={!options}>
                    <Plus size={17} aria-hidden="true" /> Add patient
                  </button>
                )}
              </div>
            ) : null}
            {result && (
              <div className="pagination">
                <span>Page {result.page} of {result.total_pages} · {result.total.toLocaleString("en-IN")} patients</span>
                <div className="page-buttons">
                  <button type="button" className="page-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || result.page <= 1} aria-label="Previous page"><ChevronLeft size={19} /></button>
                  <button type="button" className="page-button" onClick={() => setPage((current) => Math.min(result.total_pages, current + 1))} disabled={loading || result.page >= result.total_pages} aria-label="Next page"><ChevronRight size={19} /></button>
                </div>
              </div>
            )}
          </div>
        </section>
        <footer className="site-footer">
          <span><HeartPulse size={17} aria-hidden="true" /> Care Desk</span>
          <span>Fictional demo data only · Do not enter real patient information</span>
        </footer>
      </main>
      </div>

      {formPatient && options && (
        <PatientForm
          key={formPatient === "add" ? "add" : formPatient.id}
          patient={formPatient === "add" ? null : formPatient}
          options={options}
          onClose={closeOverlay}
          onSaved={onSaved}
          onListChanged={refresh}
        />
      )}
      {confirmTarget && (
        <ConfirmDialog
          key={confirmTarget.action + confirmTarget.patient.id}
          patient={confirmTarget.patient}
          action={confirmTarget.action}
          onClose={closeOverlay}
          onDone={onConfirmed}
          onListChanged={refresh}
        />
      )}
      {toast && <div className="toast" role="status"><span className="toast-dot" /> {toast}<button type="button" onClick={() => setToast("")} aria-label="Dismiss notice"><X size={16} /></button></div>}
    </div>
  );
}
