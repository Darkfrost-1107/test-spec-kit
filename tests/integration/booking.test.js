import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic, at } from '../helpers.js';
import { searchAvailability } from '../../src/services/appointments.js';

let app; let ids; let paula;
beforeEach(async () => {
  app = await makeApp(); // lunes 09:00 en Lima
  ids = seedClinic(app.db);
  paula = await app.client().login('paula@t.test', 'Paciente1234');
});
afterEach(() => app.close());

const book = (client, doctorId, date, time) => client.post('/citas', { doctor_id: doctorId, starts_at: at(date, time), fecha: date });
const activeCount = () => app.db.prepare("SELECT COUNT(*) n FROM appointments WHERE status = 'active'").get().n;

test('reserva exitosa: aparece en Mis citas, deja de ofrecerse y encola confirmación (FR-003)', async () => {
  const r = await book(paula, ids.ana, '2026-11-04', '09:00');
  assert.match(r.text, /Cita reservada/);
  assert.match(r.text, /Dra\. Ana Torres/);
  const conf = app.db.prepare("SELECT * FROM outbox WHERE kind = 'confirmation'").get();
  assert.equal(conf.to_email, 'paula@t.test');
  assert.match(conf.body, /mié 04\/11\/2026 09:00/);
  const slots = searchAvailability(app.ctx, { doctorId: ids.ana, date: '2026-11-04' })[0].slots;
  assert.ok(!slots.some((s) => s.startsAt === at('2026-11-04', '09:00')));
});

test('el correo de confirmación se entrega al reservar, sin esperar al planificador (FR-003, SC-003)', async () => {
  await book(paula, ids.ana, '2026-11-04', '09:00');
  for (let i = 0; i < 20 && !app.mailer.sent.length; i += 1) await new Promise((r) => setTimeout(r, 25));
  assert.equal(app.mailer.sent.length, 1);
  assert.equal(app.mailer.sent[0].kind, 'confirmation');
  assert.equal(app.db.prepare("SELECT status FROM outbox WHERE kind = 'confirmation'").get().status, 'sent');
});

test('la búsqueda filtra por especialidad y muestra la duración de cada una (FR-002, FR-004)', async () => {
  const g = searchAvailability(app.ctx, { specialtyId: ids.general, date: '2026-11-04' });
  assert.equal(g.length, 1);
  assert.equal(g[0].slots[0].endsAt, at('2026-11-04', '09:30'));
  const c = searchAvailability(app.ctx, { specialtyId: ids.cardio, date: '2026-11-04' });
  assert.equal(c[0].slots[0].endsAt, at('2026-11-04', '09:45'));
  const page = await paula.get('/disponibilidad?fecha=2026-11-04');
  assert.match(page.text, /Reservar 09:00/);
});

test('la cuarta cita activa se rechaza (FR-006)', async () => {
  for (const d of ['2026-11-04', '2026-11-05', '2026-11-06']) assert.match((await book(paula, ids.ana, d, '09:00')).text, /Cita reservada/);
  const r = await book(paula, ids.ana, '2026-11-09', '09:00');
  assert.match(r.text, /Ya tienes 3 citas activas/);
  assert.equal(activeCount(), 3);
});

test('menos de 2 h se rechaza y exactamente 2 h se acepta (FR-007, FR-024)', async () => {
  app.clock.set(at('2026-11-04', '08:01')); // faltan 1 h 59 min para las 10:00
  assert.match((await book(paula, ids.ana, '2026-11-04', '10:00')).text, /al menos 2 horas/);
  app.clock.set(at('2026-11-04', '08:00')); // exactamente 2 h
  assert.match((await book(paula, ids.ana, '2026-11-04', '10:00')).text, /Cita reservada/);
});

test('dos pacientes reservando el mismo horario a la vez: solo uno lo obtiene (FR-005, SC-002)', async () => {
  const pedro = await app.client().login('pedro@t.test', 'Paciente1234');
  const [a, b] = await Promise.all([book(paula, ids.ana, '2026-11-04', '09:00'), book(pedro, ids.ana, '2026-11-04', '09:00')]);
  const ok = [a, b].filter((r) => /Cita reservada/.test(r.text));
  const rejected = [a, b].filter((r) => /ya no está disponible|se solapa/.test(r.text));
  assert.equal(ok.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(activeCount(), 1);
});

test('un horario que solapa parcialmente con otra cita del médico se rechaza (FR-005)', async () => {
  await book(paula, ids.ana, '2026-11-04', '09:00');
  const pedro = await app.client().login('pedro@t.test', 'Paciente1234');
  const r = await pedro.post('/citas', { doctor_id: ids.ana, starts_at: '2026-11-04T14:15:00.000Z', fecha: '2026-11-04' });
  assert.match(r.text, /se solapa/);
  assert.equal(activeCount(), 1);
});

test('un paciente no puede tener dos citas a la misma hora con médicos distintos (FR-023)', async () => {
  await book(paula, ids.ana, '2026-11-04', '09:00');
  const r = await book(paula, ids.luis, '2026-11-04', '09:00');
  assert.match(r.text, /ya tiene otra cita en ese mismo horario/);
});

test('un starts_at inválido o fuera del horario del médico se rechaza', async () => {
  assert.match((await paula.post('/citas', { doctor_id: ids.ana, starts_at: 'mañana', fecha: '2026-11-04' })).text, /no son válidos/);
  assert.match((await book(paula, ids.ana, '2026-11-04', '20:00')).text, /ya no está disponible/);
  assert.match((await book(paula, ids.ana, '2026-11-07', '09:00')).text, /ya no está disponible/); // sábado
  assert.equal(activeCount(), 0);
});
