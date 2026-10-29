import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock, zonedToUtc, localDate, localTime, weekdayOf, addDays, addMinutes, weekRange } from '../../src/domain/time.js';

const LIMA = 'America/Lima';

test('zonedToUtc convierte hora local de Lima (UTC-5) a UTC', () => {
  assert.equal(zonedToUtc('2026-11-02', '09:00', LIMA).toISOString(), '2026-11-02T14:00:00.000Z');
});

test('zonedToUtc respeta el horario de verano de otras zonas', () => {
  assert.equal(zonedToUtc('2026-01-15', '09:00', 'America/New_York').toISOString(), '2026-01-15T14:00:00.000Z');
  assert.equal(zonedToUtc('2026-03-09', '09:00', 'America/New_York').toISOString(), '2026-03-09T13:00:00.000Z');
});

test('localDate y localTime devuelven la fecha/hora de la clínica, no la UTC', () => {
  const t = new Date('2026-11-03T03:30:00.000Z');
  assert.equal(localDate(t, LIMA), '2026-11-02');
  assert.equal(localTime(t, LIMA), '22:30');
});

test('weekdayOf, addDays y weekRange', () => {
  assert.equal(weekdayOf('2026-11-02'), 1); // lunes
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.deepEqual(weekRange('2026-11-04'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
});

test('FakeClock permite fijar y avanzar el tiempo', () => {
  const c = new FakeClock('2026-11-02T14:00:00.000Z');
  assert.equal(c.now().toISOString(), '2026-11-02T14:00:00.000Z');
  c.advance(90);
  assert.equal(c.now().toISOString(), '2026-11-02T15:30:00.000Z');
  assert.equal(addMinutes(c.now(), 30).toISOString(), '2026-11-02T16:00:00.000Z');
});
