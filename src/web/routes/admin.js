import * as admin from '../../services/admin.js';
import { listOutbox } from '../../services/notifications.js';
import { isDate, isTime, toInt, validName, validEmail, validPassword } from '../validate.js';
import { adminHome, specialtiesView, doctorsView, schedulesView, holidaysView, outboxView } from '../views/admin.js';
import { html } from '../views/layout.js';

const ROLES = { roles: ['admin'] };
const hasErrors = (e) => Object.keys(e).length > 0;

export function registerAdminRoutes(r) {
  r.get('/admin', ROLES, (ctx) => ctx.page('Panel de administración', adminHome()));

  // ---- especialidades
  const specialtiesPage = (ctx, extra = {}, status = 200) =>
    ctx.page('Especialidades', specialtiesView({ csrf: ctx.csrf, specialties: admin.listSpecialties(ctx.db), ...extra }), status);
  r.get('/admin/especialidades', ROLES, (ctx) => specialtiesPage(ctx));
  r.post('/admin/especialidades', ROLES, (ctx) => {
    const errors = {};
    const values = { name: validName(ctx.body.name, errors), duration_min: toInt(ctx.body.duration_min ?? '') };
    if (![30, 45].includes(values.duration_min)) errors.duration_min = 'La duración debe ser 30 o 45 minutos.';
    if (!hasErrors(errors)) {
      const res = admin.createSpecialty(ctx.db, { name: values.name, durationMin: values.duration_min });
      if (!res.errors) return ctx.redirect('/admin/especialidades', 'Especialidad creada.');
      Object.assign(errors, res.errors);
    }
    return specialtiesPage(ctx, { values, errors }, 422);
  });
  r.post('/admin/especialidades/:id/estado', ROLES, (ctx) => {
    admin.setSpecialtyActive(ctx.db, toInt(ctx.params.id), ctx.body.active === '1');
    return ctx.redirect('/admin/especialidades', 'Estado actualizado.');
  });

  // ---- médicos
  const doctorsPage = (ctx, extra = {}, status = 200) =>
    ctx.page('Médicos', doctorsView({ csrf: ctx.csrf, doctors: admin.listDoctors(ctx.db), specialties: admin.listSpecialties(ctx.db), ...extra }), status);
  r.get('/admin/medicos', ROLES, (ctx) => doctorsPage(ctx));
  r.post('/admin/medicos', ROLES, (ctx) => {
    const errors = {};
    const values = {
      name: validName(ctx.body.name, errors), specialty_id: toInt(ctx.body.specialty_id ?? ''),
      email: validEmail(ctx.body.email, errors), password: validPassword(ctx.body.password, errors),
    };
    if (Number.isNaN(values.specialty_id)) errors.specialty_id = 'Elige una especialidad.';
    if (!hasErrors(errors)) {
      const res = admin.createDoctor(ctx.db, { name: values.name, specialtyId: values.specialty_id, email: values.email, password: values.password });
      if (!res.errors) return ctx.redirect('/admin/medicos', 'Médico creado. Define su horario de atención.');
      Object.assign(errors, res.errors);
    }
    return doctorsPage(ctx, { values: { ...values, password: '' }, errors }, 422);
  });
  r.post('/admin/medicos/:id/estado', ROLES, (ctx) => {
    admin.setDoctorActive(ctx.db, toInt(ctx.params.id), ctx.body.active === '1');
    return ctx.redirect('/admin/medicos', 'Estado actualizado.');
  });

  // ---- horarios de atención
  const doctorOf = (ctx) => admin.listDoctors(ctx.db).find((d) => d.id === toInt(ctx.params.id));
  const schedulesPage = (ctx, doctor, extra = {}, status = 200) =>
    ctx.page('Horario de atención', schedulesView({ csrf: ctx.csrf, doctor, schedules: admin.listSchedules(ctx.db, doctor.id), ...extra }), status);
  r.get('/admin/medicos/:id/horarios', ROLES, (ctx) => {
    const doctor = doctorOf(ctx);
    return doctor ? schedulesPage(ctx, doctor) : ctx.notFound();
  });
  r.post('/admin/medicos/:id/horarios', ROLES, (ctx) => {
    const doctor = doctorOf(ctx);
    if (!doctor) return ctx.notFound();
    const errors = {};
    const values = { weekday: toInt(ctx.body.weekday ?? ''), start: ctx.body.start ?? '', end: ctx.body.end ?? '' };
    if (!(values.weekday >= 0 && values.weekday <= 6)) errors.weekday = 'Elige un día válido.';
    if (!isTime(values.start)) errors.start = 'Hora de inicio inválida.';
    if (!isTime(values.end)) errors.end = 'Hora de fin inválida.';
    if (!hasErrors(errors)) {
      const res = admin.addSchedule(ctx.db, { doctorId: doctor.id, ...values });
      if (!res.errors) return ctx.redirect(`/admin/medicos/${doctor.id}/horarios`, 'Franja agregada.');
      Object.assign(errors, res.errors);
    }
    return schedulesPage(ctx, doctor, { values, errors }, 422);
  });
  r.post('/admin/medicos/:id/horarios/:sid/eliminar', ROLES, (ctx) => {
    admin.deleteSchedule(ctx.db, { scheduleId: toInt(ctx.params.sid), doctorId: toInt(ctx.params.id) });
    return ctx.redirect(`/admin/medicos/${ctx.params.id}/horarios`, 'Franja eliminada.');
  });

  // ---- feriados
  const holidaysPage = (ctx, extra = {}, status = 200) =>
    ctx.page('Feriados', holidaysView({ csrf: ctx.csrf, holidays: admin.listHolidays(ctx.db), ...extra }), status);
  r.get('/admin/feriados', ROLES, (ctx) => holidaysPage(ctx));
  r.post('/admin/feriados', ROLES, (ctx) => {
    const errors = {};
    const values = { date: ctx.body.date ?? '', name: validName(ctx.body.name, errors) };
    if (!isDate(values.date)) errors.date = 'Elige una fecha válida.';
    if (!hasErrors(errors)) {
      const res = admin.addHoliday(ctx.db, values);
      if (!res.errors) return ctx.redirect('/admin/feriados', 'Feriado registrado.');
      Object.assign(errors, res.errors);
    }
    return holidaysPage(ctx, { values, errors }, 422);
  });
  r.post('/admin/feriados/eliminar', ROLES, (ctx) => {
    admin.deleteHoliday(ctx.db, ctx.body.date);
    return ctx.redirect('/admin/feriados', 'Feriado eliminado.');
  });

  // ---- correos (outbox)
  r.get('/admin/correos', ROLES, (ctx) =>
    ctx.page('Correos enviados', html`${outboxView({ rows: listOutbox(ctx.db), tz: ctx.tz })}`));
}
