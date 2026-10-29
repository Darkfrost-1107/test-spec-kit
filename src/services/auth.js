// Registro, inicio de sesión y sesiones. Contraseñas con scrypt + sal (Principio II).
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { tx } from '../db/db.js';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const DUMMY_HASH = hashPassword('contrasena-ficticia-1'); // iguala el tiempo cuando el correo no existe

export function createUser(db, { email, password, name, role, doctorId = null }) {
  const r = db.prepare(
    'INSERT INTO users (email, password_hash, name, role, doctor_id) VALUES (?, ?, ?, ?, ?)',
  ).run(email, hashPassword(password), name, role, doctorId);
  return Number(r.lastInsertRowid);
}

export function emailTaken(db, email) {
  return Boolean(db.prepare('SELECT 1 FROM users WHERE email = ?').get(email));
}

/** Devuelve { errors } si el correo ya existe o { userId, patientId } si se registró. */
export function registerPatient(db, { name, email, password }) {
  return tx(db, () => {
    if (emailTaken(db, email)) return { errors: { email: 'Ese correo ya está registrado. Inicia sesión.' } };
    const userId = createUser(db, { email, password, name, role: 'patient' });
    const r = db.prepare('INSERT INTO patients (user_id, name, email) VALUES (?, ?, ?)').run(userId, name, email);
    return { userId, patientId: Number(r.lastInsertRowid) };
  });
}

export function login(db, clock, ttlHours, { email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return null;
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(16).toString('hex');
  const expires = new Date(clock.now().getTime() + ttlHours * 3600 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)').run(token, user.id, csrf, expires);
  return { token, csrf };
}

export function getSession(db, clock, token) {
  if (!token) return null;
  const row = db.prepare(
    `SELECT s.token, s.csrf, s.expires_at, u.id AS user_id, u.name, u.email, u.role, u.doctor_id,
            (SELECT id FROM patients WHERE user_id = u.id) AS patient_id
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
  ).get(token);
  if (!row) return null;
  if (row.expires_at <= clock.now().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return {
    token: row.token,
    csrf: row.csrf,
    user: { id: row.user_id, name: row.name, email: row.email, role: row.role, doctorId: row.doctor_id, patientId: row.patient_id },
  };
}

export function destroySession(db, token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}
