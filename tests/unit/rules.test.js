import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasOverlap, hasMinNotice, canModify, isOnlineBookingLocked, consecutiveNoShows, validateBooking,
} from '../../src/domain/rules.js';

const NOW = new Date('2026-11-02T14:00:00.000Z');
const H = 3600000;
const at = (offsetMs) => new Date(NOW.getTime() + offsetMs).toISOString();
const appt = (startOffsetH, minutes = 30, status = 'active', doctorId = 1) => ({
  doctor_id: doctorId,
  starts_at: at(startOffsetH * H),
  ends_at: at(startOffsetH * H + minutes * 60000),
  status,
});
const base = (over = {}) => ({
  actor: 'patient', now: NOW, startsAt: at(5 * H), endsAt: at(5 * H + 30 * 60000),
  doctorAppts: [], patientAppts: [], noShows: 0, ...over,
});

// FR-005 solapamiento
test('hasOverlap: citas adyacentes no se solapan', () => {
  assert.equal(hasOverlap(at(5 * H + 30 * 60000), at(6 * H), [appt(5)]), false);
});
test('hasOverlap: solapamiento parcial se rechaza', () => {
  assert.equal(hasOverlap(at(5 * H + 15 * 60000), at(5 * H + 45 * 60000), [appt(5)]), true);
});
test('hasOverlap: citas canceladas no cuentan', () => {
  assert.equal(hasOverlap(at(5 * H), at(5 * H + 30 * 60000), [appt(5, 30, 'cancelled')]), false);
});

// FR-007 / FR-024 anticipación mínima de 2 h inclusiva
test('hasMinNotice: exactamente 2 h es válido', () => {
  assert.equal(hasMinNotice(NOW, at(2 * H)), true);
});
test('hasMinNotice: 1 h 59 min se rechaza', () => {
  assert.equal(hasMinNotice(NOW, at(2 * H - 60000)), false);
});

// FR-008 / FR-024 ventana de 24 h inclusiva
test('canModify: exactamente 24 h todavía se puede modificar', () => {
  assert.equal(canModify(NOW, at(24 * H)), true);
});
test('canModify: 23 h 59 min ya no se puede modificar', () => {
  assert.equal(canModify(NOW, at(24 * H - 60000)), false);
});

// FR-012 / FR-021 inasistencias
test('isOnlineBookingLocked: 2 no, 3 sí', () => {
  assert.equal(isOnlineBookingLocked(2), false);
  assert.equal(isOnlineBookingLocked(3), true);
});
test('consecutiveNoShows: cuenta solo la racha más reciente, de nueva a antigua', () => {
  assert.equal(consecutiveNoShows([]), 0);
  assert.equal(consecutiveNoShows(['no_show', 'no_show', 'no_show', 'attended']), 3);
  assert.equal(consecutiveNoShows(['attended', 'no_show', 'no_show']), 0);
  assert.equal(consecutiveNoShows(['no_show', 'attended', 'no_show']), 1);
});

// validateBooking
test('validateBooking: reserva válida devuelve null', () => {
  assert.equal(validateBooking(base()), null);
});
test('validateBooking: 3 citas activas permiten la 3.ª pero no la 4.ª (FR-006)', () => {
  const two = [appt(30, 30, 'active', 2), appt(54, 30, 'active', 2)];
  assert.equal(validateBooking(base({ patientAppts: two })), null);
  const three = [...two, appt(78, 30, 'active', 2)];
  assert.equal(validateBooking(base({ patientAppts: three })), 'LIMIT_REACHED');
});
test('validateBooking: citas activas ya pasadas o canceladas no cuentan para el límite', () => {
  const list = [appt(-30, 30, 'active', 2), appt(30, 30, 'cancelled', 2), appt(54, 30, 'active', 2), appt(78, 30, 'active', 2)];
  assert.equal(validateBooking(base({ patientAppts: list })), null);
});
test('validateBooking: menos de 2 h rechaza al paciente (FR-007)', () => {
  assert.equal(validateBooking(base({ startsAt: at(2 * H - 60000), endsAt: at(3 * H) })), 'TOO_SOON');
  assert.equal(validateBooking(base({ startsAt: at(2 * H), endsAt: at(2 * H + 30 * 60000) })), null);
});
test('validateBooking: paciente con 3 inasistencias queda bloqueado en línea (FR-012)', () => {
  assert.equal(validateBooking(base({ noShows: 3 })), 'ONLINE_LOCKED');
  assert.equal(validateBooking(base({ noShows: 2 })), null);
});
test('validateBooking: solapamiento del médico se rechaza para cualquier actor (FR-005)', () => {
  const doctorAppts = [appt(5)];
  assert.equal(validateBooking(base({ doctorAppts })), 'OVERLAP');
  assert.equal(validateBooking(base({ doctorAppts, actor: 'reception' })), 'OVERLAP');
});
test('validateBooking: el paciente no puede tener dos citas solapadas con médicos distintos (FR-023)', () => {
  assert.equal(validateBooking(base({ patientAppts: [appt(5, 30, 'active', 2)] })), 'PATIENT_OVERLAP');
});
test('validateBooking: recepción está exenta de 2 h, 3 citas y bloqueo (FR-022)', () => {
  const three = [appt(30, 30, 'active', 2), appt(54, 30, 'active', 2), appt(78, 30, 'active', 2)];
  const over = { actor: 'reception', startsAt: at(1 * H), endsAt: at(1 * H + 30 * 60000), patientAppts: three, noShows: 5 };
  assert.equal(validateBooking(base(over)), null);
});
