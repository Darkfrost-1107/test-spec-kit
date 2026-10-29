import { book, reschedule, cancel, markAttendance, getAppointment, loadDoctor, slotsFor, listPatients } from '../../services/appointments.js';
import { agenda, agendaRange } from '../../services/schedule.js';
import { listDoctors } from '../../services/admin.js';
import { localDate } from '../../domain/time.js';
import { isDate, toInt, validName, validEmail, validPhone } from '../validate.js';
import { agendaFilters, agendaTable, newAppointmentView, editAppointmentView } from '../views/reception.js';
import { html } from '../views/layout.js';

const ROLES = { roles: ['reception'] };
const opt = (v) => { const n = toInt(v ?? ''); return Number.isNaN(n) ? null : n; };

export function registerReceptionRoutes(r) {
  r.get('/recepcion/agenda', ROLES, (ctx) => {
    const fecha = isDate(ctx.query.fecha) ? ctx.query.fecha : ctx.today();
    const vista = ctx.query.vista === 'semana' ? 'semana' : 'dia';
    const medico = opt(ctx.query.medico);
    const items = agenda(ctx, { ...agendaRange(fecha, vista), doctorId: medico });
    return ctx.page('Agenda de recepción', html`${agendaFilters({ action: '/recepcion/agenda', query: { fecha, vista, medico: medico ?? '' }, doctors: listDoctors(ctx.db) })}
      ${agendaTable({ items, tz: ctx.tz, now: ctx.clock.now(), csrf: ctx.csrf, actions: true })}`);
  });

  r.get('/recepcion/citas/nueva', ROLES, (ctx) => {
    const fecha = isDate(ctx.query.fecha) ? ctx.query.fecha : ctx.today();
    const medico = opt(ctx.query.medico);
    const doctors = listDoctors(ctx.db).filter((d) => d.active);
    const slots = medico ? slotsFor(ctx, loadDoctor(ctx.db, medico), fecha, { enforceNotice: false }) : [];
    return ctx.page('Nueva cita', newAppointmentView({
      csrf: ctx.csrf, tz: ctx.tz, patients: listPatients(ctx.db), doctors, query: { medico: medico ?? '', fecha }, slots,
    }));
  });

  r.post('/recepcion/citas', ROLES, (ctx) => {
    const b = ctx.body;
    const doctorId = toInt(b.doctor_id ?? '');
    const back = `/recepcion/citas/nueva?medico=${doctorId}&fecha=${localDate(new Date(b.starts_at ?? ctx.clock.now()), ctx.tz)}`;
    let patientId = opt(b.patient_id);
    let newPatient;
    if (!patientId) {
      const errors = {};
      newPatient = { name: validName(b.name, errors), email: validEmail(b.email, errors, 'email', { required: false }), phone: validPhone(b.phone, errors) };
      if (Object.keys(errors).length) return ctx.redirect(back, Object.values(errors)[0], 'err');
    }
    return ctx.attempt('/recepcion/agenda', 'Cita agendada.', back, () =>
      book(ctx, { actor: 'reception', patientId, newPatient, doctorId, startsAt: b.starts_at }));
  });

  r.get('/recepcion/citas/:id/editar', ROLES, (ctx) => {
    const appt = getAppointment(ctx.db, toInt(ctx.params.id));
    if (!appt) return ctx.notFound();
    const fecha = isDate(ctx.query.fecha) ? ctx.query.fecha : localDate(new Date(appt.starts_at), ctx.tz);
    const slots = appt.status === 'active'
      ? slotsFor(ctx, loadDoctor(ctx.db, appt.doctor_id), fecha, { enforceNotice: false, excludeApptId: appt.id }) : [];
    return ctx.page('Editar cita', editAppointmentView({ csrf: ctx.csrf, tz: ctx.tz, appt, fecha, slots }));
  });

  r.post('/recepcion/citas/:id/editar', ROLES, (ctx) =>
    ctx.attempt('/recepcion/agenda', 'Cita reprogramada.', `/recepcion/citas/${ctx.params.id}/editar`, () =>
      reschedule(ctx, { actor: 'reception', apptId: toInt(ctx.params.id), startsAt: ctx.body.starts_at })));

  r.post('/recepcion/citas/:id/cancelar', ROLES, (ctx) =>
    ctx.attempt('/recepcion/agenda', 'Cita cancelada.', '/recepcion/agenda', () =>
      cancel(ctx, { actor: 'reception', apptId: toInt(ctx.params.id) })));

  r.post('/recepcion/citas/:id/asistencia', ROLES, (ctx) =>
    ctx.attempt('/recepcion/agenda', 'Asistencia registrada.', '/recepcion/agenda', () =>
      markAttendance(ctx, { apptId: toInt(ctx.params.id), result: ctx.body.result })));
}
