# Research: TurnoYa v1

Phase 0 del plan. Resuelve las incógnitas del Technical Context. Formato: Decisión / Racional /
Alternativas.

## 1. Runtime y servidor web

- **Decision**: Node.js 24 con `node:http` y un enrutador propio mínimo; páginas HTML renderizadas
  en servidor con funciones de plantilla que escapan por defecto.
- **Rationale**: ya instalado en el entorno de trabajo; cero dependencias (Principio IV); sin JS de
  cliente obligatorio cumple accesibilidad (Principio III) y reduce superficie de ataque.
- **Alternatives considered**: Express/Fastify (dependencia innecesaria para ≈ 40 rutas); Next.js +
  Prisma + PostgreSQL (potente pero exige instalar toda una cadena y base externa para una clínica
  pequeña); FastAPI + React (dos proyectos y dos toolchains).

## 2. Almacenamiento

- **Decision**: SQLite mediante `node:sqlite` (`DatabaseSync`), con `PRAGMA foreign_keys=ON` y
  modo WAL.
- **Rationale**: base transaccional embebida sin servicio externo; operaciones síncronas hacen que
  “comprobar + insertar” dentro de `BEGIN IMMEDIATE` sea atómico en un proceso; despliegue de un solo
  archivo para una clínica pequeña.
- **Alternatives considered**: PostgreSQL (más robusto multi-proceso, pero infraestructura extra);
  `better-sqlite3` (dependencia nativa).
- **Riesgo**: `node:sqlite` emite aviso “ExperimentalWarning” en Node 24. Mitigación: aislado en
  `src/db/db.js`; migrar a PostgreSQL requeriría cambiar solo ese módulo y SQL específico.

## 3. Prevención de citas solapadas con concurrencia (FR-005, SC-002)

- **Decision**: doble defensa: (a) comprobación de solapamiento dentro de `BEGIN IMMEDIATE`;
  (b) índice único parcial `UNIQUE(doctor_id, starts_at) WHERE status='active'` como red de seguridad
  para el mismo inicio. El solapamiento parcial (distinta hora de inicio) lo detecta (a).
- **Rationale**: SQLite serializa escrituras; el proceso único evita carreras entre peticiones.
- **Alternatives considered**: bloqueo optimista con reintentos (complejidad sin beneficio en un
  proceso); restricción `EXCLUDE` de PostgreSQL (no disponible en SQLite).

## 4. Zona horaria y reloj (Principio V, FR-018)

- **Decision**: instantes en UTC (ISO-8601 con `Z`); horarios de atención, feriados y “día” se
  definen en hora local de la clínica (`CLINIC_TZ`, por defecto `America/Lima`). Conversión
  local→UTC con `Intl.DateTimeFormat` (sin librerías). Módulo `time.js` expone `Clock`
  (`now()`), y los límites 2 h / 24 h se calculan sobre instantes.
- **Rationale**: elimina ambigüedad con dispositivos de distinta zona; `Intl` está incluido en Node;
  inyectar el reloj permite probar fronteras exactas.
- **Alternatives considered**: `luxon`/`date-fns-tz` (dependencia innecesaria); guardar hora local
  (rompe comparaciones y cambios de horario de verano).
- **Nota**: el horario de verano no aplica a la zona por defecto; la conversión lo soporta por
  diseño usando offsets de `Intl` en la fecha concreta.

## 5. Autenticación y sesiones (FR-001, FR-015, Principio II)

- **Decision**: correo + contraseña; hash `crypto.scrypt` con sal aleatoria por usuario y
  comparación `timingSafeEqual`; sesiones en tabla con token aleatorio de 32 bytes en cookie
  `HttpOnly; SameSite=Lax; Path=/`; token CSRF por sesión en formularios POST.
- **Rationale**: estándar de la plataforma, sin dependencias; protege contra XSS-robo de sesión y CSRF.
- **Alternatives considered**: JWT (innecesario con un solo servidor); bcrypt/argon2 (dependencias).
- **Contraseña mínima**: 8 caracteres con letras y números (validado en el borde).

## 6. Notificaciones por correo (FR-003, FR-009, FR-016, Principio VI)

- **Decision**: tabla `outbox` (confirmación, reprogramación, cancelación, recordatorio) con
  `dedupe_key` única; se encola en la misma transacción que el cambio de la cita; un “entregador” la
  procesa y marca `sent`/`failed` con reintentos (máx. 5). En v1 el adaptador de entrega escribe el
  mensaje como archivo `.txt` en `data/mails/` (simulación de correo); la interfaz
  `send({to, subject, body})` permite reemplazarlo por SMTP sin tocar el dominio.
- **Rationale**: cumple idempotencia y reintentos sin infraestructura de correo; verificable en
  pruebas leyendo la tabla/archivos.
- **Alternatives considered**: SMTP real vía `nodemailer` (dependencia + credenciales; se deja como
  adaptador futuro); envío síncrono en la petición (un fallo del correo afectaría la reserva).

## 7. Recordatorios 24 h antes (FR-009)

- **Decision**: planificador en proceso (`setInterval` cada 60 s, reloj inyectable) que busca citas
  `active` con `starts_at − 24 h ≤ ahora < starts_at` y `created_at ≤ starts_at − 24 h`, y encola
  `reminder:{appointmentId}:{starts_at}`. La clave incluye `starts_at`, así una reprogramación genera
  su propio recordatorio y el anterior no se reenvía; una cita cancelada nunca coincide.
- **Rationale**: simple, idempotente, recuperable tras reinicio (consulta por estado, no por
  temporizador por cita).
- **Alternatives considered**: cola de trabajos externa (Redis/BullMQ: infraestructura excesiva);
  cron del sistema operativo (menos portable, no probable con reloj falso).

## 8. Generación de disponibilidad (FR-002, FR-004, FR-013, FR-019)

- **Decision**: función pura `availableSlots({doctor, specialty, date, schedules, blocks, holidays,
  appointments, now, tz})`: para cada franja del horario del médico ese día de la semana, genera
  intervalos consecutivos de `duration_min`; descarta los que se solapan con bloqueos o citas
  activas, los de feriados, y (para canales en línea) los que empiezan antes de `now + 2 h`.
- **Rationale**: pura ⇒ testeable en fronteras; las consultas SQL solo reúnen datos.
- **Alternatives considered**: materializar horarios en una tabla de slots (más estado que
  sincronizar al cambiar horarios/bloqueos).

## 9. Pruebas (Principio I)

- **Decision**: `node:test` y `node:assert/strict`. Unitarias de dominio con `FakeClock`;
  integración levantando el servidor HTTP en puerto efímero con base `:memory:` y haciendo
  peticiones con `fetch` (incluye cookies y CSRF).
- **Rationale**: sin dependencias; ejecuta rápido; cubre escenarios de aceptación de la spec.

## 10. Accesibilidad (Principio III, SC-007)

- **Decision**: HTML semántico, `lang="es"`, enlace “saltar al contenido”, foco visible, errores
  con `role="alert"` junto al campo, tablas con `<th scope>`, estados con texto + icono (no solo
  color), sin dependencia de JavaScript.
- **Verificación**: lista de comprobación manual con teclado en la fase Polish.
