// Reglas de negocio puras: sin base de datos, sin HTTP, sin leer el reloj (Principio I y V).
import { HOUR } from './time.js';

export const MAX_ACTIVE_APPOINTMENTS = 3;
export const MIN_NOTICE_HOURS = 2;
export const CHANGE_WINDOW_HOURS = 24;
export const NO_SHOW_LOCK = 3;

const ms = (x) => (x instanceof Date ? x.getTime() : new Date(x).getTime());
const isActive = (a) => a.status === 'active';

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return ms(aStart) < ms(bEnd) && ms(bStart) < ms(aEnd);
}

/** FR-005: ¿el intervalo se solapa con alguna cita activa de la lista? (adyacente no cuenta) */
export function hasOverlap(startsAt, endsAt, appointments) {
  return appointments.some((a) => isActive(a) && intervalsOverlap(startsAt, endsAt, a.starts_at, a.ends_at));
}

/** FR-007 / FR-024: faltan al menos 2 h (inclusivo). */
export function hasMinNotice(now, startsAt) {
  return ms(startsAt) - ms(now) >= MIN_NOTICE_HOURS * HOUR;
}

/** FR-008 / FR-024: faltan al menos 24 h (inclusivo) para reprogramar o cancelar. */
export function canModify(now, startsAt) {
  return ms(startsAt) - ms(now) >= CHANGE_WINDOW_HOURS * HOUR;
}

/** FR-012: tres inasistencias consecutivas bloquean la reserva en línea. */
export function isOnlineBookingLocked(consecutiveNoShows) {
  return consecutiveNoShows >= NO_SHOW_LOCK;
}

/** FR-021: una asistencia reinicia el conteo; una inasistencia lo incrementa. */
export function applyAttendance(consecutiveNoShows, result) {
  return result === 'attended' ? 0 : consecutiveNoShows + 1;
}

/** Citas "activas" del paciente: confirmadas y que aún no ocurrieron. */
export function activeUpcoming(appointments, now) {
  return appointments.filter((a) => isActive(a) && ms(a.starts_at) > ms(now));
}

/**
 * Valida una reserva. Devuelve null si es válida o el código del primer error de negocio.
 * actor: 'patient' (en línea) | 'reception'. Recepción está exenta de 2 h, 3 citas y bloqueo (FR-022).
 */
export function validateBooking({ actor, now, startsAt, endsAt, doctorAppts, patientAppts, noShows }) {
  const online = actor === 'patient';
  if (online && isOnlineBookingLocked(noShows)) return 'ONLINE_LOCKED';
  if (online && !hasMinNotice(now, startsAt)) return 'TOO_SOON';
  if (hasOverlap(startsAt, endsAt, doctorAppts)) return 'OVERLAP';
  if (hasOverlap(startsAt, endsAt, patientAppts)) return 'PATIENT_OVERLAP';
  if (online && activeUpcoming(patientAppts, now).length >= MAX_ACTIVE_APPOINTMENTS) return 'LIMIT_REACHED';
  return null;
}
