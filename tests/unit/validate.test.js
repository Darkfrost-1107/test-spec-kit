import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration, isDate, isTime, toInt } from '../../src/web/validate.js';

test('registro válido normaliza el correo a minúsculas', () => {
  const r = validateRegistration({ name: '  Ana Pérez ', email: 'ANA@Correo.com', password: 'abc12345' });
  assert.deepEqual(r.errors, {});
  assert.equal(r.values.email, 'ana@correo.com');
  assert.equal(r.values.name, 'Ana Pérez');
});

test('registro inválido devuelve un error por campo', () => {
  const r = validateRegistration({ name: 'A', email: 'nope', password: 'corta1' });
  assert.ok(r.errors.name && r.errors.email && r.errors.password);
});

test('la contraseña exige letras y números', () => {
  assert.ok(validateRegistration({ name: 'Ana', email: 'a@b.co', password: 'soloLetrasAqui' }).errors.password);
  assert.ok(validateRegistration({ name: 'Ana', email: 'a@b.co', password: '123456789' }).errors.password);
  assert.deepEqual(validateRegistration({ name: 'Ana', email: 'a@b.co', password: 'letras123' }).errors, {});
});

test('isDate e isTime rechazan valores imposibles', () => {
  assert.equal(isDate('2026-11-02'), true);
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('02/11/2026'), false);
  assert.equal(isTime('09:30'), true);
  assert.equal(isTime('24:00'), false);
  assert.equal(isTime('9:5'), false);
});

test('toInt devuelve NaN para texto no numérico', () => {
  assert.equal(toInt('12'), 12);
  assert.ok(Number.isNaN(toInt('x')));
  assert.ok(Number.isNaN(toInt('')));
});
