// Orquesta dominio + base de datos. Cada operación es una transacción atómica (FR-005).
import { tx } from '../db/db.js';
import { BizError } from '../domain/errors.js';
import { availableSlots } from '../domain/availability.js';
import { validateBooking, canModify, applyAttendance } from '../domain/rules.js';
import { addMinutes, localDate, formatLocal } from '../domain/time.js';
import { isIso } from '../web/validate.js';
import { enqueue } from './notifications.js';

// ---- consultas ---------------------------------------------------------------------------
export function loadDoctor(db, id) {
  return db.prepare(
    `SELECT d.id, d.name, d.active, d.specialty_id, s.duration_min, s.name AS specialty_name, s.active AS specialty_active
       FROM doctors d JOIN specialties s ON s.id = d.specialty_id WHERE d.id = ?`,
  ).get(id);
}

const activeOfDoctor = (db, id, exclude = null) =>
  db.prepare(`SELECT * FROM appointments WHERE doctor_id = ? AND status = 'active' AND id IS NOT ?`).all(id, exclude);
const activeOfPatient = (db, id, exclude = null) =>
  db.prepare(`SELECT * FROM appointments WHERE patient_id = ? AND status = 'active' AND id IS NOT ?`).all(id, exclude);

export function slotsFor(ctx, doctor, date, { enforceNotice = true, excludeApptId = null } = {}) {
  const { db, clock, tz } = ctx;
  if (!doctor || !doctor.active || !doctor.specialty_active) return [];
  return availableSlots({
    date,
    durationMin: doctor.duration_min,
    schedules: db.prepare('SELECT * FROM work_schedules WHERE doctor_id = ?').all(doctor.id),
    blocks: db.prepare('SELECT starts_at, ends_at FROM blocks WHERE doctor_id = ?').all(doctor.id),
    holidays: db.prepare('SELECT date FROM holidays').all().map((h) => h.date),
    appointments: activeOfDoctor(db, doctor.id, excludeApptId),
    now: clock.now(),
    tz,
    enforceNotice,
  });
}

export function searchAvailability(ctx, { specialtyId, doctorId, date }) {
  const doctors = ctx.db.prepare(
    `SELECT d.id FROM doctors d JOIN specialties s ON s.id = d.specialty_id
      WHERE d.active = 1 AND s.active = 1 AND (? IS NULL OR d.specialty_id = ?) AND (? IS NULL OR d.id = ?) ORDER BY d.name`,
  ).all(specialtyId ?? null, specialtyId ?? null, doctorId ?? null, doctorId ?? null);
  return doctors.map(({ id }) => {
    const doctor = loadDoctor(ctx.db, id);
    return { doctor, slots: slotsFor(ctx, doctor, date, { enforceNotice: true }) };
  });
}

export function getAppointment(db, id) {
  return db.prepare(
    `SELECT a.*, p.name AS patient_name, p.email AS patient_email, d.name AS doctor_name, s.name AS specialty_name
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = d.specialty_id WHERE a.id = ?`,
  ).get(id);
}

export function listPatientAppointments(db, patientId) {
  return db.prepare(
    `SELECT a.*, d.name AS doctor_name, s.name AS specialty_name
       FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN specialties s ON s.id = d.specialty_id
      WHERE a.patient_id = ? ORDER BY a.starts_at DESC`,
  ).all(patientId);
}

export function listPatients(db) {
  return db.prepare('SELECT id, name, email, consecutive_no_shows FROM patients ORDER BY name').all();
}

// ---- helpers -----------------------------------------------------------------------------
function instant(startsAt) {
  if (!isIso(startsAt)) throw new BizError('INVALID');
  return new Date(startsAt);
}

const summary = (ctx, appt, doctor) =>
  `Médico: ${doctor.name} (${doctor.specialty_name})\nFecha y hora: ${formatLocal(new Date(appt.starts_at), ctx.tz)}`;

function notify(ctx, patient, appt, doctor, kind, key, subject, extra = '') {
  enqueue(ctx.db, ctx.clock, {
    appointmentId: appt.id, kind, dedupeKey: key, to: patient.email, subject,
    body: `Hola ${patient.name},\n\n${extra}${summary(ctx, appt, doctor)}\n\nTurnoYa`,
  });
}

