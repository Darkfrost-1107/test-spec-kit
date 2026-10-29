import { searchAvailability, book, reschedule, cancel, listPatientAppointments, getAppointment, loadDoctor, slotsFor } from '../../services/appointments.js';
import { listSpecialties, listDoctors } from '../../services/admin.js';
import { canModify } from '../../domain/rules.js';
import { localDate } from '../../domain/time.js';
import { isDate, toInt } from '../validate.js';
import { availabilityView, myAppointmentsView, rescheduleView } from '../views/patient.js';

const ROLES = { roles: ['patient'] };
const opt = (v) => { const n = toInt(v ?? ''); return Number.isNaN(n) ? null : n; };

export function registerPatientRoutes(r) {
  r.get('/disponibilidad', ROLES, (ctx) => {
    const fecha = isDate(ctx.query.fecha) ? ctx.query.fecha : ctx.today();
    const specialtyId = opt(ctx.query.especialidad);
    const doctorId = opt(ctx.query.medico);
    const results = searchAvailability(ctx, { specialtyId, doctorId, date: fecha });
    const doctors = listDoctors(ctx.db).filter((d) => d.active);
    return ctx.page('Buscar disponibilidad', availabilityView({
      csrf: ctx.csrf, tz: ctx.tz, specialties: listSpecialties(ctx.db).filter((s) => s.active), doctors,
      query: { especialidad: specialtyId ?? '', medico: doctorId ?? '', fecha }, results,
    }));
  });

  r.post('/citas', ROLES, (ctx) => {
    const back = `/disponibilidad?fecha=${isDate(ctx.body.fecha) ? ctx.body.fecha : ctx.today()}`;
    return ctx.attempt('/mis-citas', 'Cita reservada. Te enviamos un correo de confirmación.', back, () =>
      book(ctx, { actor: 'patient', patientId: ctx.user.patientId, doctorId: toInt(ctx.body.doctor_id ?? ''), startsAt: ctx.body.starts_at }));
  });

  r.get('/mis-citas', ROLES, (ctx) => {
    const appointments = listPatientAppointments(ctx.db, ctx.user.patientId);
    return ctx.page('Mis citas', myAppointmentsView({
      csrf: ctx.csrf, tz: ctx.tz, appointments, canModify: (a) => canModify(ctx.clock.now(), a.starts_at),
    }));
  });

  const own = (ctx) => {
    const appt = getAppointment(ctx.db, toInt(ctx.params.id));
    return appt && appt.patient_id === ctx.user.patientId ? appt : null;
  };

  r.get('/citas/:id/reprogramar', ROLES, (ctx) => {
    const appt = own(ctx);
    if (!appt) return ctx.forbidden();
    const fecha = isDate(ctx.query.fecha) ? ctx.query.fecha : localDate(new Date(appt.starts_at), ctx.tz);
    const slots = slotsFor(ctx, loadDoctor(ctx.db, appt.doctor_id), fecha, { enforceNotice: true, excludeApptId: appt.id });
    return ctx.page('Reprogramar cita', rescheduleView({
      csrf: ctx.csrf, tz: ctx.tz, appt, fecha, slots, action: `/citas/${appt.id}/reprogramar`, back: '/mis-citas',
    }));
  });

  r.post('/citas/:id/reprogramar', ROLES, (ctx) =>
    ctx.attempt('/mis-citas', 'Cita reprogramada. Te enviamos un correo.', `/citas/${ctx.params.id}/reprogramar`, () =>
      reschedule(ctx, { actor: 'patient', patientId: ctx.user.patientId, apptId: toInt(ctx.params.id), startsAt: ctx.body.starts_at })));

  r.post('/citas/:id/cancelar', ROLES, (ctx) =>
    ctx.attempt('/mis-citas', 'Cita cancelada.', '/mis-citas', () =>
      cancel(ctx, { actor: 'patient', patientId: ctx.user.patientId, apptId: toInt(ctx.params.id) })));
}
