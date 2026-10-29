// Utilidades de prueba: app real sobre SQLite en memoria, reloj falso y cliente HTTP con cookies.
import { openDb } from '../src/db/db.js';
import { FakeClock, zonedToUtc } from '../src/domain/time.js';
import { createApp } from '../src/web/server.js';
import { registerPatient, createUser } from '../src/services/auth.js';
import * as admin from '../src/services/admin.js';

export const TZ = 'America/Lima';
export const NOW = '2026-11-02T14:00:00.000Z'; // lunes 09:00 en Lima
/** Instante UTC (ISO) de una fecha/hora local de la clínica. */
export const at = (date, time) => zonedToUtc(date, time, TZ).toISOString();

class Client {
  constructor(base) { this.base = base; this.jar = new Map(); }

  #store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1);
      if (!value || attrs.some((a) => /max-age=0/i.test(a))) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  async #fetch(method, path, body) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(this.base + path, {
      method, redirect: 'manual', body,
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    });
    this.#store(res);
    return res;
  }

  /** GET que sigue redirecciones. Devuelve { status, text, location }. */
  async get(path) {
    let res = await this.#fetch('GET', path);
    const first = { status: res.status, location: res.headers.get('location') };
    for (let i = 0; res.status >= 300 && res.status < 400 && i < 5; i += 1) res = await this.#fetch('GET', res.headers.get('location'));
    return { ...first, finalStatus: res.status, text: await res.text() };
  }

  async csrf() {
    const { text } = await this.get('/login');
    return /name="csrf" value="([^"]+)"/.exec(text)[1];
  }

  /** POST de formulario (con CSRF válido salvo noCsrf). Devuelve estado inicial y texto de la página final. */
  async post(path, form = {}, { noCsrf = false } = {}) {
    const params = new URLSearchParams(noCsrf ? form : { csrf: await this.csrf(), ...form });
    let res = await this.#fetch('POST', path, params.toString());
    const first = { status: res.status, location: res.headers.get('location') };
    for (let i = 0; res.status >= 300 && res.status < 400 && i < 5; i += 1) res = await this.#fetch('GET', res.headers.get('location'));
    return { ...first, finalStatus: res.status, text: await res.text() };
  }

  async login(email, password) {
    const r = await this.post('/login', { email, password });
    if (r.status !== 303) throw new Error(`login falló para ${email}: ${r.status}`);
    return this;
  }
}

export async function makeApp({ now = NOW } = {}) {
  const db = openDb(':memory:');
  const clock = new FakeClock(now);
  const mailer = { sent: [], fail: false, async send(m) { if (this.fail) throw new Error('smtp caído'); this.sent.push(m); } };
  const cfg = { tz: TZ, sessionTtlHours: 24 * 30 }; // largo: los tests saltan el reloj falso
  const server = createApp({ db, clock, cfg, mailer });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    db, clock, mailer, base, ctx: { db, clock, tz: TZ },
    client: () => new Client(base),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
}

/** Clínica de prueba: Ana (general, 30 min) y Luis (cardiología, 45 min), L–V; cuentas de cada rol. */
export function seedClinic(db) {
  const general = admin.createSpecialty(db, { name: 'Medicina General', durationMin: 30 });
  const cardio = admin.createSpecialty(db, { name: 'Cardiología', durationMin: 45 });
  const ana = admin.createDoctor(db, { name: 'Dra. Ana Torres', specialtyId: general, email: 'ana@t.test', password: 'Medico1234' });
  const luis = admin.createDoctor(db, { name: 'Dr. Luis Rojas', specialtyId: cardio, email: 'luis@t.test', password: 'Medico1234' });
  for (let weekday = 1; weekday <= 5; weekday += 1) {
    admin.addSchedule(db, { doctorId: ana, weekday, start: '09:00', end: '13:00' });
    admin.addSchedule(db, { doctorId: ana, weekday, start: '15:00', end: '18:00' });
    admin.addSchedule(db, { doctorId: luis, weekday, start: '09:00', end: '12:00' });
  }
  createUser(db, { email: 'admin@t.test', password: 'Admin1234', name: 'Admin', role: 'admin' });
  createUser(db, { email: 'recep@t.test', password: 'Recep1234', name: 'Recepción', role: 'reception' });
  const p1 = registerPatient(db, { name: 'Paula Paciente', email: 'paula@t.test', password: 'Paciente1234' });
  const p2 = registerPatient(db, { name: 'Pedro Paciente', email: 'pedro@t.test', password: 'Paciente1234' });
  return { general, cardio, ana, luis, paula: p1.patientId, pedro: p2.patientId };
}
