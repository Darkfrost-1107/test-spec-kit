# Bug Assessment: El bloqueo por inasistencias se puede eludir marcando tarde una asistencia antigua

- **Slug**: no-show-lock-bypass
- **Created**: 2026-10-29
- **Source**: pasted text (reporte del tester)
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

Reporte del tester (resumen):

> Ejecuté `npm run seed` y `npm start`, entré a http://localhost:3000 con las cuentas demo
> del README y probé el flujo de asistencia de recepción. Simulé historial pasado del
> paciente demo (`Paciente de Prueba`, `paciente@turnoya.test`): una cita el martes
> 2026-10-20 que terminó en "asistió" y tres citas el miércoles, jueves y viernes
> (2026-10-21, 22 y 23) marcadas "no asistió". Como recepción marqué primero las tres
> inasistencias y después la asistencia antigua del martes. Esperaba que el paciente
> quedara bloqueado para reservar en línea, porque sus últimas tres citas con resultado
> son las tres inasistencias. En su lugar el contador volvió a 0 y el paciente pudo
> reservar en línea para el 2026-11-09: la aplicación respondió "Cita reservada".
> El contador depende del orden en que recepción marca las citas, no del orden
> cronológico de las citas.

## Symptom

Con tres inasistencias consecutivas ya registradas, marcar después una asistencia
correspondiente a una cita **anterior** reinicia el contador a 0 y permite que el paciente
vuelva a reservar en línea. Se esperaba que el bloqueo por inasistencias continuara vigente
(FR-012, FR-021) porque las tres citas más recientes con resultado son "no asistió".

## Reproduction

1. Preparar la demo: `npm run seed` y `npm start` (http://localhost:3000).
2. Crear historial pasado para `patient_id=1` (Paciente de Prueba) con el médico 1. Como la
   interfaz no permite crear citas en el pasado, se insertaron cuatro citas pasadas activas:
   martes 2026-10-20 (se marcará "asistió") y miércoles/jueves/viernes 2026-10-21/22/23
   (se marcarán "no asistió").
3. Entrar como `recepcion@turnoya.test` / `Recep1234`.
4. Marcar asistencia en este orden: primero las tres citas de miércoles, jueves y viernes
   como `no_show`; después la cita del martes como `attended`.
5. Comprobar el paciente: `consecutive_no_shows = 0` aunque las últimas tres citas por fecha
   son tres inasistencias.
6. Entrar como `paciente@turnoya.test` / `Paciente1234`, buscar disponibilidad para
   `2026-11-09` con el médico 1 y reservar el primer horario.
7. Resultado observado: "Cita reservada. Te enviamos un correo de confirmación."
   Resultado esperado: rechazo por `ONLINE_LOCKED` ("Tu reserva en línea está bloqueada por
   inasistencias...").

## Suspected Code Paths

- `src/services/appointments.js:186-187` — `markAttendance()` actualiza
  `patients.consecutive_no_shows` con `applyAttendance(p.n, result)` usando solo el valor
  actual y el resultado de la cita que se está marcando; no reconstruye el conteo desde el
  historial.
- `src/domain/rules.js:37-39` — `applyAttendance()` reinicia a 0 ante cualquier `attended`,
  sin importar si esa cita es más antigua que las inasistencias ya contadas.
- `src/domain/rules.js:31-33` y `src/domain/rules.js:52` — `isOnlineBookingLocked()` y
  `validateBooking()` confían en el contador almacenado, por lo que heredan el valor
  incorrecto.
- `src/web/routes/reception.js:64-66` — el endpoint de asistencia permite marcar citas en
  cualquier orden, condición que expone el defecto.
- `src/db/schema.sql:30` — el conteo se guarda denormalizado en `patients.consecutive_no_shows`.

## Root Cause Hypothesis

Confianza: **alta**. La implementación modela "inasistencias consecutivas" como un contador
incremental que refleja el **orden de marcado** en recepción, no el **orden cronológico de las
citas**. Al marcar una asistencia antigua después de inasistencias más recientes, el contador
se reinicia a 0 aunque esa asistencia no interrumpe la racha de inasistencias de las últimas
citas. El mismo defecto puede producir el error inverso (bloquear a un paciente que no debería
estarlo) si se marca una inasistencia antigua después de una asistencia más reciente.

## Proposed Remediation

**Preferred**: Recalcular `consecutive_no_shows` desde el historial cada vez que se marca una
asistencia. Dentro de la transacción de `markAttendance()`, tras actualizar el estado de la
cita, consultar las citas del paciente con resultado (`status IN ('attended','no_show')`)
ordenadas por `starts_at DESC, id DESC` y contar las `no_show` iniciales hasta la primera
`attended`; guardar ese valor en `patients.consecutive_no_shows`. Extraer el cálculo como
función pura en `src/domain/rules.js` para mantenerlo testeable sin base de datos.

**Alternatives** (optional):

- No almacenar el contador y derivarlo en `validateBooking()` desde las últimas citas con
  resultado. Elimina la desincronización, a costa de una consulta adicional por reserva y de
  cambiar la firma/uso de `validateBooking()`.
- Mantener un log de eventos de asistencia y calcular la racha con una consulta agregada.
  Más auditable, pero agrega una tabla y complejidad no justificada para v1.

**Files likely to change**:

- `src/services/appointments.js` — recalcular el contador después de marcar la cita.
- `src/domain/rules.js` — función pura para calcular inasistencias consecutivas desde el
  historial (y ajustar/retirar `applyAttendance` si deja de usarse).
- `tests/integration/reception.test.js` — casos de orden de marcado.
- Posiblemente un script/migración de una sola vez para recalcular contadores existentes.

**Tests to add or update**:

- Marcar tres `no_show` recientes y luego un `attended` antiguo: el paciente sigue bloqueado
  y la reserva en línea se rechaza con `ONLINE_LOCKED`.
- Marcar un `attended` antiguo y luego tres `no_show` recientes: el paciente queda bloqueado.
- Marcar un `no_show` antiguo después de un `attended` reciente: no se bloquea.
- Historial mixto: solo cuentan las citas con resultado posteriores a la última asistencia.
- Mantener la exención de recepción (FR-022) y que una asistencia marcada en orden normal
  siga reiniciando el conteo.

## Risks & Considerations

- La corrección cambia el significado del contador almacenado; las bases existentes pueden
  tener valores incorrectos y requerir un recálculo único al desplegar.
- Hay que definir un desempate estable si dos citas comparten `starts_at` (usar `id`).
- Las cancelaciones no deben entrar en el cálculo (no tienen resultado), conforme a FR-021.
- Impacto de rendimiento bajo: la consulta es por paciente y el histórico de v1 es pequeño.
- No cambia rutas ni contratos HTTP; no hay riesgo de ruptura de API.
- Conviene registrar/loguear el conteo recalculado solo para diagnóstico, sin datos
  personales, si se agrega observabilidad.

## Open Questions

- Ninguna bloqueante: FR-021 y la clarificación del 2026-10-29 definen que cuentan las
  últimas citas con resultado, una asistencia reinicia el conteo y las cancelaciones no
  cuentan.
