import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic, at } from '../helpers.js';
import { book, searchAvailability } from '../../src/services/appointments.js';

let app; let ids; let ana;
beforeEach(async () => {
  app = await makeApp();
  ids = seedClinic(app.db);
  ana = await app.client().login('ana@t.test', 'Medico1234');
});
afterEach(() => app.close());

const free = (date, time) => searchAvailability(app.ctx, { doctorId: ids.ana, date })[0].slots.some((s) => s.startsAt === at(date, time));
const block = (c, date, start, end, reason = 'Reunión') => c.post('/medico/bloqueos', { date, start, end, reason });

test('el médico solo ve su propia agenda (FR-010)', async () => {
  book(app.ctx, { actor: 'patient', patientId: ids.paula, doctorId: ids.ana, startsAt: at('2026-11-04', '09:00') });
  book(app.ctx, { actor: 'patient', patientId: ids.pedro, doctorId: ids.luis, startsAt: at('2026-11-04', '09:00') });
  const page = await ana.get('/medico/agenda?fecha=2026-11-04');
  assert.match(page.text, /Paula Paciente/);
  assert.doesNotMatch(page.text, /Pedro Paciente/);
});

test('un bloqueo quita horarios de la disponibilidad y al eliminarlo vuelven (FR-013)', async () => {
  assert.equal(free('2026-11-05', '15:00'), true);
  assert.match((await block(ana, '2026-11-05', '15:00', '18:00')).text, /Horario bloqueado/);
  assert.equal(free('2026-11-05', '15:00'), false);
  assert.equal(free('2026-11-05', '09:00'), true);
  const id = app.db.prepare('SELECT id FROM blocks').get().id;
  assert.match((await ana.post(`/medico/bloqueos/${id}/eliminar`)).text, /Bloqueo eliminado/);
  assert.equal(free('2026-11-05', '15:00'), true);
});

test('un bloqueo que contiene citas activas se rechaza y lista los conflictos (FR-020)', async () => {
  book(app.ctx, { actor: 'patient', patientId: ids.paula, doctorId: ids.ana, startsAt: at('2026-11-05', '16:00') });
  const r = await block(ana, '2026-11-05', '15:00', '18:00');
  assert.match(r.text, /citas activas/);
  assert.match(r.text, /jue 05\/11\/2026 16:00/);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM blocks').get().n, 0);
});

test('un bloqueo adyacente a una cita (sin tocarla) sí se permite', async () => {
  book(app.ctx, { actor: 'patient', patientId: ids.paula, doctorId: ids.ana, startsAt: at('2026-11-05', '16:00') });
  assert.match((await block(ana, '2026-11-05', '16:30', '18:00')).text, /Horario bloqueado/);
});

test('validación del formulario de bloqueo: fin anterior al inicio y motivo vacío', async () => {
  const r = await block(ana, '2026-11-05', '17:00', '16:00', '');
  assert.equal(r.status, 422);
  assert.match(r.text, /hora de fin debe ser posterior/);
  assert.match(r.text, /Escribe el motivo/);
});

test('un médico no puede eliminar bloqueos de otro', async () => {
  await block(ana, '2026-11-05', '15:00', '16:00');
  const luis = await app.client().login('luis@t.test', 'Medico1234');
  const id = app.db.prepare('SELECT id FROM blocks').get().id;
  assert.equal((await luis.post(`/medico/bloqueos/${id}/eliminar`)).finalStatus, 403);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM blocks').get().n, 1);
});
