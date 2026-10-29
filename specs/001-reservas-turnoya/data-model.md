# Data Model: TurnoYa v1

Todos los instantes (`*_at`) se guardan como texto ISO-8601 UTC (`2026-11-02T15:00:00.000Z`).
Horarios de atención y feriados se guardan en hora local de la clínica (`HH:MM`, `YYYY-MM-DD`).

## Entidades

### users
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | integer PK | |
| email | text | único, minúsculas, formato válido |
| password_hash | text | `scrypt$<sal>$<hash>`; nunca se muestra |
| name | text | 2–80 caracteres |
| role | text | `patient` \| `reception` \| `doctor` \| `admin` |
| doctor_id | integer FK null | obligatorio si `role='doctor'` |

### patients
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | integer PK | |
| user_id | integer FK null | null = paciente atendido solo por teléfono |
| name | text | 2–80 |
| email | text null | necesario para recibir correos |
| phone | text null | 6–20 dígitos/signos |
| consecutive_no_shows | integer | ≥ 0; `≥ 3` ⇒ bloqueo de reserva en línea (FR-012) |

### specialties
`id`, `name` (único), `duration_min` (30 o 45), `active` (0/1).

### doctors
`id`, `name`, `specialty_id` FK, `active` (0/1).

### work_schedules
`id`, `doctor_id` FK, `weekday` (0=domingo … 6=sábado), `start_time` `HH:MM`, `end_time` `HH:MM`
(`start_time < end_time`). Un médico puede tener varias franjas por día; no se solapan entre sí.

### holidays
`date` PK (`YYYY-MM-DD`), `name`. En esa fecha no hay disponibilidad (FR-019).

### blocks
`id`, `doctor_id` FK, `starts_at`, `ends_at` (UTC, `starts_at < ends_at`), `reason` (≤ 120).
Regla: no se puede crear si solapa citas activas del médico (FR-020).

### appointments
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | integer PK | |
| patient_id | integer FK | |
| doctor_id | integer FK | |
| starts_at / ends_at | text UTC | `ends_at = starts_at + duration_min` de la especialidad del médico |
| status | text | `active` \| `cancelled` \| `attended` \| `no_show` |
| created_by | text | `patient` \| `reception` |
| created_at | text UTC | usado para decidir si corresponde recordatorio |
| updated_at | text UTC | |

Índices: `UNIQUE(doctor_id, starts_at) WHERE status='active'`; `INDEX(patient_id, status)`;
`INDEX(doctor_id, starts_at)`.

### outbox
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | integer PK | |
| appointment_id | integer FK null | |
| kind | text | `confirmation` \| `rescheduled` \| `cancelled` \| `reminder` |
| dedupe_key | text UNIQUE | p. ej. `reminder:12:2026-11-02T15:00:00.000Z` |
| to_email | text | |
| subject / body | text | sin datos sensibles adicionales |
| status | text | `pending` \| `sent` \| `failed` |
| attempts | integer | máx. 5 |
| created_at / sent_at | text UTC | |

### sessions
`token` PK (aleatorio 32 bytes hex), `user_id` FK, `csrf` (aleatorio), `expires_at`.

## Reglas de validación (ligadas a la spec)

| Regla | FR | Dónde se evalúa |
|-------|----|-----------------|
| Duración 30/45 según especialidad | FR-004 | `availability.js`, `appointments.js` |
| Sin solapamiento por médico | FR-005 | `rules.hasOverlap` + transacción + índice único |
| ≤ 3 citas activas por paciente (en línea) | FR-006 | `rules.activeCountAllows` |
| Anticipación ≥ 2 h inclusiva (en línea) | FR-007, FR-024 | `rules.hasMinNotice` |
| Reprogramar/cancelar hasta 24 h inclusivo | FR-008, FR-024 | `rules.canModify` |
| 3 inasistencias consecutivas bloquean en línea | FR-012, FR-021 | `rules.isOnlineBookingLocked` |
| Sin solapamiento por paciente | FR-023 | `rules.patientHasOverlap` |
| Recepción exenta de 3 citas / 2 h / bloqueo | FR-022 | parámetro `actor` en `validateBooking` |
| Bloqueo rechazado con citas en conflicto | FR-020 | `schedule.createBlock` |

## Transiciones de estado de una cita

```text
            reservar
(nada) ───────────────▶ active ──cancelar (≥24 h)──▶ cancelled
                          │  ▲
        reprogramar(≥24h) │  │ (misma cita, nuevo horario; encola 'rescheduled')
                          ▼  │
                         active
                          │
        recepción marca   ├──────▶ attended   (consecutive_no_shows = 0)
        (cita ya iniciada)└──────▶ no_show    (consecutive_no_shows += 1)
```

`cancelled`, `attended` y `no_show` son terminales. Una cita `active` cuyo horario pasó sigue
`active` hasta que recepción la marque (aparece como “pendiente de marcar” en la agenda).
