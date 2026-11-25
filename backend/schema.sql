CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    age SMALLINT NOT NULL CHECK (age BETWEEN 0 AND 120),
    gender TEXT NOT NULL,
    ward TEXT NOT NULL,
    department TEXT NOT NULL,
    doctor TEXT NOT NULL,
    admission_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Admitted'
        CHECK (status IN ('Admitted', 'Discharged')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patients_status_date_id_idx
    ON patients (status, admission_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS patients_ward_idx ON patients (ward);
CREATE INDEX IF NOT EXISTS patients_department_idx ON patients (department);
CREATE INDEX IF NOT EXISTS patients_doctor_idx ON patients (doctor);