// ---- operaciones -------------------------------------------------------------------------
/** Reserva (FR-003). actor: 'patient' | 'reception'. newPatient solo para recepción. */
export function book(ctx, { actor, patientId, newPatient, doctorId, startsAt }) {
  const { db, clock, tz } = ctx;
  return tx(db, () => {
    const doctor = loadDoctor(db, doctorId);
    if (!doctor || !doctor.active || !doctor.specialty_active) throw new BizError('DOCTOR_UNAVAILABLE');
    let patient;
    if (patientId) patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
    else if (actor === 'reception' && newPatient) {
      const r = db.prepare('INSERT INTO patients (name, email, phone) VALUES (?, ?, ?)')
        .run(newPatient.name, newPatient.email || null, newPatient.phone || null);
      patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(Number(r.lastInsertRowid));
    }
    if (!patient) throw new BizError('NOT_FOUND');

    const start = instant(startsAt);
    const end = addMinutes(start, doctor.duration_min);
    const code = validateBooking({
      actor, now: clock.now(), startsAt: start, endsAt: end,
      doctorAppts: activeOfDoctor(db, doctor.id), patientAppts: activeOfPatient(db, patient.id),
      noShows: patient.consecutive_no_shows,
    });
    if (code) throw new BizError(code);
    const slots = slotsFor(ctx, doctor, localDate(start, tz), { enforceNotice: actor === 'patient' });
    if (!slots.some((s) => s.startsAt === start.toISOString())) throw new BizError('SLOT_TAKEN');

    const nowIso = clock.now().toISOString();
    const r = db.prepare(
      `INSERT INTO appointments (patient_id, doctor_id, starts_at, ends_at, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).run(patient.id, doctor.id, start.toISOString(), end.toISOString(), actor, nowIso, nowIso);
    const id = Number(r.lastInsertRowid);
    notify(ctx, patient, { id, starts_at: start.toISOString() }, doctor, 'confirmation', `confirmation:${id}`,
      'Cita confirmada', 'Tu cita fue confirmada.\n\n');
    return id;
  });
}

function loadForChange(db, apptId, actor, patientId) {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId);
  if (!appt) throw new BizError('NOT_FOUND');
  if (actor === 'patient' && appt.patient_id !== patientId) throw new BizError('NOT_OWNER');
  if (appt.status !== 'active') throw new BizError('NOT_ACTIVE');
  return appt;
}

/** Reprogramación (FR-008): el paciente hasta 24 h antes; recepción sin ese límite. */
export function reschedule(ctx, { actor, patientId, apptId, startsAt }) {
  const { db, clock, tz } = ctx;
  return tx(db, () => {
    const appt = loadForChange(db, apptId, actor, patientId);
    if (actor === 'patient' && !canModify(clock.now(), appt.starts_at)) throw new BizError('TOO_LATE_TO_CHANGE');
    const doctor = loadDoctor(db, appt.doctor_id);
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(appt.patient_id);
    const start = instant(startsAt);
    const end = addMinutes(start, doctor.duration_min);
    const code = validateBooking({
      actor, now: clock.now(), startsAt: start, endsAt: end,
      doctorAppts: activeOfDoctor(db, doctor.id, appt.id), patientAppts: activeOfPatient(db, patient.id, appt.id),
      noShows: 0, // el bloqueo por inasistencias aplica solo a reservas nuevas en línea
    });
    if (code) throw new BizError(code);
    const slots = slotsFor(ctx, doctor, localDate(start, tz), { enforceNotice: actor === 'patient', excludeApptId: appt.id });
    if (!slots.some((s) => s.startsAt === start.toISOString())) throw new BizError('SLOT_TAKEN');

    const previous = formatLocal(new Date(appt.starts_at), tz);
    db.prepare('UPDATE appointments SET starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ?')
      .run(start.toISOString(), end.toISOString(), clock.now().toISOString(), appt.id);
    notify(ctx, patient, { id: appt.id, starts_at: start.toISOString() }, doctor, 'rescheduled',
      `rescheduled:${appt.id}:${start.toISOString()}`, 'Cita reprogramada', `Tu cita fue reprogramada (antes: ${previous}).\n\n`);
    return appt.id;
  });
}

/** Cancelación (FR-008). */
export function cancel(ctx, { actor, patientId, apptId }) {
  const { db, clock, tz } = ctx;
  return tx(db, () => {
    const appt = loadForChange(db, apptId, actor, patientId);
    if (actor === 'patient' && !canModify(clock.now(), appt.starts_at)) throw new BizError('TOO_LATE_TO_CHANGE');
    const doctor = loadDoctor(db, appt.doctor_id);
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(appt.patient_id);
    db.prepare(`UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?`)
      .run(clock.now().toISOString(), appt.id);
    notify({ db, clock, tz }, patient, appt, doctor, 'cancelled', `cancelled:${appt.id}`, 'Cita cancelada', 'Tu cita fue cancelada.\n\n');
    return appt.id;
  });
}

/** Marca asistencia (FR-011, FR-021). Solo citas activas que ya comenzaron. */
export function markAttendance(ctx, { apptId, result }) {
  const { db, clock } = ctx;
  if (result !== 'attended' && result !== 'no_show') throw new BizError('INVALID');
  return tx(db, () => {
    const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId);
    if (!appt) throw new BizError('NOT_FOUND');
    if (appt.status !== 'active') throw new BizError('NOT_ACTIVE');
    if (appt.starts_at > clock.now().toISOString()) throw new BizError('NOT_STARTED');
    db.prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?').run(result, clock.now().toISOString(), apptId);
    const p = db.prepare('SELECT consecutive_no_shows AS n FROM patients WHERE id = ?').get(appt.patient_id);
    db.prepare('UPDATE patients SET consecutive_no_shows = ? WHERE id = ?').run(applyAttendance(p.n, result), appt.patient_id);
    return apptId;
  });
}
