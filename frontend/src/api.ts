import type { Filters, Options, Patient, PatientFields, PatientPage, PatientSummary } from "./types";

const localApi = "http://" + window.location.hostname + ":8000";
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || localApi).replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  uncertain: boolean;

  constructor(message: string, status = 0, fieldErrors: Record<string, string> = {}, uncertain = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.uncertain = uncertain;
  }
}

async function request<T>(path: string, init: RequestInit = {}, write = false): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), write ? 90_000 : 100_000);
  try {
    const response = await fetch(BASE_URL + path, {
      ...init,
      signal: controller.signal,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        typeof body.message === "string" ? body.message : "Could not complete this request. Please try again.",
        response.status,
        body.field_errors || {},
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (write) {
      throw new ApiError(
        "Saving could not be confirmed. Check the patient list before trying again.",
        0,
        {},
        true,
      );
    }
    throw new ApiError("Could not reach Care Desk. Please try refreshing.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  options: () => request<Options>("/api/options"),
  summary: () => request<PatientSummary>("/api/summary"),
  patients: (filters: Filters, page: number) => {
    const params = new URLSearchParams({ page: String(page) });
    const search = filters.search.trim();
    if (search) params.set("search", search);
    if (filters.ward) params.set("ward", filters.ward);
    if (filters.department) params.set("department", filters.department);
    if (filters.doctor) params.set("doctor", filters.doctor);
    return request<PatientPage>("/api/patients?" + params.toString());
  },
  add: (fields: PatientFields) =>
    request<Patient>("/api/patients", { method: "POST", body: JSON.stringify(fields) }, true),
  edit: (id: string, fields: PatientFields) =>
    request<Patient>("/api/patients/" + id, { method: "PUT", body: JSON.stringify(fields) }, true),
  discharge: (id: string) =>
    request<Patient>("/api/patients/" + id + "/discharge", { method: "PATCH" }, true),
  delete: (id: string) =>
    request<void>("/api/patients/" + id, { method: "DELETE" }, true),
};
