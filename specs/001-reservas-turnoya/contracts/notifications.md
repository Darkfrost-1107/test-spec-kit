# Contract: notificaciones por correo

Interfaz de entrega (reemplazable): `send({ to, subject, body }) → Promise<void>` (lanza si falla).
Adaptador v1: escribe `data/mails/<id>-<kind>.txt`.

| kind | Disparador | dedupe_key | Contenido mínimo |
|------|-----------|------------|------------------|
| `confirmation` | cita creada (paciente o recepción, si el paciente tiene correo) | `confirmation:<apptId>` | médico, especialidad, fecha y hora local de la clínica |
| `rescheduled` | cita reprogramada | `rescheduled:<apptId>:<nuevo starts_at>` | horario anterior y nuevo |
| `cancelled` | cita cancelada | `cancelled:<apptId>` | horario cancelado |
| `reminder` | `starts_at − 24 h ≤ ahora < starts_at`, estado `active`, `updated_at ≤ starts_at − 24 h` | `reminder:<apptId>:<starts_at>` | recordatorio con enlace a “Mis citas” |

Garantías: se encola en la misma transacción que el cambio de la cita; `dedupe_key` única ⇒ como
máximo un mensaje por evento; un fallo de entrega deja `status='failed'` (reintento hasta 5 veces)
y nunca revierte la cita. Los mensajes no incluyen contraseña ni datos clínicos.
