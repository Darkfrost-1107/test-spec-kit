import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic } from '../helpers.js';

let app;
before(async () => { app = await makeApp(); seedClinic(app.db); });
after(() => app.close());

test('registro correcto, inicio de sesión y redirección según rol (FR-001)', async () => {
  const c = app.client();
  const reg = await c.post('/registro', { name: 'Nora Nueva', email: 'Nora@Correo.com', password: 'clave12345' });
  assert.equal(reg.status, 303);
  assert.match(reg.text, /Cuenta creada/);
  const login = await c.post('/login', { email: 'nora@correo.com', password: 'clave12345' });
  assert.equal(login.status, 303);
  assert.match(login.text, /Buscar disponibilidad/);
});

test('correo duplicado se rechaza con mensaje claro', async () => {
  const r = await app.client().post('/registro', { name: 'Otra Paula', email: 'paula@t.test', password: 'clave12345' });
  assert.equal(r.status, 422);
  assert.match(r.text, /ya está registrado/);
});

test('contraseña débil muestra el error junto al campo (FR-017)', async () => {
  const r = await app.client().post('/registro', { name: 'Ana', email: 'ana2@t.test', password: 'corta' });
  assert.equal(r.status, 422);
  assert.match(r.text, /id="password-err" role="alert">La contraseña debe tener al menos 8/);
  assert.match(r.text, /aria-describedby="password-err"/);
});

test('credenciales incorrectas devuelven un mensaje genérico', async () => {
  const r = await app.client().post('/login', { email: 'paula@t.test', password: 'equivocada1' });
  assert.equal(r.status, 401);
  assert.match(r.text, /Correo o contraseña incorrectos/);
});

test('sin sesión se redirige a /login', async () => {
  const r = await app.client().get('/mis-citas');
  assert.equal(r.status, 303);
  assert.equal(r.location, '/login');
});

test('un paciente no accede a páginas de otros roles (FR-015)', async () => {
  const c = await app.client().login('paula@t.test', 'Paciente1234');
  for (const path of ['/admin', '/admin/medicos', '/recepcion/agenda', '/medico/agenda']) {
    assert.equal((await c.get(path)).finalStatus, 403, path);
  }
});

test('un POST sin token CSRF se rechaza', async () => {
  const c = await app.client().login('paula@t.test', 'Paciente1234');
  const r = await c.post('/citas/1/cancelar', {}, { noCsrf: true });
  assert.equal(r.status, 403);
});

test('cerrar sesión invalida la cookie', async () => {
  const c = await app.client().login('paula@t.test', 'Paciente1234');
  await c.post('/logout');
  assert.equal((await c.get('/mis-citas')).location, '/login');
});

test('la sesión caduca pasado su tiempo de vida', async () => {
  const c = await app.client().login('paula@t.test', 'Paciente1234');
  assert.equal((await c.get('/mis-citas')).finalStatus, 200);
  app.clock.advance(60 * 24 * 31);
  assert.equal((await c.get('/mis-citas')).location, '/login');
});
