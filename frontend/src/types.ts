export type PatientStatus = "Admitted" | "Discharged";

export type PatientFields = {
  name: string;
  age: number;
  gender: string;
  ward: string;
  department: string;
  doctor: string;
  admission_date: string;
};

export type Patient = PatientFields & {
  id: string;
  status: PatientStatus;
};

export type PatientDraft = Omit<PatientFields, "age"> & { age: string };

export type Options = {
  genders: string[];
  wards: string[];
  departments: string[];
  doctors: string[];
};

export type PatientPage = {
  patients: Patient[];
  total: number;
  page: number;
  total_pages: number;
  page_size: number;
};

export type PatientSummary = {
  total: number;
  admitted: number;
  discharged: number;
  active_wards: number;
};

export type Filters = {
  search: string;
  ward: string;
  department: string;
  doctor: string;
};
