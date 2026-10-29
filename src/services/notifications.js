// Outbox idempotente (Principio VI): se encola dentro de la transacción del cambio y se entrega después.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_ATTEMPTS = 5;

/** Encola un mensaje; la dedupe_key única evita duplicados. Devuelve true si se creó. */
export function enqueue(db, clock, { appointmentId = null, kind, dedupeKey, to, subject, body }) {
  if (!to) return false;
  const r = db.prepare(
    `INSERT OR IGNORE INTO outbox (appointment_id, kind, dedupe_key, to_email, subject, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(appointmentId, kind, dedupeKey, to, subject, body, clock.now().toISOString());
  return r.changes === 1;
}

let queue = Promise.resolve();

/** Entrega pendientes/fallidos (máx. 5 intentos). Las pasadas se serializan: sin envíos duplicados. */
export function deliverPending(db, mailer, clock) {
  const run = queue.then(() => deliverPass(db, mailer, clock));
  queue = run.catch(() => {});
  return run;
}

async function deliverPass(db, mailer, clock) {
  const rows = db.prepare(
    `SELECT * FROM outbox WHERE status IN ('pending', 'failed') AND attempts < ? ORDER BY id`,
  ).all(MAX_ATTEMPTS);
  let sent = 0;
  for (const m of rows) {
    try {
      await mailer.send({ id: m.id, kind: m.kind, to: m.to_email, subject: m.subject, body: m.body });
      db.prepare(`UPDATE outbox SET status='sent', attempts=attempts+1, sent_at=? WHERE id=?`)
        .run(clock.now().toISOString(), m.id);
      sent += 1;
    } catch {
      db.prepare(`UPDATE outbox SET status='failed', attempts=attempts+1 WHERE id=?`).run(m.id);
    }
  }
  return sent;
}

/** Adaptador v1: escribe cada correo como archivo de texto (simulación de envío). */
export function fileMailer(dir) {
  return {
    async send({ id, kind, to, subject, body }) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${String(id).padStart(5, '0')}-${kind}.txt`), `Para: ${to}\nAsunto: ${subject}\n\n${body}\n`);
    },
  };
}

export function listOutbox(db, limit = 100) {
  return db.prepare(`SELECT id, kind, to_email, subject, status, attempts, created_at FROM outbox ORDER BY id DESC LIMIT ?`).all(limit);
}
