import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic, at } from '../helpers.js';
import { book, searchAvailability } from '../../src/services/appointments.js';

let app; let ids; let paula; let apptId;
beforeEach(async () => {
  app = await makeApp(); // lunes 09:00 en Lima
  ids = seedClinic(app.db);
  paula = await app.client().login('paula@t.test', 'Paciente1234');
  apptId = book(app.ctx, { actor: 'patient', patientId: ids.paula, doctorId: ids.ana, startsAt: at('2026-11-04', '09:00') });
});
afterEach(() => app.close());

const status = () => app.db.prepare('SELECT status FROM appointments WHERE id = ?').get(apptId).status;
const slotFree = (date, time) =>
  searchAvailability(app.ctx, { doctorId: ids.ana, date })[0].slots.some((s) => s.startsAt === at(date, time));

test('reprogramar libera el horario anterior, conserva la cita y notifica (FR-008, FR-016)', async () => {
  assert.equal(slotFree('2026-11-04', '09:00'), false);
  const r = await paula.post(`/citas/${apptId}/reprogramar`, { starts_at: at('2026-11-05', '10:00') });
  assert.match(r.text, /Cita reprogramada/);
  assert.equal(slotFree('2026-11-04', '09:00'), true);
  assert.equal(slotFree('2026-11-05', '10:00'), false);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM appointments').get().n, 1);
  const msg = app.db.prepare("SELECT * FROM outbox WHERE kind = 'rescheduled'").get();
  assert.match(msg.body, /jue 05\/11\/2026 10:00/);
});

test('cancelar libera el horario y deja de contar para el límite de 3 (FR-006, FR-008)', async () => {
  for (const d of ['2026-11-05', '2026-11-06']) book(app.ctx, { actor: 'patient', patientId: ids.paula, doctorId: ids.ana, startsAt: at(d, '09:00') });
  assert.match((await paula.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-09', '09:00') })).text, /3 citas activas/);
  const r = await paula.post(`/citas/${apptId}/cancelar`);
  assert.match(r.text, /Cita cancelada/);
  assert.equal(status(), 'cancelled');
  assert.equal(slotFree('2026-11-04', '09:00'), true);
  assert.match((await paula.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-09', '09:00') })).text, /Cita reservada/);
  assert.ok(app.db.prepare("SELECT 1 FROM outbox WHERE kind = 'cancelled'").get());
});

test('a menos de 24 h no se puede reprogramar ni cancelar; a exactamente 24 h sí (FR-008, FR-024)', async () => {
  app.clock.set(at('2026-11-03', '09:01')); // faltan 23 h 59 min
  assert.match((await paula.post(`/citas/${apptId}/cancelar`)).text, /hasta 24 horas antes/);
  assert.match((await paula.post(`/citas/${apptId}/reprogramar`, { starts_at: at('2026-11-05', '10:00') })).text, /hasta 24 horas antes/);
  assert.equal(status(), 'active');
  assert.match((await paula.get('/mis-citas')).text, /Faltan menos de 24 h/);
  app.clock.set(at('2026-11-03', '09:00')); // exactamente 24 h
  assert.match((await paula.post(`/citas/${apptId}/cancelar`)).text, /Cita cancelada/);
});

test('un paciente no puede modificar citas de otro (FR-015)', async () => {
  const pedro = await app.client().login('pedro@t.test', 'Paciente1234');
  assert.match((await pedro.post(`/citas/${apptId}/cancelar`)).text, /No tienes permiso/);
  assert.equal((await pedro.get(`/citas/${apptId}/reprogramar`)).finalStatus, 403);
  assert.equal(status(), 'active');
});

test('reprogramar a un horario ocupado se rechaza y la cita no cambia', async () => {
  const pedro = await app.client().login('pedro@t.test', 'Paciente1234');
  await pedro.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-05', '10:00') });
  const r = await paula.post(`/citas/${apptId}/reprogramar`, { starts_at: at('2026-11-05', '10:00') });
  assert.match(r.text, /se solapa/);
  assert.equal(app.db.prepare('SELECT starts_at FROM appointments WHERE id = ?').get(apptId).starts_at, at('2026-11-04', '09:00'));
});
