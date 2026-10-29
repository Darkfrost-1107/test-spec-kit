# TurnoYa – Reservas en línea para una clínica pequeña (v1)

Primera versión de TurnoYa, construida con **Spec-Driven Development** usando Spec Kit
(`/speckit-constitution` → `specify` → `clarify` → `plan` → `tasks` → `implement`).

- Constitución: [.specify/memory/constitution.md](.specify/memory/constitution.md)
- Especificación y diseño: [specs/001-reservas-turnoya/](specs/001-reservas-turnoya/)
- **Capturas de todo el proceso SDD**: [capturas/](capturas/README.md)

## Arranque (Node.js ≥ 24, sin dependencias)

```bash
npm run seed   # crea data/turnoya.db con datos de demostración
npm start      # http://localhost:3000
npm test       # 104 pruebas (reglas de negocio, HTTP, accesibilidad, seguridad)
```

Variables: `PORT` (3000), `CLINIC_TZ` (America/Lima), `DB_PATH` (data/turnoya.db), `MAIL_DIR` (data/mails).

Cuentas de demostración (solo desarrollo, creadas por `npm run seed`):

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administrador | admin@turnoya.test | Admin1234 |
| Recepción | recepcion@turnoya.test | Recep1234 |
| Médico | medico@turnoya.test | Medico1234 |
| Paciente | paciente@turnoya.test | Paciente1234 |

## Qué incluye la v1

| Historia | Prioridad | Estado |
|----------|-----------|--------|
| US1 Paciente: registro, búsqueda, reserva + correo de confirmación | P1 | ✔ |
| US2 Reprogramar/cancelar hasta 24 h antes + recordatorio 24 h antes | P2 | ✔ |
| US3 Recepción: agenda día/semana, citas por teléfono, asistencia, bloqueo por 3 inasistencias | P2 | ✔ |
| US4 Médico: agenda propia y bloqueo de horarios | P3 | ✔ |
| US5 Administrador: especialidades, médicos, horarios, feriados | P3 | ✔ |

Reglas de negocio implementadas y probadas en su frontera: 30/45 min por especialidad, sin solapamiento
de médico (incluso con solicitudes simultáneas), máx. 3 citas activas, anticipación mínima 2 h,
cambios hasta 24 h (límites inclusivos), 3 inasistencias consecutivas bloquean la reserva en línea.
Decisiones tomadas en `/speckit-clarify`: zona horaria única de la clínica, feriados administrados,
bloqueo de médico rechazado si hay citas activas, reglas de conteo de inasistencias y exenciones de
recepción (ver `specs/001-reservas-turnoya/spec.md`).

## Límites conocidos de la v1

- El envío de correo es simulado: cada mensaje se guarda en `data/mails/` y en la bandeja
  `/admin/correos`. La interfaz `send()` permite sustituirlo por SMTP (ver `contracts/notifications.md`).
- Un solo proceso: la atomicidad de reservas se apoya en transacciones de SQLite de un proceso.
- `node:sqlite` aún emite un aviso de "experimental" en Node 24 (se silencia en los scripts npm).
- Sin recuperación de contraseña, ni menores/representantes, ni integración de pagos (fuera de alcance v1).
