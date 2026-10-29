import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic, at } from '../helpers.js';
import { book, reschedule, cancel } from '../../src/services/appointments.js';
import { tick } from '../../src/services/reminders.js';

let app; let ids;
beforeEach(async () => { app = await makeApp(); ids = seedClinic(app.db); }); // lunes 09:00 Lima
afterEach(() => app.close());

const reserve = (date, time, actor = 'patient') =>
  book(app.ctx, { actor, patientId: ids.paula, doctorId: ids.ana, startsAt: at(date, time) });
const run = () => tick(app.ctx, app.mailer);
const reminders = () => app.db.prepare("SELECT * FROM outbox WHERE kind = 'reminder'").all();

test('el recordatorio se genera exactamente al entrar en la ventana de 24 h, una sola vez (FR-009, SC-003)', async () => {
  const id = reserve('2026-11-04', '09:00'); // miércoles 09:00
  app.clock.set(at('2026-11-03', '08:59')); // 24 h 1 min antes
  assert.equal(await run(), 0);
  app.clock.set(at('2026-11-03', '09:00')); // exactamente 24 h
  assert.equal(await run(), 1);
  assert.equal(reminders().length, 1);
  assert.equal(reminders()[0].dedupe_key, `reminder:${id}:${at('2026-11-04', '09:00')}`);
  assert.ok(app.mailer.sent.some((m) => m.kind === 'reminder' && m.to === 'paula@t.test'));
  app.clock.set(at('2026-11-03', '12:00'));
  assert.equal(await run(), 0); // idempotente: no se duplica
  assert.equal(await run(), 0);
  assert.equal(reminders().length, 1);
});

test('una cita cancelada no recibe recordatorio', async () => {
  const id = reserve('2026-11-04', '09:00');
  cancel(app.ctx, { actor: 'patient', patientId: ids.paula, apptId: id });
  app.clock.set(at('2026-11-03', '10:00'));
  assert.equal(await run(), 0);
  assert.equal(reminders().length, 0);
});

test('una cita reprogramada recibe recordatorio solo para el nuevo horario', async () => {
  const id = reserve('2026-11-04', '09:00');
  reschedule(app.ctx, { actor: 'patient', patientId: ids.paula, apptId: id, startsAt: at('2026-11-05', '09:00') });
  app.clock.set(at('2026-11-03', '10:00')); // dentro de 24 h del horario ANTERIOR
  assert.equal(await run(), 0);
  app.clock.set(at('2026-11-04', '09:00')); // 24 h antes del nuevo horario
  assert.equal(await run(), 1);
  assert.equal(reminders()[0].dedupe_key, `reminder:${id}:${at('2026-11-05', '09:00')}`);
});

test('reservada con menos de 24 h de anticipación: solo confirmación, sin recordatorio', async () => {
  app.clock.set(at('2026-11-03', '10:00'));
  reserve('2026-11-04', '09:00'); // faltan 23 h
  assert.equal(await run(), 0);
  assert.equal(reminders().length, 0);
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM outbox WHERE kind = 'confirmation'").get().n, 1);
});

test('si el correo falla, la cita sigue vigente y el envío se reintenta (Principio VI)', async () => {
  const id = reserve('2026-11-04', '09:00');
  app.clock.set(at('2026-11-03', '09:00'));
  app.mailer.fail = true;
  await run();
  assert.equal(app.db.prepare('SELECT status FROM appointments WHERE id = ?').get(id).status, 'active');
  assert.ok(app.db.prepare("SELECT 1 FROM outbox WHERE status = 'failed'").get());
  app.mailer.fail = false;
  await run();
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM outbox WHERE status != 'sent'").get().n, 0);
  assert.equal(reminders().length, 1);
});

test('un paciente sin correo (atención telefónica) no genera mensajes', async () => {
  const r = app.db.prepare("INSERT INTO patients (name) VALUES ('Sin Correo')").run();
  book(app.ctx, { actor: 'reception', patientId: Number(r.lastInsertRowid), doctorId: ids.ana, startsAt: at('2026-11-04', '10:00') });
  app.clock.set(at('2026-11-03', '10:00'));
  assert.equal(await run(), 0);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM outbox').get().n, 0);
});
