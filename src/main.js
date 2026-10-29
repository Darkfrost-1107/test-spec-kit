import { config } from './config.js';
import { openDb } from './db/db.js';
import { Clock } from './domain/time.js';
import { createApp } from './web/server.js';
import { fileMailer } from './services/notifications.js';
import { tick } from './services/reminders.js';

const db = openDb(config.dbPath);
const clock = new Clock();
const mailer = fileMailer(config.mailDir);
const server = createApp({ db, clock, cfg: config, mailer });

// Planificador de recordatorios: cada minuto (idempotente, ver services/reminders.js).
const timer = setInterval(() => {
  tick({ db, clock, tz: config.tz }, mailer).catch((e) => console.error('Error en recordatorios:', e?.message));
}, 60 * 1000);

server.listen(config.port, () => console.log(`TurnoYa escuchando en http://localhost:${config.port} (zona ${config.tz})`));
process.on('SIGINT', () => { clearInterval(timer); server.close(() => process.exit(0)); });
