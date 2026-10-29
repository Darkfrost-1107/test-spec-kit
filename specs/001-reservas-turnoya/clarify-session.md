# Sesión /speckit-clarify — 2026-10-29

> Las respuestas fueron elegidas aceptando la opción **Recomendada** de cada pregunta
> (el usuario pidió ejecutar el flujo SDD de forma autónoma). Cada respuesta se integró en
> `spec.md` (sección `## Clarifications` y requisitos afectados).

## Pregunta 1 de 5

**Question:** ¿En qué zona horaria se muestran y se evalúan todas las horas (reglas de 2 h / 24 h,
recordatorios, agenda del día)?
*Why it matters:* si se evalúa en la zona del dispositivo del paciente, el mismo horario tendría
límites distintos para cada persona y las reglas de 24 h serían inconsistentes.

**Recommended:** Option A - una sola zona horaria de la clínica evita ambigüedades en las reglas.

| Option | Description |
|--------|-------------|
| A | Una zona horaria única, configurada para la clínica; todo se muestra y evalúa en ella |
| B | La zona horaria del dispositivo de cada usuario |
| C | Zona de la clínica para reglas, pero mostrar hora local del paciente además |

**Respuesta: A**

## Pregunta 2 de 5

**Question:** ¿Qué ocurre con los días feriados: la clínica puede marcarlos como no laborables?
*Why it matters:* sin esto se ofrecerían citas en días en que la clínica está cerrada.

**Recommended:** Option A - un calendario simple de feriados administrado por el administrador.

| Option | Description |
|--------|-------------|
| A | El administrador registra feriados (fecha + nombre); ese día no se ofrece disponibilidad para ningún médico |
| B | No se modelan feriados; cada médico los bloquea manualmente |
| C | Integración con un calendario oficial de feriados |

**Respuesta: A**

## Pregunta 3 de 5

**Question:** ¿Qué debe pasar cuando un médico intenta bloquear un rango que contiene citas activas?
*Why it matters:* cancelar citas sin aviso perjudica al paciente; ignorarlas deja al médico con
citas en horario bloqueado.

**Recommended:** Option A - protege al paciente y deja la decisión a recepción, que puede reprogramar.

| Option | Description |
|--------|-------------|
| A | El bloqueo se rechaza y se listan las citas en conflicto; recepción las reprograma/cancela primero |
| B | Las citas en conflicto se cancelan automáticamente y se notifica al paciente |
| C | El bloqueo se crea y las citas existentes se conservan (solo bloquea horarios libres) |

**Respuesta: A**

## Pregunta 4 de 5

**Question:** ¿Cómo se cuentan las "tres inasistencias consecutivas" y cómo se levanta el bloqueo
de la reserva en línea?
*Why it matters:* define cuándo un paciente queda bloqueado y si puede recuperar la reserva en línea.

**Recommended:** Option A - regla simple y verificable sobre el historial de resultados.

| Option | Description |
|--------|-------------|
| A | Consecutivas = las últimas 3 citas con resultado marcado son "no asistió"; una cita "asistió" reinicia el conteo a 0, y el paciente bloqueado puede asistir a citas agendadas por recepción, lo que lo desbloquea al asistir. Las cancelaciones no cuentan |
| B | Igual que A, pero el bloqueo solo lo levanta manualmente el administrador |
| C | Igual que A, pero el conteo se reinicia automáticamente tras 90 días |

**Respuesta: A**

## Pregunta 5 de 5

**Question:** ¿Recepción está sujeta al límite de 3 citas activas y a la anticipación mínima de 2 horas
cuando agenda en nombre de un paciente?
*Why it matters:* recepción atiende casos del mismo día y pacientes bloqueados; si aplican todos los
límites no podrá resolver esos casos.

**Recommended:** Option A - mantiene la integridad de la agenda sin impedir la atención del mismo día.

| Option | Description |
|--------|-------------|
| A | Recepción está sujeta a duración y no-solapamiento, pero exenta del límite de 3 citas, de las 2 h de anticipación y del bloqueo por inasistencias |
| B | Recepción está sujeta a todas las reglas excepto el bloqueo por inasistencias |
| C | Recepción está sujeta a todas las reglas sin excepción |

**Respuesta: A**

## Resultado

5 preguntas formuladas, 5 resueltas. Cobertura tras la sesión: alcance y roles (Clear), modelo de
dominio (Clear), flujos de interacción (Clear), no funcionales (Partial: se resuelve en plan),
integraciones y fallos de correo (Partial: se resuelve en plan con outbox), casos borde (Clear).
Pendiente informado como supuesto: una cita reservada con menos de 24 h de anticipación no recibe
recordatorio (solo confirmación).
