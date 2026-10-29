# Contract: rutas HTTP (páginas renderizadas en servidor)

Convenciones: `GET` devuelve HTML; `POST` procesa formulario y responde `303` a la página
resultante, o `422` re-renderizando el formulario con errores junto a cada campo. Todo `POST`
exige campo oculto `csrf`. Sin sesión válida → `303 /login`. Rol insuficiente → `403`.
Fechas en formulario: `YYYY-MM-DD` en zona de la clínica; horarios reservables se envían como
instante UTC ISO (`starts_at`).

## Públicas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Redirige según rol (paciente → `/disponibilidad`, recepción → `/recepcion/agenda`, médico → `/medico/agenda`, admin → `/admin`) |
| GET/POST | `/registro` | Alta de paciente: `name`, `email`, `password` (FR-001) |
| GET/POST | `/login` | `email`, `password` |
| POST | `/logout` | Cierra sesión |

## Paciente (`patient`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/disponibilidad?especialidad=&medico=&fecha=` | Lista horarios libres (FR-002) |
| POST | `/citas` | `doctor_id`, `starts_at` → reserva (FR-003, 005, 006, 007) |
| GET | `/mis-citas` | Citas del paciente con acciones permitidas |
| GET | `/citas/:id/reprogramar?fecha=` | Horarios libres del mismo médico |
| POST | `/citas/:id/reprogramar` | `starts_at` (FR-008) |
| POST | `/citas/:id/cancelar` | (FR-008) |

## Recepción (`reception`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/recepcion/agenda?fecha=&vista=dia\|semana&medico=` | Agenda (FR-010) |
| GET/POST | `/recepcion/citas/nueva` | `patient_id` o datos de paciente nuevo, `doctor_id`, `starts_at` (FR-011, 022) |
| GET/POST | `/recepcion/citas/:id/editar` | Cambiar horario / cancelar |
| POST | `/recepcion/citas/:id/cancelar` | Cancela la cita sin la ventana de 24 h |
| POST | `/recepcion/citas/:id/asistencia` | `result=attended\|no_show` (FR-011, 021) |

## Médico (`doctor`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/medico/agenda?fecha=&vista=` | Solo sus citas (FR-010) |
| GET/POST | `/medico/bloqueos` | Listar y crear bloqueo (`date`, `start`, `end`, `reason`) (FR-013, 020) |
| POST | `/medico/bloqueos/:id/eliminar` | Elimina bloqueo propio |

## Administrador (`admin`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin` | Panel |
| GET/POST | `/admin/especialidades` | Crear (`name`, `duration_min` 30\|45) (FR-014); `POST …/:id/estado` activa/desactiva |
| GET/POST | `/admin/medicos` | Crear médico + cuenta de acceso; `POST …/:id/estado` activa/desactiva |
| POST | `/admin/medicos/:id/horarios` | Agregar franja (`weekday`, `start`, `end`); `…/horarios/:sid/eliminar` |
| GET/POST | `/admin/feriados` | Registrar/eliminar feriado (FR-019) |
| GET | `/admin/correos` | Bandeja de salida (outbox) para verificar notificaciones |

## Errores de negocio (mensajes visibles, español)
`SLOT_TAKEN`, `OVERLAP`, `TOO_SOON` (< 2 h), `LIMIT_REACHED` (3 citas), `ONLINE_LOCKED`
(3 inasistencias), `TOO_LATE_TO_CHANGE` (< 24 h), `BLOCK_CONFLICT`, `NOT_OWNER`. Cada uno se
muestra con texto claro y sin detalles internos.
