// Recordatorios 24 h antes (FR-009). Idempotente: la clave incluye el horario de la cita.
import { HOUR } from '../domain/time.js';
import { formatLocal } from '../domain/time.js';
import { enqueue, deliverPending } from './notifications.js';

/** Encola recordatorios pendientes y entrega el outbox. Devuelve cuántos se encolaron. */
export async function tick({ db, clock, tz }, mailer) {
  const now = clock.now();
  const nowIso = now.toISOString();
  const horizon = new Date(now.getTime() + 24 * HOUR).toISOString();
  const rows = db.prepare(
    `SELECT a.id, a.starts_at, a.updated_at, p.name AS patient_name, p.email, d.name AS doctor_name, s.name AS specialty_name
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = d.specialty_id
      WHERE a.status = 'active' AND a.starts_at > ? AND a.starts_at <= ?`,
  ).all(nowIso, horizon);

  let queued = 0;
  for (const a of rows) {
    // Reservada (o reprogramada) con menos de 24 h de anticipación: solo confirmación, sin recordatorio.
    const reminderDue = new Date(new Date(a.starts_at).getTime() - 24 * HOUR).toISOString();
    if (a.updated_at > reminderDue) continue;
    const created = enqueue(db, clock, {
      appointmentId: a.id,
      kind: 'reminder',
      dedupeKey: `reminder:${a.id}:${a.starts_at}`,
      to: a.email,
      subject: 'Recordatorio de tu cita de mañana',
      body: `Hola ${a.patient_name},\n\nTe recordamos tu cita:\nMédico: ${a.doctor_name} (${a.specialty_name})\nFecha y hora: ${formatLocal(new Date(a.starts_at), tz)}\n\nSi no puedes asistir, reprograma o cancela desde "Mis citas" hasta 24 horas antes.\n\nTurnoYa`,
    });
    if (created) queued += 1;
  }
  await deliverPending(db, mailer, clock);
  return queued;
}
