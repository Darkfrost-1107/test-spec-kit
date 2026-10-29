# Implementation Plan: TurnoYa – Reservas en línea para una clínica pequeña

**Branch**: `001-reservas-turnoya` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-reservas-turnoya/spec.md`

## Summary

Aplicación web renderizada en servidor para que pacientes reserven, reprogramen y cancelen citas, y
para que recepción, médicos y administración gestionen la agenda. El núcleo es una **capa de dominio
pura** (reglas de negocio + generación de disponibilidad) que recibe un reloj inyectable y la zona
horaria de la clínica, por lo que cada regla de la spec se prueba en su frontera sin HTTP ni base
de datos (Principio I y V). La integridad contra solapamientos concurrentes se garantiza con una
transacción atómica y un índice único parcial en la base. Las notificaciones usan una tabla
*outbox* con clave de idempotencia y un planificador interno que genera recordatorios (Principio VI).
Stack sin dependencias de terceros: Node.js 24 (`node:http`, `node:sqlite`, `node:crypto`,
`node:test`).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 24 LTS

**Primary Dependencies**: ninguna de terceros (solo módulos incluidos en Node: `http`, `sqlite`, `crypto`, `test`, `assert`)

**Storage**: SQLite embebido (`node:sqlite`), archivo `data/turnoya.db`; todos los instantes en UTC

**Testing**: `node --test` (unitarias de dominio con reloj falso; integración con la app HTTP real sobre base en memoria)

**Target Platform**: Linux/Windows/macOS con Node ≥ 24; navegador moderno (HTML sin JavaScript obligatorio)

**Project Type**: web-service con páginas renderizadas en servidor (un solo proyecto)

**Performance Goals**: agenda del día < 1 s con ≤ 5 000 citas; búsqueda de disponibilidad < 1 s (SC-005)

**Constraints**: una clínica, una zona horaria (`CLINIC_TZ`, por defecto `America/Lima`); sin JS obligatorio (accesibilidad); un solo proceso (la atomicidad de reservas depende de ello en v1)

**Scale/Scope**: ≤ 20 médicos, ≤ 2 000 pacientes, ≈ 25 pantallas/formularios, 5 roles de uso (paciente, recepción, médico, admin)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en el plan | Estado |
|-----------|-------------------------|--------|
| I. Reglas de negocio con pruebas | `src/domain/rules.js` y `availability.js` puros; `tests/unit/rules.test.js` cubre cada regla en su frontera (24 h, 2 h, 3 citas, 3 inasistencias, solapamiento, duración) y su violación; tests escritos antes de la implementación (ver tasks) | PASS |
| II. Validación en el borde | `src/web/validate.js` valida/normaliza cada formulario; contraseñas con `scrypt` + sal; cookies `HttpOnly` + `SameSite=Lax`; verificación de rol y de propiedad en cada acción; HTML escapado por defecto en plantillas | PASS |
| III. Accesibilidad básica | HTML semántico, `label` ligados, errores en texto junto al campo, tablas con `th`, contraste AA, funciona sin JavaScript; verificación de teclado en tasks (fase Polish) | PASS |
| IV. Simplicidad / mínimas dependencias | 0 dependencias de terceros; una base; sin framework; alcance limitado a la spec | PASS |
| V. Tiempo explícito | `src/domain/time.js` es el único módulo que lee el reloj; UTC en base, `CLINIC_TZ` para decisiones; reloj inyectable en servicios y planificador | PASS |
| VI. Notificaciones idempotentes | tabla `outbox` con `dedupe_key` única; encolado dentro de la transacción de la cita, entrega posterior y reintentable; fallo de entrega no afecta la cita | PASS |

**Re-evaluación post-diseño (Phase 1)**: sin violaciones; `Complexity Tracking` vacío. Riesgo anotado:
`node:sqlite` aún emite aviso de “experimental” en Node 24 (ver research.md, decisión 2).

## Project Structure

### Documentation (this feature)

```text
specs/001-reservas-turnoya/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── http-routes.md
│   └── notifications.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json                 # scripts: start, seed, test (sin dependencias)
src/
├── config.js                # CLINIC_TZ, PORT, DB_PATH, SESSION_TTL
├── main.js                  # arranque: DB + servidor + planificador
├── domain/                  # puro, sin I/O
│   ├── time.js              # reloj inyectable, conversión zona↔UTC, límites 2 h / 24 h
│   ├── rules.js             # validateBooking, canModify, overlap, activeCount, noShowLock
│   └── availability.js      # genera horarios libres (horario − bloqueos − feriados − citas)
├── db/
│   ├── db.js                # abre SQLite, migraciones, transacción inmediata
│   ├── schema.sql
│   └── seed.js              # datos de demo (médicos, especialidades, usuarios)
├── services/
│   ├── auth.js              # registro, login, sesiones, hash scrypt
│   ├── appointments.js      # reservar / reprogramar / cancelar / asistencia (orquesta dominio + DB)
│   ├── schedule.js          # agenda día/semana, bloqueos, feriados, horarios
│   ├── admin.js             # CRUD médicos, especialidades, horarios
│   ├── notifications.js     # outbox: encolar, entregar, reintentar
│   └── reminders.js         # tick: encola recordatorios 24 h antes
└── web/
    ├── server.js            # http.createServer + router + sesión + CSRF
    ├── router.js
    ├── validate.js          # validación/normalización de entradas
    ├── views/               # funciones de plantilla (layout, formularios, tablas)
    └── routes/              # patient.js, reception.js, doctor.js, admin.js, auth.js
tests/
├── unit/                    # rules, availability, time, validate
└── integration/             # flujos HTTP por historia de usuario
data/                        # (ignorado por git) base de datos y correos entregados
```

**Structure Decision**: un único proyecto Node con tres capas (dominio puro → servicios con
transacciones → web). El dominio no importa nada de `db/` ni de `web/`; esto es lo que permite
probar las reglas con un reloj falso (Principios I y V). No hay frontend separado porque las páginas
se renderizan en servidor y funcionan sin JavaScript (Principio III).

## Complexity Tracking

> Sin violaciones de la constitución; no se requiere justificación.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
