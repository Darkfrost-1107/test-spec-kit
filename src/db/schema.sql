CREATE TABLE IF NOT EXISTS specialties (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  duration_min INTEGER NOT NULL CHECK (duration_min IN (30, 45)),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  specialty_id INTEGER NOT NULL REFERENCES specialties(id),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('patient', 'reception', 'doctor', 'admin')),
  doctor_id INTEGER REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  consecutive_no_shows INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_no_shows >= 0)
);

CREATE TABLE IF NOT EXISTS work_schedules (
  id INTEGER PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS holidays (
  date TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'attended', 'no_show')),
  created_by TEXT NOT NULL CHECK (created_by IN ('patient', 'reception')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_doctor_start
  ON appointments(doctor_id, starts_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ix_appt_patient ON appointments(patient_id, status);
CREATE INDEX IF NOT EXISTS ix_appt_doctor ON appointments(doctor_id, starts_at);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id),
  kind TEXT NOT NULL CHECK (kind IN ('confirmation', 'rescheduled', 'cancelled', 'reminder')),
  dedupe_key TEXT NOT NULL UNIQUE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  csrf TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
