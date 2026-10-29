import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { Router } from './router.js';
import { page, html } from './views/layout.js';
import { getSession } from '../services/auth.js';
import { deliverPending } from '../services/notifications.js';
import { BizError } from '../domain/errors.js';
import { localDate } from '../domain/time.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerPatientRoutes } from './routes/patient.js';
import { registerReceptionRoutes } from './routes/reception.js';
import { registerDoctorRoutes } from './routes/doctor.js';
import { registerAdminRoutes } from './routes/admin.js';

const MAX_BODY = 64 * 1024;

const parseCookies = (header = '') =>
  Object.fromEntries(header.split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
    const i = c.indexOf('=');
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
  }));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new BizError('INVALID')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')))));
    req.on('error', reject);
  });
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
};

export function createApp({ db, clock, cfg, mailer }) {
  const router = new Router();
  [registerAuthRoutes, registerPatientRoutes, registerReceptionRoutes, registerDoctorRoutes, registerAdminRoutes]
    .forEach((register) => register(router));

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const cookies = parseCookies(req.headers.cookie);
    const session = getSession(db, clock, cookies.sid);
    const setCookies = [];

    let csrf = session?.csrf;
    if (!csrf) {
      csrf = cookies.anon_csrf || randomBytes(16).toString('hex');
      if (!cookies.anon_csrf) setCookies.push(`anon_csrf=${csrf}; HttpOnly; SameSite=Lax; Path=/`);
    }
    let flash = null;
    if (cookies.flash) {
      try { flash = JSON.parse(cookies.flash); } catch { flash = null; }
      setCookies.push('flash=; Max-Age=0; Path=/');
    }

    const send = (status, body, headers = {}) => ({ status, body, headers });
    const ctx = {
      req, url, db, clock, cfg, mailer, tz: cfg.tz, session, user: session?.user ?? null, csrf, params: {}, body: {},
      query: Object.fromEntries(url.searchParams),
      today: () => localDate(clock.now(), cfg.tz),
      setCookie: (c) => setCookies.push(c),
      page: (title, content, status = 200) =>
        send(status, page({ title, user: ctx.user, csrf, flash, content }), { 'Content-Type': 'text/html; charset=utf-8' }),
      redirect: (location, msg, type = 'ok') => {
        if (msg) setCookies.push(`flash=${encodeURIComponent(JSON.stringify({ t: type, m: msg }))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=60`);
        return send(303, '', { Location: location });
      },
    };
    ctx.forbidden = () => ctx.page('Acceso denegado', html`<p>No tienes permiso para ver esta página.</p>`, 403);
    ctx.notFound = () => ctx.page('No encontrado', html`<p>La página que buscas no existe.</p>`, 404);
    /** Ejecuta fn y convierte BizError en mensaje de error con redirección. */
    ctx.attempt = (okTarget, okMsg, errTarget, fn) => {
      try { fn(); return ctx.redirect(okTarget, okMsg); } catch (e) {
        if (e instanceof BizError) return ctx.redirect(errTarget, e.message, 'err');
        throw e;
      }
    };

    let result;
    const m = router.match(req.method, url.pathname);
    if (!m) result = ctx.notFound();
    else {
      ctx.params = m.params;
      if (req.method === 'POST') {
        ctx.body = await readBody(req);
        if (!ctx.body.csrf || ctx.body.csrf !== csrf) result = ctx.forbidden();
      }
      const { roles } = m.route.opts;
      if (!result && roles) {
        if (!ctx.user) result = ctx.redirect('/login', 'Inicia sesión para continuar.', 'err');
        else if (!roles.includes(ctx.user.role)) result = ctx.forbidden();
      }
      if (!result) result = await m.route.handler(ctx);
    }

    // Los cambios de citas encolan correos; se entregan enseguida sin bloquear la respuesta.
    if (req.method === 'POST') deliverPending(db, mailer, clock).catch(() => {});

    res.writeHead(result.status, {
      ...SECURITY_HEADERS, ...result.headers,
      ...(setCookies.length ? { 'Set-Cookie': setCookies } : {}),
    });
    res.end(result.body);
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      // Sin datos personales en logs: solo el tipo y mensaje técnico.
      console.error('Error interno:', err?.name, err?.message);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Ocurrió un error inesperado. Intenta nuevamente.');
    });
  });
}
