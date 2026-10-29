// Datos de demostración (solo desarrollo). Idempotente: no hace nada si ya hay especialidades.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { openDb } from './db.js';
import { createUser } from '../services/auth.js';
import * as admin from '../services/admin.js';

export function seedDemo(db) {
  if (admin.listSpecialties(db).length) return false;
  const general = admin.createSpecialty(db, { name: 'Medicina General', durationMin: 30 });
  const cardio = admin.createSpecialty(db, { name: 'Cardiología', durationMin: 45 });
  const ana = admin.createDoctor(db, { name: 'Dra. Ana Torres', specialtyId: general, email: 'medico@turnoya.test', password: 'Medico1234' });
  const luis = admin.createDoctor(db, { name: 'Dr. Luis Rojas', specialtyId: cardio, email: 'luis.rojas@turnoya.test', password: 'Medico1234' });
  for (let weekday = 1; weekday <= 5; weekday += 1) {
    admin.addSchedule(db, { doctorId: ana, weekday, start: '09:00', end: '13:00' });
    admin.addSchedule(db, { doctorId: ana, weekday, start: '15:00', end: '18:00' });
    admin.addSchedule(db, { doctorId: luis, weekday, start: '09:00', end: '12:00' });
  }
  admin.addHoliday(db, { date: '2026-11-01', name: 'Todos los Santos' });
  admin.addHoliday(db, { date: '2026-12-25', name: 'Navidad' });
  createUser(db, { email: 'admin@turnoya.test', password: 'Admin1234', name: 'Administración', role: 'admin' });
  createUser(db, { email: 'recepcion@turnoya.test', password: 'Recep1234', name: 'Recepción', role: 'reception' });
  const userId = createUser(db, { email: 'paciente@turnoya.test', password: 'Paciente1234', name: 'Paciente de Prueba', role: 'patient' });
  db.prepare('INSERT INTO patients (user_id, name, email) VALUES (?, ?, ?)').run(userId, 'Paciente de Prueba', 'paciente@turnoya.test');
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openDb(config.dbPath);
  console.log(seedDemo(db) ? `Datos de demostración creados en ${config.dbPath}` : 'La base ya tiene datos; no se modificó.');
}
