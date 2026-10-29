// Recorre la app real con Edge headless (protocolo CDP, sin dependencias) y guarda capturas PNG.
// Uso: node ui-capture.mjs <urlBase> <carpetaSalida>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [BASE, OUT] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ui-'))}`, '--window-size=1200,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* aún arrancando */ }
    await sleep(200);
  }
  throw new Error('Edge no respondió');
}

const ws = new WebSocket(await connect());
await new Promise((r) => ws.addEventListener('open', r));
let nextId = 1;
const pending = new Map();
const waiters = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Page.loadEventFired') waiters.splice(0).forEach((w) => w());
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const loaded = (ms = 4000) => Promise.race([new Promise((r) => waiters.push(r)), sleep(ms)]);
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
await send('Page.enable');

const goto = async (path) => { const l = loaded(); await send('Page.navigate', { url: BASE + path }); await l; await sleep(150); };
const fill = (name, value) => evalJs(`(() => { const e = document.querySelector('[name="${name}"]'); e.value = ${JSON.stringify(value)}; return true; })()`);
const click = async (selector, nth = 0) => {
  const l = loaded(2500);
  await evalJs(`document.querySelectorAll(${JSON.stringify(selector)})[${nth}].click()`);
  await l; await sleep(150);
};
const submit = async (formSelector) => {
  const l = loaded(2500);
  await evalJs(`document.querySelector(${JSON.stringify(formSelector)}).querySelector('button[type=submit]').click()`);
  await l; await sleep(150);
};
async function shot(file, { mobile = false } = {}) {
  await evalJs(`(() => { document.getElementById('cap-url')?.remove(); const d = document.createElement('div'); d.id = 'cap-url';
    d.style.cssText = 'background:#1f2937;color:#e5e7eb;font:13px Consolas,monospace;padding:6px 12px';
    d.textContent = 'URL: ' + location.pathname + location.search; document.body.prepend(d); })()`);
  const width = mobile ? 390 : 1200;
  const h = await evalJs('document.documentElement.scrollHeight');
  await send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(Math.max(h, 400), 3000), deviceScaleFactor: 1, mobile });
  await sleep(150);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
  await send('Emulation.clearDeviceMetricsOverride');
  console.log('captura:', file);
}
async function login(email, password) {
  await goto('/login');
  await fill('email', email); await fill('password', password);
  await submit('form[action="/login"]');
}
async function logout() { await submit('form[action="/logout"]'); }

try {
  // US1 — acceso y registro
  await goto('/login'); await shot('01-login.png');
  await goto('/registro');
  await fill('name', 'A'); await fill('email', 'correo-malo'); await fill('password', 'corta');
  await submit('form[action="/registro"]'); await shot('02-registro-errores-validacion.png');
  await fill('name', 'Nora Nueva'); await fill('email', 'nora@correo.com'); await fill('password', 'clave12345');
  await submit('form[action="/registro"]'); await shot('03-registro-ok.png');

  // US1 — paciente busca y reserva
  await login('paciente@turnoya.test', 'Paciente1234');
  await goto('/disponibilidad?fecha=2026-11-02'); await shot('04-paciente-disponibilidad.png');
  // En la lista, Dr. Rojas ocupa los primeros 4 botones; el 5.º (índice 4) es la Dra. Torres a las 09:00.
  await click('button[aria-label^="Reservar"]', 4);
  await shot('05-paciente-reserva-ok-mis-citas.png');

  // US2 — reprogramar (elige un horario del mismo día, p. ej. el tercero)
  await click('a[href$="/reprogramar"]');
  await shot('06-paciente-reprogramar.png');
  await click('button[aria-label^="Reservar"]', 3);
  await shot('07-paciente-cita-reprogramada.png');

  // Regla de 24 h / 3 citas: reserva 2 más y una 4.ª rechazada
  for (const [fecha, n] of [['2026-11-03', 4], ['2026-11-04', 4]]) {
    await goto(`/disponibilidad?fecha=${fecha}`); await click('button[aria-label^="Reservar"]', n);
  }
  await goto('/disponibilidad?fecha=2026-11-05'); await click('button[aria-label^="Reservar"]', 0);
  await shot('08-paciente-limite-3-citas-rechazo.png');
  await logout();

  // US3 — recepción
  await login('recepcion@turnoya.test', 'Recep1234');
  await goto('/recepcion/agenda?fecha=2026-11-02&vista=semana'); await shot('09-recepcion-agenda-semana.png');
  await goto('/recepcion/citas/nueva?medico=1&fecha=2026-11-06'); await shot('10-recepcion-nueva-cita.png');
  await logout();

  // US4 — médico bloquea horarios
  await login('medico@turnoya.test', 'Medico1234');
  await goto('/medico/agenda?fecha=2026-11-02&vista=semana'); await shot('11-medico-agenda.png');
  await goto('/medico/bloqueos');
  await fill('date', '2026-11-06'); await fill('start', '15:00'); await fill('end', '18:00'); await fill('reason', 'Reunion de equipo');
  await submit('form[action="/medico/bloqueos"]'); await shot('12-medico-bloqueo-creado.png');
  await fill('date', '2026-11-02'); await fill('start', '09:00'); await fill('end', '13:00'); await fill('reason', 'Vacaciones');
  await submit('form[action="/medico/bloqueos"]'); await shot('13-medico-bloqueo-rechazado-citas-en-conflicto.png');
  await logout();

  // US5 — administración
  await login('admin@turnoya.test', 'Admin1234');
  await goto('/admin/medicos'); await shot('14-admin-medicos.png');
  await goto('/admin/medicos/1/horarios'); await shot('15-admin-horarios.png');
  await goto('/admin/feriados'); await shot('16-admin-feriados.png');
  await goto('/admin/correos'); await shot('17-admin-correos-outbox.png');
  await logout();

  // Responsive / móvil
  await login('paciente@turnoya.test', 'Paciente1234');
  await goto('/mis-citas'); await shot('18-movil-mis-citas.png', { mobile: true });
} finally {
  ws.close();
  edge.kill();
}
