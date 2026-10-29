// Configuración de la clínica. Todo se puede sobreescribir con variables de entorno.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  tz: process.env.CLINIC_TZ ?? 'America/Lima',
  dbPath: process.env.DB_PATH ?? 'data/turnoya.db',
  mailDir: process.env.MAIL_DIR ?? 'data/mails',
  sessionTtlHours: 8,
};
