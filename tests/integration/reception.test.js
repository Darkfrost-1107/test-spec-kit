import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic, at } from '../helpers.js';
import { book } from '../../src/services/appointments.js';

let app; let ids; let recep;
beforeEach(async () => {
  app = await makeApp(); // lunes 09:00 Lima
  ids = seedClinic(app.db);
  recep = await app.client().login('recep@t.test', 'Recep1234');
});
afterEach(() => app.close());

const byReception = (patientId, date, time, doctorId = ids.ana) =>
  book(app.ctx, { actor: 'reception', patientId, doctorId, startsAt: at(date, time) });
const noShows = (id) => app.db.prepare('SELECT consecutive_no_shows n FROM patients WHERE id = ?').get(id).n;

test('la agenda del día y de la semana muestra las citas (FR-010)', async () => {
  byReception(ids.paula, '2026-11-04', '09:00'); // miércoles
  byReception(ids.pedro, '2026-11-06', '10:00'); // viernes
  const day = await recep.get('/recepcion/agenda?fecha=2026-11-04&vista=dia');
  assert.match(day.text, /Paula Paciente/);
  assert.doesNotMatch(day.text, /Pedro Paciente/);
  const week = await recep.get('/recepcion/agenda?fecha=2026-11-04&vista=semana');
  assert.match(week.text, /Paula Paciente/);
  assert.match(week.text, /Pedro Paciente/);
  assert.match(week.text, /<th scope="col">Paciente<\/th>/);
});

test('recepción agenda a un paciente nuevo por teléfono, sin correo (FR-011)', async () => {
  const r = await recep.post('/recepcion/citas', { doctor_id: ids.ana, starts_at: at('2026-11-04', '11:00'), patient_id: '', name: 'Carlos Telefónico', email: '', phone: '999 888 777' });
  assert.match(r.text, /Cita agendada/);
  const p = app.db.prepare("SELECT * FROM patients WHERE name = 'Carlos Telefónico'").get();
  assert.ok(p && p.user_id === null);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM outbox').get().n, 0);
});

test('recepción está exenta de 2 h, del límite de 3 citas y del bloqueo, pero no del solapamiento (FR-022)', async () => {
  app.clock.set(at('2026-11-04', '08:00'));
  assert.match((await recep.post('/recepcion/citas', { doctor_id: ids.ana, starts_at: at('2026-11-04', '09:00'), patient_id: ids.paula })).text, /Cita agendada/);
  byReception(ids.paula, '2026-11-05', '09:00');
  byReception(ids.paula, '2026-11-06', '09:00');
  assert.match((await recep.post('/recepcion/citas', { doctor_id: ids.ana, starts_at: at('2026-11-09', '09:00'), patient_id: ids.paula })).text, /Cita agendada/); // 4.ª
  const overlap = await recep.post('/recepcion/citas', { doctor_id: ids.ana, starts_at: at('2026-11-09', '09:00'), patient_id: ids.pedro });
  assert.match(overlap.text, /se solapa|ya no está disponible/);
  const paula = await app.client().login('paula@t.test', 'Paciente1234');
  assert.match((await paula.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-10', '09:00') })).text, /3 citas activas/);
});

test('marcar asistencia solo es posible una vez iniciada la cita', async () => {
  const id = byReception(ids.paula, '2026-11-04', '09:00');
  const early = await recep.post(`/recepcion/citas/${id}/asistencia`, { result: 'no_show' });
  assert.match(early.text, /ya comenzaron/);
  assert.equal(noShows(ids.paula), 0);
});

test('tres inasistencias consecutivas bloquean la reserva en línea; recepción sigue pudiendo agendar; asistir desbloquea (FR-012, FR-021)', async () => {
  const appts = ['09:00', '09:30', '10:00'].map((t) => byReception(ids.paula, '2026-11-04', t));
  app.clock.set(at('2026-11-04', '12:00'));
  for (const id of appts) assert.match((await recep.post(`/recepcion/citas/${id}/asistencia`, { result: 'no_show' })).text, /Asistencia registrada/);
  assert.equal(noShows(ids.paula), 3);

  const paula = await app.client().login('paula@t.test', 'Paciente1234');
  assert.match((await paula.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-10', '09:00') })).text, /bloqueada por inasistencias/);
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM appointments WHERE status = 'active'").get().n, 0);

  const viaReception = byReception(ids.paula, '2026-11-10', '09:00'); // recepción sí puede
  app.clock.set(at('2026-11-10', '09:30'));
  await recep.post(`/recepcion/citas/${viaReception}/asistencia`, { result: 'attended' });
  assert.equal(noShows(ids.paula), 0);
  assert.match((await paula.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-11', '09:00') })).text, /Cita reservada/);
});

test('marcar una asistencia antigua después de tres inasistencias no desbloquea al paciente', async () => {
  const attended = byReception(ids.paula, '2026-11-02', '09:00');
  const missed = ['2026-11-03', '2026-11-04', '2026-11-05'].map((d) => byReception(ids.paula, d, '09:00'));
  app.clock.set(at('2026-11-06', '12:00'));
  for (const id of missed) await recep.post(`/recepcion/citas/${id}/asistencia`, { result: 'no_show' });
  await recep.post(`/recepcion/citas/${attended}/asistencia`, { result: 'attended' });
  assert.equal(noShows(ids.paula), 3);

  const paula = await app.client().login('paula@t.test', 'Paciente1234');
  assert.match((await paula.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-10', '09:00') })).text, /bloqueada por inasistencias/);
});

test('marcar tres inasistencias antiguas después de una asistencia reciente no bloquea al paciente', async () => {
  const missed = ['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => byReception(ids.paula, d, '09:00'));
  const attended = byReception(ids.paula, '2026-11-05', '09:00');
  app.clock.set(at('2026-11-06', '12:00'));
  await recep.post(`/recepcion/citas/${attended}/asistencia`, { result: 'attended' });
  for (const id of missed) await recep.post(`/recepcion/citas/${id}/asistencia`, { result: 'no_show' });
  assert.equal(noShows(ids.paula), 0);

  const paula = await app.client().login('paula@t.test', 'Paciente1234');
  assert.match((await paula.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-10', '09:00') })).text, /Cita reservada/);
});

test('una cancelación no cuenta como inasistencia ni reinicia el conteo', async () => {
  const a = byReception(ids.paula, '2026-11-04', '09:00');
  const b = byReception(ids.paula, '2026-11-05', '09:00');
  app.clock.set(at('2026-11-04', '10:00'));
  await recep.post(`/recepcion/citas/${a}/asistencia`, { result: 'no_show' });
  await recep.post(`/recepcion/citas/${b}/cancelar`);
  assert.equal(noShows(ids.paula), 1);
});

test('recepción puede reprogramar y cancelar sin la ventana de 24 h', async () => {
  const id = byReception(ids.paula, '2026-11-02', '15:00'); // hoy, en 6 h
  assert.match((await recep.post(`/recepcion/citas/${id}/editar`, { starts_at: at('2026-11-02', '16:00') })).text, /Cita reprogramada/);
  assert.match((await recep.post(`/recepcion/citas/${id}/cancelar`)).text, /Cita cancelada/);
});
