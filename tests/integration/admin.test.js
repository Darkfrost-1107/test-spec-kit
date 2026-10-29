import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic, at } from '../helpers.js';
import { book, searchAvailability } from '../../src/services/appointments.js';

let app; let ids; let adminC;
beforeEach(async () => {
  app = await makeApp();
  ids = seedClinic(app.db);
  adminC = await app.client().login('admin@t.test', 'Admin1234');
});
afterEach(() => app.close());

const slots = (doctorId, date) => searchAvailability(app.ctx, { doctorId, date })[0]?.slots ?? [];

test('solo el administrador accede al panel (FR-014, FR-015)', async () => {
  for (const login of [['recep@t.test', 'Recep1234'], ['ana@t.test', 'Medico1234'], ['paula@t.test', 'Paciente1234']]) {
    const c = await app.client().login(...login);
    assert.equal((await c.get('/admin/medicos')).finalStatus, 403, login[0]);
  }
  assert.equal((await adminC.get('/admin')).finalStatus, 200);
});

test('crear especialidad: solo 30 o 45 minutos y nombre único', async () => {
  assert.match((await adminC.post('/admin/especialidades', { name: 'Pediatría', duration_min: '45' })).text, /Especialidad creada/);
  assert.equal(app.db.prepare("SELECT duration_min d FROM specialties WHERE name = 'Pediatría'").get().d, 45);
  const bad = await adminC.post('/admin/especialidades', { name: 'Rápida', duration_min: '20' });
  assert.equal(bad.status, 422);
  assert.match(bad.text, /30 o 45 minutos/);
  assert.match((await adminC.post('/admin/especialidades', { name: 'Pediatría', duration_min: '30' })).text, /Ya existe una especialidad/);
});

test('crear médico con cuenta y horario produce horarios reservables (FR-014)', async () => {
  const sp = app.db.prepare("SELECT id FROM specialties WHERE name = 'Cardiología'").get().id;
  const r = await adminC.post('/admin/medicos', { name: 'Dra. Rosa Vega', specialty_id: sp, email: 'rosa@t.test', password: 'Medico1234' });
  assert.match(r.text, /Médico creado/);
  const id = app.db.prepare("SELECT id FROM doctors WHERE name = 'Dra. Rosa Vega'").get().id;
  assert.equal(slots(id, '2026-11-04').length, 0);
  assert.match((await adminC.post(`/admin/medicos/${id}/horarios`, { weekday: '3', start: '09:00', end: '11:00' })).text, /Franja agregada/);
  assert.equal(slots(id, '2026-11-04').length, 2); // 45 min: 09:00 y 09:45
  const doc = await app.client().login('rosa@t.test', 'Medico1234');
  assert.equal((await doc.get('/medico/agenda')).finalStatus, 200);
});

test('una franja que se solapa con otra del mismo día se rechaza', async () => {
  const r = await adminC.post(`/admin/medicos/${ids.ana}/horarios`, { weekday: '1', start: '12:00', end: '14:00' });
  assert.equal(r.status, 422);
  assert.match(r.text, /se solapa con otra del mismo día/);
});

test('un feriado elimina toda la disponibilidad del día y al borrarlo vuelve (FR-019)', async () => {
  assert.ok(slots(ids.ana, '2026-11-04').length > 0);
  assert.match((await adminC.post('/admin/feriados', { date: '2026-11-04', name: 'Feriado de prueba' })).text, /Feriado registrado/);
  assert.equal(slots(ids.ana, '2026-11-04').length, 0);
  assert.equal(slots(ids.luis, '2026-11-04').length, 0);
  assert.equal((await adminC.post('/admin/feriados', { date: '2026-11-04', name: 'Otra vez' })).status, 422);
  await adminC.post('/admin/feriados/eliminar', { date: '2026-11-04' });
  assert.ok(slots(ids.ana, '2026-11-04').length > 0);
});

test('desactivar un médico oculta horarios nuevos pero conserva sus citas futuras', async () => {
  const id = book(app.ctx, { actor: 'patient', patientId: ids.paula, doctorId: ids.ana, startsAt: at('2026-11-04', '09:00') });
  await adminC.post(`/admin/medicos/${ids.ana}/estado`, { active: '0' });
  assert.equal(searchAvailability(app.ctx, { doctorId: ids.ana, date: '2026-11-04' }).length, 0);
  assert.equal(app.db.prepare('SELECT status FROM appointments WHERE id = ?').get(id).status, 'active');
});

test('la bandeja de correos muestra las notificaciones generadas', async () => {
  book(app.ctx, { actor: 'patient', patientId: ids.paula, doctorId: ids.ana, startsAt: at('2026-11-04', '09:00') });
  const page = await adminC.get('/admin/correos');
  assert.match(page.text, /paula@t\.test/);
  assert.match(page.text, /Cita confirmada/);
});

test('los datos escritos por usuarios se escapan en el HTML (Principio II)', async () => {
  await adminC.post('/admin/feriados', { date: '2026-11-11', name: '<script>alert(1)</script>' });
  const page = await adminC.get('/admin/feriados');
  assert.doesNotMatch(page.text, /<script>alert/);
  assert.match(page.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
