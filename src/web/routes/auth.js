import { login, destroySession, registerPatient } from '../../services/auth.js';
import { validateRegistration, validateLogin } from '../validate.js';
import { loginView, registerView } from '../views/auth.js';

const HOME = { patient: '/disponibilidad', reception: '/recepcion/agenda', doctor: '/medico/agenda', admin: '/admin' };

export function registerAuthRoutes(r) {
  r.get('/', {}, (ctx) => ctx.redirect(ctx.user ? HOME[ctx.user.role] : '/login'));

  r.get('/login', {}, (ctx) => ctx.page('Ingresar', loginView({ csrf: ctx.csrf })));
  r.post('/login', {}, (ctx) => {
    const creds = validateLogin(ctx.body);
    const session = login(ctx.db, ctx.clock, ctx.cfg.sessionTtlHours, creds);
    if (!session) {
      return ctx.page('Ingresar', loginView({ csrf: ctx.csrf, values: { email: creds.email }, error: 'Correo o contraseña incorrectos.' }), 401);
    }
    ctx.setCookie(`sid=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ctx.cfg.sessionTtlHours * 3600}`);
    return ctx.redirect('/');
  });

  r.get('/registro', {}, (ctx) => ctx.page('Crear cuenta de paciente', registerView({ csrf: ctx.csrf })));
  r.post('/registro', {}, (ctx) => {
    const { values, errors } = validateRegistration(ctx.body);
    if (Object.keys(errors).length) return ctx.page('Crear cuenta de paciente', registerView({ csrf: ctx.csrf, values, errors }), 422);
    const result = registerPatient(ctx.db, values);
    if (result.errors) return ctx.page('Crear cuenta de paciente', registerView({ csrf: ctx.csrf, values, errors: result.errors }), 422);
    return ctx.redirect('/login', 'Cuenta creada. Ahora puedes iniciar sesión.');
  });

  r.post('/logout', {}, (ctx) => {
    if (ctx.session) destroySession(ctx.db, ctx.session.token);
    ctx.setCookie('sid=; Max-Age=0; Path=/');
    return ctx.redirect('/login', 'Sesión cerrada.');
  });
}
