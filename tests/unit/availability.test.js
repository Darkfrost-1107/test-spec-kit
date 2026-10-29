import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableSlots } from '../../src/domain/availability.js';
import { zonedToUtc, localTime } from '../../src/domain/time.js';

const TZ = 'America/Lima';
const DATE = '2026-11-02'; // lunes
const NOW = new Date('2026-11-01T12:00:00.000Z'); // un día antes
const L = (time) => zonedToUtc(DATE, time, TZ).toISOString();
const sched = (weekday, start, end) => ({ weekday, start_time: start, end_time: end });

const run = (over = {}) => availableSlots({
  date: DATE, durationMin: 30, schedules: [sched(1, '09:00', '11:00')],
  blocks: [], holidays: [], appointments: [], now: NOW, tz: TZ, enforceNotice: true, ...over,
});
const starts = (slots) => slots.map((s) => localTime(new Date(s.startsAt), TZ));

test('consulta general (30 min) genera franjas de 30 minutos (FR-004)', () => {
  assert.deepEqual(starts(run()), ['09:00', '09:30', '10:00', '10:30']);
});

test('especialidad (45 min) genera franjas de 45 minutos sin exceder el horario', () => {
  const slots = run({ durationMin: 45 });
  assert.deepEqual(starts(slots), ['09:00', '09:45']);
  assert.equal(slots[0].endsAt, L('09:45'));
});

test('una cita activa elimina los horarios que solapa (30 min)', () => {
  const appointments = [{ starts_at: L('09:30'), ends_at: L('10:00'), status: 'active' }];
  assert.deepEqual(starts(run({ appointments })), ['09:00', '10:00', '10:30']);
});

test('una cita parcial elimina también horarios de 45 min que la tocan', () => {
  const appointments = [{ starts_at: L('09:30'), ends_at: L('10:00'), status: 'active' }];
  assert.deepEqual(starts(run({ durationMin: 45, appointments })), []);
});

test('citas canceladas no ocupan horario', () => {
  const appointments = [{ starts_at: L('09:00'), ends_at: L('09:30'), status: 'cancelled' }];
  assert.deepEqual(starts(run({ appointments })), ['09:00', '09:30', '10:00', '10:30']);
});

test('un bloqueo del médico elimina los horarios que cubre (FR-013)', () => {
  const blocks = [{ starts_at: L('10:00'), ends_at: L('11:00') }];
  assert.deepEqual(starts(run({ blocks })), ['09:00', '09:30']);
});

test('un feriado elimina toda la disponibilidad del día (FR-019)', () => {
  assert.deepEqual(run({ holidays: [DATE] }), []);
});

test('otro día de la semana no ofrece horarios', () => {
  assert.deepEqual(run({ schedules: [sched(2, '09:00', '11:00')] }), []);
});

test('varias franjas el mismo día se combinan y ordenan', () => {
  const schedules = [sched(1, '15:00', '16:00'), sched(1, '09:00', '10:00')];
  assert.deepEqual(starts(run({ schedules })), ['09:00', '09:30', '15:00', '15:30']);
});

test('anticipación mínima de 2 h inclusiva para canales en línea (FR-007, FR-024)', () => {
  const now = new Date(zonedToUtc(DATE, '08:00', TZ)); // 2 h antes de las 10:00
  assert.deepEqual(starts(run({ now })), ['10:00', '10:30']);
});

test('sin anticipación mínima (recepción) se ofrecen horarios futuros pero no pasados', () => {
  const now = new Date(zonedToUtc(DATE, '09:45', TZ));
  assert.deepEqual(starts(run({ now, enforceNotice: false })), ['10:00', '10:30']);
});
