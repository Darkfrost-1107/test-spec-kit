// Agenda (día/semana) y bloqueos de horario de los médicos.
import { tx } from '../db/db.js';
import { BizError } from '../domain/errors.js';
import { intervalsOverlap } from '../domain/rules.js';
import { zonedToUtc, addDays, weekRange } from '../domain/time.js';

/** Citas entre dos fechas locales [fromDate, toDate) de la clínica; doctorId opcional. */
export function agenda(ctx, { fromDate, toDate, doctorId = null }) {
  const from = zonedToUtc(fromDate, '00:00', ctx.tz).toISOString();
  const to = zonedToUtc(toDate, '00:00', ctx.tz).toISOString();
  return ctx.db.prepare(
    `SELECT a.*, p.name AS patient_name, d.name AS doctor_name, s.name AS specialty_name
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = d.specialty_id
      WHERE a.starts_at >= ? AND a.starts_at < ? AND (? IS NULL OR a.doctor_id = ?)
      ORDER BY a.starts_at, d.name`,
  ).all(from, to, doctorId, doctorId);
}

export function agendaRange(date, view) {
  if (view === 'semana') {
    const days = weekRange(date);
    return { fromDate: days[0], toDate: addDays(days[6], 1) };
  }
  return { fromDate: date, toDate: addDays(date, 1) };
}

export function listBlocks(db, doctorId) {
  return db.prepare('SELECT * FROM blocks WHERE doctor_id = ? ORDER BY starts_at').all(doctorId);
}

/** Crea un bloqueo; si solapa citas activas lo rechaza listando los conflictos (FR-013, FR-020). */
export function createBlock(ctx, { doctorId, date, start, end, reason }) {
  const startsAt = zonedToUtc(date, start, ctx.tz);
  const endsAt = zonedToUtc(date, end, ctx.tz);
  if (startsAt >= endsAt) throw new BizError('INVALID');
  return tx(ctx.db, () => {
    const conflicts = ctx.db.prepare(`SELECT id, starts_at, ends_at FROM appointments WHERE doctor_id = ? AND status = 'active'`)
      .all(doctorId)
      .filter((a) => intervalsOverlap(startsAt, endsAt, a.starts_at, a.ends_at));
    if (conflicts.length) throw new BizError('BLOCK_CONFLICT', conflicts);
    const r = ctx.db.prepare('INSERT INTO blocks (doctor_id, starts_at, ends_at, reason) VALUES (?, ?, ?, ?)')
      .run(doctorId, startsAt.toISOString(), endsAt.toISOString(), reason);
    return Number(r.lastInsertRowid);
  });
}

/** Elimina un bloqueo propio; devuelve false si no existe o es de otro médico. */
export function deleteBlock(db, { blockId, doctorId }) {
  return db.prepare('DELETE FROM blocks WHERE id = ? AND doctor_id = ?').run(blockId, doctorId).changes === 1;
}
