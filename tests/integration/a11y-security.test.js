import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic, at } from '../helpers.js';
import { book } from '../../src/services/appointments.js';

let app; let ids;
before(async () => {
  app = await makeApp();
  ids = seedClinic(app.db);
  book(app.ctx, { actor: 'patient', patientId: ids.paula, doctorId: ids.ana, startsAt: at('2026-11-04', '09:00') });
});
after(() => app.close());

const PAGES = {
  anon: [null, ['/login', '/registro']],
  patient: [['paula@t.test', 'Paciente1234'], ['/disponibilidad?fecha=2026-11-04', '/mis-citas', '/citas/1/reprogramar']],
  reception: [['recep@t.test', 'Recep1234'], ['/recepcion/agenda?fecha=2026-11-04', '/recepcion/citas/nueva?medico=1&fecha=2026-11-04', '/recepcion/citas/1/editar']],
  doctor: [['ana@t.test', 'Medico1234'], ['/medico/agenda', '/medico/bloqueos']],
  admin: [['admin@t.test', 'Admin1234'], ['/admin', '/admin/especialidades', '/admin/medicos', '/admin/medicos/1/horarios', '/admin/feriados', '/admin/correos']],
};

test('todas las pantallas cumplen la lista de accesibilidad básica (Principio III, SC-007)', async () => {
  for (const [role, [creds, paths]] of Object.entries(PAGES)) {
    const c = app.client();
    if (creds) await c.login(...creds);
    for (const path of paths) {
      const { text, finalStatus } = await c.get(path);
      const where = `${role} ${path}`;
      assert.equal(finalStatus, 200, where);
      assert.match(text, /<html lang="es">/, `${where}: lang`);
      assert.match(text, /<a class="skip" href="#contenido">/, `${where}: enlace saltar`);
      assert.equal((text.match(/<h1>/g) ?? []).length, 1, `${where}: un solo h1`);
      assert.match(text, /<nav aria-label="Principal">/, `${where}: nav etiquetada`);
      for (const [, tag] of text.matchAll(/<(?:input|select)\b([^>]*)>/g)) {
        if (/type="(hidden|radio)"/.test(tag)) continue;
        const id = /id="([^"]+)"/.exec(tag)?.[1];
        assert.ok(id && text.includes(`<label for="${id}">`), `${where}: campo sin label (${tag.trim().slice(0, 50)})`);
      }
      for (const [, tag] of text.matchAll(/<input\b([^>]*type="radio"[^>]*)>/g)) {
        assert.ok(tag.includes('name='), `${where}: radio con name`);
      }
      const tables = (text.match(/<table>/g) ?? []).length;
      assert.equal((text.match(/<caption>/g) ?? []).length, tables, `${where}: caption en cada tabla`);
      if (tables) assert.match(text, /<th scope="col">/, `${where}: th con scope`);
    }
  }
});

test('todo POST sin token CSRF se rechaza con 403 (Principio II)', async () => {
  const c = await app.client().login('admin@t.test', 'Admin1234');
  const posts = ['/logout', '/citas', '/citas/1/reprogramar', '/citas/1/cancelar', '/recepcion/citas', '/recepcion/citas/1/editar',
    '/recepcion/citas/1/cancelar', '/recepcion/citas/1/asistencia', '/medico/bloqueos', '/medico/bloqueos/1/eliminar',
    '/admin/especialidades', '/admin/especialidades/1/estado', '/admin/medicos', '/admin/medicos/1/estado', '/admin/medicos/1/horarios',
    '/admin/medicos/1/horarios/1/eliminar', '/admin/feriados', '/admin/feriados/eliminar'];
  for (const path of posts) assert.equal((await c.post(path, {}, { noCsrf: true })).status, 403, path);
  const anon = app.client();
  for (const path of ['/login', '/registro']) assert.equal((await anon.post(path, { email: 'a@b.co' }, { noCsrf: true })).status, 403, path);
});

test('la cookie de sesión es HttpOnly y SameSite, y las respuestas llevan cabeceras de seguridad (Principio II)', async () => {
  const page = await fetch(`${app.base}/login`);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  const anon = page.headers.getSetCookie().find((c) => c.startsWith('anon_csrf='));
  assert.match(anon, /HttpOnly/);
  const csrf = /name="csrf" value="([^"]+)"/.exec(await page.text())[1];
  const res = await fetch(`${app.base}/login`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: anon.split(';')[0] },
    body: new URLSearchParams({ csrf, email: 'paula@t.test', password: 'Paciente1234' }).toString(),
  });
  const sid = res.headers.getSetCookie().find((c) => c.startsWith('sid='));
  assert.match(sid, /HttpOnly/);
  assert.match(sid, /SameSite=Lax/);
  assert.match(sid, /Path=\//);
});

test('las operaciones fallidas de usuarios no escriben datos personales en los logs (Additional Constraints)', async () => {
  const logged = [];
  const orig = { error: console.error, log: console.log };
  console.error = (...a) => logged.push(a.join(' '));
  console.log = (...a) => logged.push(a.join(' '));
  try {
    const c = app.client();
    await c.post('/login', { email: 'paula@t.test', password: 'mala-clave-1' });
    await c.post('/registro', { name: 'Persona Privada', email: 'privada@correo.com', password: 'x' });
  } finally {
    Object.assign(console, orig);
  }
  assert.ok(!logged.join(' | ').match(/paula@t\.test|privada@correo|Persona Privada|Paciente1234/));
});
