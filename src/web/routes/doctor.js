import { agenda, agendaRange, listBlocks, createBlock, deleteBlock } from '../../services/schedule.js';
import { BizError } from '../../domain/errors.js';
import { formatLocal } from '../../domain/time.js';
import { isDate, isTime, toInt } from '../validate.js';
import { agendaFilters, agendaTable } from '../views/reception.js';
import { blocksView } from '../views/doctor.js';
import { html } from '../views/layout.js';

const ROLES = { roles: ['doctor'] };

export function registerDoctorRoutes(r) {
  r.get('/medico/agenda', ROLES, (ctx) => {
    const fecha = isDate(ctx.query.fecha) ? ctx.query.fecha : ctx.today();
    const vista = ctx.query.vista === 'semana' ? 'semana' : 'dia';
    const items = agenda(ctx, { ...agendaRange(fecha, vista), doctorId: ctx.user.doctorId });
    return ctx.page('Mi agenda', html`${agendaFilters({ action: '/medico/agenda', query: { fecha, vista }, doctors: [], showDoctor: false })}
      ${agendaTable({ items, tz: ctx.tz, now: ctx.clock.now(), csrf: ctx.csrf, actions: false })}`);
  });

  r.get('/medico/bloqueos', ROLES, (ctx) =>
    ctx.page('Bloqueos de horario', blocksView({ csrf: ctx.csrf, tz: ctx.tz, blocks: listBlocks(ctx.db, ctx.user.doctorId) })));

  r.post('/medico/bloqueos', ROLES, (ctx) => {
    const b = ctx.body;
    const errors = {};
    const values = { date: b.date ?? '', start: b.start ?? '', end: b.end ?? '', reason: String(b.reason ?? '').trim().slice(0, 120) };
    if (!isDate(values.date)) errors.date = 'Elige una fecha válida.';
    if (!isTime(values.start)) errors.start = 'Hora de inicio inválida.';
    if (!isTime(values.end)) errors.end = 'Hora de fin inválida.';
    if (!errors.start && !errors.end && values.start >= values.end) errors.end = 'La hora de fin debe ser posterior a la de inicio.';
    if (!values.reason) errors.reason = 'Escribe el motivo (vacaciones, reunión…).';
    if (Object.keys(errors).length) {
      return ctx.page('Bloqueos de horario',
        blocksView({ csrf: ctx.csrf, tz: ctx.tz, blocks: listBlocks(ctx.db, ctx.user.doctorId), values, errors }), 422);
    }
    try {
      createBlock(ctx, { doctorId: ctx.user.doctorId, ...values });
      return ctx.redirect('/medico/bloqueos', 'Horario bloqueado.');
    } catch (e) {
      if (!(e instanceof BizError)) throw e;
      const detail = e.code === 'BLOCK_CONFLICT'
        ? ` Citas en conflicto: ${e.details.map((a) => formatLocal(new Date(a.starts_at), ctx.tz)).join(', ')}.` : '';
      return ctx.redirect('/medico/bloqueos', e.message + detail, 'err');
    }
  });

  r.post('/medico/bloqueos/:id/eliminar', ROLES, (ctx) => {
    const ok = deleteBlock(ctx.db, { blockId: toInt(ctx.params.id), doctorId: ctx.user.doctorId });
    return ok ? ctx.redirect('/medico/bloqueos', 'Bloqueo eliminado.') : ctx.forbidden();
  });
}
