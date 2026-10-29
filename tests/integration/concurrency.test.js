import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, seedClinic, at } from '../helpers.js';
import { registerPatient } from '../../src/services/auth.js';

test('12 pacientes reservando el mismo horario simultáneamente: exactamente una cita activa (SC-002)', async () => {
  const app = await makeApp();
  try {
    const ids = seedClinic(app.db);
    const clients = [];
    for (let i = 0; i < 12; i += 1) {
      registerPatient(app.db, { name: `Paciente ${i}`, email: `p${i}@carrera.test`, password: 'Carrera1234' });
      clients.push(await app.client().login(`p${i}@carrera.test`, 'Carrera1234'));
    }
    const results = await Promise.all(clients.map((c) =>
      c.post('/citas', { doctor_id: ids.ana, starts_at: at('2026-11-04', '09:00'), fecha: '2026-11-04' })));
    assert.equal(results.filter((r) => /Cita reservada/.test(r.text)).length, 1);
    assert.equal(app.db.prepare("SELECT COUNT(*) n FROM appointments WHERE status = 'active'").get().n, 1);
    assert.equal(app.db.prepare("SELECT COUNT(*) n FROM outbox WHERE kind = 'confirmation'").get().n, 1);
  } finally {
    await app.close();
  }
});

test('la base rechaza dos citas activas con el mismo inicio aunque se salte la capa de servicio', async () => {
  const app = await makeApp();
  try {
    const ids = seedClinic(app.db);
    const ins = () => app.db.prepare(
      `INSERT INTO appointments (patient_id, doctor_id, starts_at, ends_at, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 'patient', ?, ?)`,
    ).run(ids.paula, ids.ana, at('2026-11-04', '09:00'), at('2026-11-04', '09:30'), '2026-11-02T14:00:00.000Z', '2026-11-02T14:00:00.000Z');
    ins();
    assert.throws(ins, /UNIQUE/);
  } finally {
    await app.close();
  }
});
