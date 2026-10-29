---

description: "Task list for TurnoYa v1 – reservas en línea para una clínica pequeña"
---

# Tasks: TurnoYa – Reservas en línea para una clínica pequeña

**Input**: Design documents from `/specs/001-reservas-turnoya/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUIDAS. La constitución (Principio I, NON-NEGOTIABLE) exige pruebas de frontera y de
violación para cada regla de negocio, escritas antes de la implementación que cubren.

**Organization**: Tareas agrupadas por historia de usuario (US1…US5) para implementar y probar cada
una de forma independiente. Prioridad: US1 (P1) = MVP; US2, US3 (P2); US4, US5 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US5)

## Path Conventions

Proyecto único (ver plan.md): `src/` y `tests/` en la raíz del repositorio.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Crear `package.json` (type module, scripts `start`, `seed`, `test`; sin dependencias) y la estructura de carpetas `src/{domain,db,services,web/{views,routes}}`, `tests/{unit,integration}`
- [x] T002 [P] Crear `.gitignore` (`data/`, `node_modules/`, `*.log`, `.env*`) en la raíz
- [x] T003 [P] Crear `src/config.js` con `PORT` (3000), `CLINIC_TZ` (America/Lima), `DB_PATH` (data/turnoya.db), `SESSION_TTL_HOURS` (8)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase.

- [x] T004 [P] Escribir pruebas de `time.js` en `tests/unit/time.test.js`: conversión local↔UTC en `America/Lima`, `addMinutes`, `FakeClock`, inicio/fin de día local
- [x] T005 Implementar `src/domain/time.js`: `Clock` (único módulo que lee `Date.now`), `FakeClock`, `zonedToUtc(date,time,tz)`, `utcToZoned`, `localDate(utc,tz)`, `weekdayOf(date)` (Principio V, FR-018)
- [x] T006 [P] Crear `src/db/schema.sql` con las tablas de data-model.md: users (`role` en patient|reception|doctor|admin), patients (`consecutive_no_shows` integer ≥ 0), specialties (`duration_min` 30 o 45), doctors, work_schedules (`start_time < end_time`), holidays, blocks (`starts_at < ends_at`), appointments (status active|cancelled|attended|no_show; `UNIQUE(doctor_id, starts_at) WHERE status='active'`), outbox (`dedupe_key` UNIQUE), sessions
- [x] T007 Implementar `src/db/db.js`: abrir `node:sqlite`, `PRAGMA foreign_keys=ON` y WAL, aplicar schema, helper `tx(db, fn)` con `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`
- [x] T008 [P] Escribir pruebas de validación en `tests/unit/validate.test.js`: correo, contraseña (≥ 8, letras y números), nombre 2–80, fecha `YYYY-MM-DD`, hora `HH:MM`, enteros
- [x] T009 Implementar `src/web/validate.js` (normalización + mensajes de error en español por campo) (Principio II, FR-017)
- [x] T010 [P] Implementar `src/web/views/layout.js`: `html` con escape por defecto, layout semántico (`lang="es"`, enlace "saltar al contenido", `nav`, `main`), estilos con contraste AA y foco visible, helper de campo con `label` + error `role="alert"` (Principio III)
- [x] T011 Implementar `src/web/router.js` y `src/web/server.js`: enrutador por método+patrón, parseo de formularios, respuestas HTML/redirect, 404/403/422, cabeceras de seguridad
- [x] T012 Implementar `src/services/auth.js` núcleo: hash `scrypt` con sal + `timingSafeEqual`, crear/leer/destruir sesión (token 32 bytes, CSRF por sesión), middleware `requireRole(...roles)` y verificación de CSRF en POST (Principio II, FR-015)
- [x] T013 [P] Implementar `src/services/notifications.js`: `enqueue(db, {kind, dedupeKey, to, subject, body})` (INSERT OR IGNORE por `dedupe_key`), `deliverPending(db, mailer, clock)` con máx. 5 intentos, adaptador `fileMailer` que escribe en `data/mails/` (Principio VI)
- [x] T014 Implementar `src/db/seed.js`: especialidades (Medicina General 30 min, Cardiología 45), médicos con horario L–V, cuentas de demostración de quickstart.md, un feriado de ejemplo
- [x] T015 Implementar `src/main.js`: arrancar DB, servidor y (más adelante) planificador de recordatorios; scripts `npm start` / `npm run seed`

**Checkpoint**: base lista — arranca vacío y sirve `/login`.

---

## Phase 3: User Story 1 – Paciente reserva una cita en línea (Priority: P1) 🎯 MVP

**Goal**: registro/inicio de sesión, búsqueda de disponibilidad y reserva con correo de confirmación.

**Independent Test**: registrar paciente → buscar horarios → reservar → la cita aparece en "Mis citas", el horario deja de ofrecerse y existe el correo de confirmación.

### Tests for User Story 1 (escribir primero; deben FALLAR)

- [x] T016 [P] [US1] Pruebas de `rules.js` en `tests/unit/rules.test.js`: solapamiento del médico (adyacente permitido, parcial rechazado), límite de 3 citas activas (3 ok / 4.ª rechazada), anticipación de 2 h inclusiva (exactamente 2 h ok, 1 h 59 min rechazada), bloqueo en línea con `consecutive_no_shows >= 3`, solapamiento del paciente, recepción exenta de 3 citas / 2 h / bloqueo (FR-005, 006, 007, 012, 022, 023, 024)
- [x] T017 [P] [US1] Pruebas de `availability.js` en `tests/unit/availability.test.js`: duración 30 vs 45 min (FR-004), descarte por citas activas, bloqueos, feriados y anticipación mínima, franjas múltiples, zona `America/Lima` (FR-002, 013, 018, 019)
- [x] T018 [P] [US1] Prueba de integración de registro/login/roles en `tests/integration/auth.test.js`: registro correcto, correo duplicado rechazado, contraseña débil con error junto al campo, login, acceso denegado sin sesión y con rol incorrecto (FR-001, FR-015)
- [x] T019 [P] [US1] Prueba de integración de reserva en `tests/integration/booking.test.js`: reserva exitosa + correo en outbox, 4.ª cita rechazada, < 2 h rechazada, doble reserva simultánea del mismo horario (solo una gana), solapamiento parcial rechazado (FR-003, 005, 006, 007; SC-002)

### Implementation for User Story 1

- [x] T020 [US1] Implementar `src/domain/rules.js` (puro): `hasOverlap`, `activeCountAllows(count, actor)`, `hasMinNotice(now, startsAt)` (inclusivo), `isOnlineBookingLocked(noShows)`, `patientHasOverlap`, `validateBooking({actor, now, startsAt, endsAt, doctorAppointments, patientAppointments, noShows})` que devuelve código de error de negocio (`TOO_SOON`, `LIMIT_REACHED`, `ONLINE_LOCKED`, `OVERLAP`) (depende de T016)
- [x] T021 [US1] Implementar `src/domain/availability.js` (puro): `availableSlots({...})` según research.md decisión 8 (depende de T017, T005)
- [x] T022 [US1] Implementar registro y login en `src/services/auth.js` (`registerPatient` crea user + patient; rechaza correo duplicado) (depende de T012, T018)
- [x] T023 [US1] Implementar `book()` en `src/services/appointments.js`: dentro de `tx`, cargar datos, `validateBooking`, insertar cita con `ends_at = starts_at + duration_min`, encolar `confirmation:<id>` (depende de T020, T021, T013, T019)
- [x] T024 [P] [US1] Vistas y rutas de autenticación `src/web/routes/auth.js` y `src/web/views/auth.js`: `/registro`, `/login`, `/logout`, `/` (FR-001)
- [x] T025 [P] [US1] Vistas y rutas de paciente `src/web/routes/patient.js` y `src/web/views/patient.js`: `/disponibilidad`, `POST /citas`, `/mis-citas` (lista) con mensajes de error de negocio claros (FR-002, FR-003)
- [x] T026 [US1] Conectar rutas en `src/web/server.js`, ejecutar T016–T019 hasta que pasen, y validar manualmente el escenario US1 de quickstart.md

**Checkpoint**: US1 funciona y se prueba sola (MVP).

---

## Phase 4: User Story 2 – Reprogramar, cancelar y recordatorio (Priority: P2)

**Goal**: cambios hasta 24 h antes y recordatorio automático único 24 h antes.

**Independent Test**: reprogramar libera el horario anterior; cancelar libera y deja de contar; cita a < 24 h no se puede modificar; un recordatorio por cita/horario.

### Tests for User Story 2

- [x] T027 [P] [US2] Ampliar `tests/unit/rules.test.js` con `canModify(now, startsAt)`: exactamente 24 h permitido, 23 h 59 min rechazado (FR-008, FR-024)
- [x] T028 [P] [US2] Prueba de integración `tests/integration/change.test.js`: reprogramar (horario anterior libre, encola `rescheduled`), cancelar (libera, `cancelled`, deja de contar para el límite), < 24 h rechazado, paciente ajeno recibe `NOT_OWNER` (FR-008, 015, 016)
- [x] T029 [P] [US2] Prueba `tests/integration/reminders.test.js` con `FakeClock`: recordatorio exactamente en la ventana de 24 h, no se duplica al ejecutar dos veces, no se envía para cita cancelada, reprogramada genera uno nuevo y no reenvía el anterior, cita reservada con < 24 h de anticipación no genera recordatorio, fallo de entrega no altera la cita y se reintenta (FR-009; SC-003)

### Implementation for User Story 2

- [x] T030 [US2] Implementar `canModify` en `src/domain/rules.js` (depende de T027)
- [x] T031 [US2] Implementar `reschedule()` y `cancel()` en `src/services/appointments.js` con verificación de propiedad y reglas de reserva para el nuevo horario; encolar `rescheduled:<id>:<starts_at>` / `cancelled:<id>` (depende de T030, T028)
- [x] T032 [US2] Implementar `src/services/reminders.js`: `tick(db, clock)` que encola `reminder:<id>:<starts_at>` según contracts/notifications.md y llama a `deliverPending`; agendar con `setInterval` 60 s en `src/main.js` (depende de T029, T013)
- [x] T033 [US2] Rutas/vistas `GET /citas/:id/reprogramar`, `POST /citas/:id/reprogramar`, `POST /citas/:id/cancelar` en `src/web/routes/patient.js` y acciones en `/mis-citas` (ocultas con texto explicativo si falta < 24 h)

**Checkpoint**: US1 + US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 – Recepción: agenda y asistencia (Priority: P2)

**Goal**: agenda día/semana, citas en nombre de pacientes, asistencia y bloqueo por inasistencias.

**Independent Test**: como recepción crear/modificar cita, marcar asistencia; tras 3 `no_show` el paciente no reserva en línea; recepción sí.

### Tests for User Story 3

- [x] T034 [P] [US3] Ampliar `tests/unit/rules.test.js` con conteo de inasistencias: `applyAttendance(noShows, result)` (no_show suma, attended reinicia a 0, cancelaciones no cuentan) (FR-021)
- [x] T035 [P] [US3] Prueba `tests/integration/reception.test.js`: agenda del día y de la semana, crear cita para paciente con y sin cuenta, exención de 2 h / 3 citas, solapamiento sigue rechazado, 3 `no_show` consecutivos bloquean reserva en línea y recepción aún puede agendar, `attended` desbloquea (FR-010, 011, 012, 021, 022)

### Implementation for User Story 3

- [x] T036 [US3] Implementar `applyAttendance` en `src/domain/rules.js` (depende de T034)
- [x] T037 [US3] Implementar `src/services/schedule.js` `agenda({from,to,doctorId})` y `markAttendance()` (solo citas ya iniciadas, actualiza `consecutive_no_shows`) y `bookByReception()` / `editByReception()` en `appointments.js` con `actor='reception'` (depende de T035, T036)
- [x] T038 [P] [US3] Rutas/vistas de recepción `src/web/routes/reception.js` y `src/web/views/reception.js`: `/recepcion/agenda` (día/semana, tabla con `th`), `/recepcion/citas/nueva`, `/recepcion/citas/:id/editar`, `POST …/asistencia` (FR-010, FR-011)

**Checkpoint**: US1–US3 operativas.

---

## Phase 6: User Story 4 – Médico: agenda y bloqueos (Priority: P3)

**Goal**: agenda propia y bloqueo/desbloqueo de horarios.

**Independent Test**: bloquear una tarde sin citas → desaparece de la disponibilidad; bloquear con citas activas → rechazo con lista de conflictos.

### Tests for User Story 4

- [x] T039 [P] [US4] Prueba `tests/integration/doctor.test.js`: el médico solo ve su agenda, crea bloqueo (desaparece de disponibilidad), lo elimina (reaparece), bloqueo con citas activas rechazado listando conflictos (`BLOCK_CONFLICT`), un médico no puede borrar bloqueos ajenos (FR-010, 013, 020)

### Implementation for User Story 4

- [x] T040 [US4] Implementar `createBlock()`, `deleteBlock()` en `src/services/schedule.js` (solapamiento con citas activas ⇒ `BLOCK_CONFLICT` + lista; `starts_at < ends_at`; motivo ≤ 120) (depende de T039)
- [x] T041 [P] [US4] Rutas/vistas de médico `src/web/routes/doctor.js` y `src/web/views/doctor.js`: `/medico/agenda`, `/medico/bloqueos`, `POST /medico/bloqueos/:id/eliminar`

---

## Phase 7: User Story 5 – Administrador (Priority: P3)

**Goal**: gestionar especialidades, médicos, horarios y feriados.

**Independent Test**: crear especialidad + médico + horario + feriado y comprobar la disponibilidad resultante.

### Tests for User Story 5

- [x] T042 [P] [US5] Prueba `tests/integration/admin.test.js`: acceso denegado a no administradores, crear especialidad (`duration_min` 30 o 45), médico con cuenta y horario (franjas válidas, sin solapar), feriado elimina toda disponibilidad de la fecha, desactivar médico oculta horarios nuevos y conserva citas futuras (FR-014, FR-019)

### Implementation for User Story 5

- [x] T043 [US5] Implementar `src/services/admin.js`: CRUD de especialidades, médicos (+ usuario con rol `doctor`), `work_schedules` y `holidays` con validaciones de data-model.md (depende de T042)
- [x] T044 [P] [US5] Rutas/vistas de administración `src/web/routes/admin.js` y `src/web/views/admin.js`: `/admin`, `/admin/especialidades`, `/admin/medicos`, `/admin/medicos/:id/horarios`, `/admin/feriados`, `/admin/correos`

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T045 [P] Revisar accesibilidad (teclado, orden de foco, `label`, errores en texto, contraste, tablas) en todas las vistas y registrar resultado en `specs/001-reservas-turnoya/checklists/accesibilidad.md` (SC-007, Principio III)
- [x] T046 [P] Prueba de concurrencia en `tests/integration/concurrency.test.js`: N reservas simultáneas del mismo horario ⇒ exactamente 1 cita activa (SC-002)
- [x] T047 [P] Escribir `README.md` con arranque en un comando, cuentas de demo, estructura y límites de v1
- [x] T048 Ejecutar la suite completa (`npm test`) y recorrer los escenarios manuales de `quickstart.md`; corregir lo que falle
- [x] T049 Verificar que no se registran datos personales en logs y que ninguna ruta POST funciona sin CSRF (Principio II, Additional Constraints)

---

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) → historias → Polish.
- **US1** no depende de otras historias. **US2** reutiliza `appointments.js` de US1. **US3** reutiliza
  `book()` de US1 con `actor='reception'`. **US4** y **US5** dependen solo de Foundational y de
  `availability.js` (US1) para sus pruebas de disponibilidad.
- Dentro de cada historia: pruebas (deben fallar) → dominio → servicios → rutas/vistas.

### Parallel Opportunities

- T002, T003 en paralelo; T004, T006, T008, T010, T013 en paralelo (archivos distintos).
- US1: T016–T019 (pruebas) en paralelo; T024 y T025 en paralelo.
- Tras Foundational, US4 y US5 pueden desarrollarse en paralelo a US2/US3.

## Implementation Strategy

1. **MVP**: Phases 1–3 (US1) → validar y demostrar.
2. Incremental: US2 → US3 (P2) → US4 → US5 (P3), validando cada historia por su *Independent Test*.
3. Polish al final; la suite completa debe pasar antes de dar la v1 por terminada.

---

## Implementation Notes (desviaciones respecto al diseño)

- Los recordatorios usan `updated_at` (no `created_at`) para decidir si la cita se reservó o reprogramó
  con menos de 24 h de anticipación; así una reprogramación tardía tampoco genera recordatorio inmediato.
- Se añadieron las rutas `POST /recepcion/citas/:id/cancelar`, `POST /admin/especialidades/:id/estado` y
  `POST /admin/medicos/:id/estado`; el outbox se entrega tras cada POST (además del ciclo de 60 s).
- Las tablas se envuelven en un contenedor desplazable accesible (hallazgo de la vista móvil).
- Pruebas: 104 en total (unitarias de dominio, integración HTTP, accesibilidad, contraste, CSRF, concurrencia).
