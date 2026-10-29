// Administración de especialidades, médicos, horarios y feriados (FR-014, FR-019).
import { tx } from '../db/db.js';
import { createUser, emailTaken } from './auth.js';

export const listSpecialties = (db) => db.prepare('SELECT * FROM specialties ORDER BY name').all();
export const listDoctors = (db) =>
  db.prepare(
    `SELECT d.*, s.name AS specialty_name, s.duration_min FROM doctors d JOIN specialties s ON s.id = d.specialty_id ORDER BY d.name`,
  ).all();
export const listSchedules = (db, doctorId) =>
  db.prepare('SELECT * FROM work_schedules WHERE doctor_id = ? ORDER BY weekday, start_time').all(doctorId);
export const listHolidays = (db) => db.prepare('SELECT * FROM holidays ORDER BY date').all();

export function createSpecialty(db, { name, durationMin }) {
  try {
    return Number(db.prepare('INSERT INTO specialties (name, duration_min) VALUES (?, ?)').run(name, durationMin).lastInsertRowid);
  } catch {
    return { errors: { name: 'Ya existe una especialidad con ese nombre.' } };
  }
}

export function setSpecialtyActive(db, id, active) {
  db.prepare('UPDATE specialties SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

/** Crea el médico y su cuenta de acceso (rol doctor). */
export function createDoctor(db, { name, specialtyId, email, password }) {
  return tx(db, () => {
    if (emailTaken(db, email)) return { errors: { email: 'Ese correo ya está registrado.' } };
    if (!db.prepare('SELECT 1 FROM specialties WHERE id = ?').get(specialtyId)) return { errors: { specialty_id: 'Elige una especialidad válida.' } };
    const doctorId = Number(db.prepare('INSERT INTO doctors (name, specialty_id) VALUES (?, ?)').run(name, specialtyId).lastInsertRowid);
    createUser(db, { email, password, name, role: 'doctor', doctorId });
    return doctorId;
  });
}

export function setDoctorActive(db, id, active) {
  db.prepare('UPDATE doctors SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

/** Agrega una franja semanal; no puede solaparse con otra del mismo día. */
export function addSchedule(db, { doctorId, weekday, start, end }) {
  if (!(start < end)) return { errors: { end: 'La hora de fin debe ser posterior a la de inicio.' } };
  const overlap = db.prepare(
    'SELECT 1 FROM work_schedules WHERE doctor_id = ? AND weekday = ? AND start_time < ? AND ? < end_time',
  ).get(doctorId, weekday, end, start);
  if (overlap) return { errors: { start: 'La franja se solapa con otra del mismo día.' } };
  return Number(db.prepare('INSERT INTO work_schedules (doctor_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)')
    .run(doctorId, weekday, start, end).lastInsertRowid);
}

export function deleteSchedule(db, { scheduleId, doctorId }) {
  return db.prepare('DELETE FROM work_schedules WHERE id = ? AND doctor_id = ?').run(scheduleId, doctorId).changes === 1;
}

export function addHoliday(db, { date, name }) {
  try {
    db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)').run(date, name);
    return {};
  } catch {
    return { errors: { date: 'Esa fecha ya está registrada como feriado.' } };
  }
}

export function deleteHoliday(db, date) {
  return db.prepare('DELETE FROM holidays WHERE date = ?').run(date).changes === 1;
}
