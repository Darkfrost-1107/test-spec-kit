# Bug Fix: Recalcular inasistencias consecutivas por orden cronológico

- **Slug**: no-show-lock-bypass
- **Fixed**: 2026-10-29
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Al marcar una asistencia, `consecutive_no_shows` ahora se recalcula desde el historial de citas
con resultado ordenado por fecha (más reciente primero), en lugar de incrementar o reiniciar un
contador según el orden en que recepción marca las citas. Así el bloqueo por inasistencias ya no
se puede eludir (ni provoca falsos bloqueos) marcando citas fuera de orden.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/services/appointments.js` | modified | `markAttendance()` recalcula el contador desde las citas `attended`/`no_show` del paciente, ordenadas por `starts_at DESC, id DESC`. |
| `src/domain/rules.js` | modified | Se reemplazó `applyAttendance()` por `consecutiveNoShows(results)`, función pura que cuenta la racha más reciente. |
| `tests/integration/reception.test.js` | added tests | Dos casos de orden de marcado: asistencia antigua después de inasistencias y viceversa. |
| `tests/unit/rules.test.js` | modified test | Se sustituyó la prueba de `applyAttendance` por la de `consecutiveNoShows`. |

## Diff Highlights (optional)

```js
const results = db.prepare(
  `SELECT status FROM appointments
    WHERE patient_id = ? AND status IN ('attended', 'no_show')
    ORDER BY starts_at DESC, id DESC`,
).all(appt.patient_id).map((a) => a.status);
db.prepare('UPDATE patients SET consecutive_no_shows = ? WHERE id = ?')
  .run(consecutiveNoShows(results), appt.patient_id);
```

```js
export function consecutiveNoShows(results) {
  let count = 0;
  for (const result of results) {
    if (result === 'no_show') count += 1;
    else if (result === 'attended') break;
  }
  return count;
}
```

## Tests Added or Updated

- `tests/unit/rules.test.js::consecutiveNoShows: cuenta solo la racha más reciente, de nueva a antigua` — fija la semántica de la racha y el caso vacío.
- `tests/integration/reception.test.js::marcar una asistencia antigua después de tres inasistencias no desbloquea al paciente` — reproduce el bypass original y exige que siga bloqueado.
- `tests/integration/reception.test.js::marcar tres inasistencias antiguas después de una asistencia reciente no bloquea al paciente` — cubre el error inverso (falso bloqueo) por el mismo orden de marcado.

## Local Verification

- Commands run: `npm test` → 106 tests, 106 pass, 0 fail.
- Commands run: `node --disable-warning=ExperimentalWarning --test tests/integration/reception.test.js` → 9 tests, 9 pass, 0 fail.
- Manual checks: none in browser; las pruebas de integración levantan la app real sobre SQLite en memoria y ejercitan las rutas HTTP de recepción y reserva del paciente.

## Deviations from Assessment

Ninguna. Se retiró `applyAttendance` en lugar de mantenerla, opción prevista por el assessment al quedar sin uso; la lógica se sustituyó por `consecutiveNoShows`.

## Follow-ups

- Si existían bases con contadores ya desincronizados, ejecutar un recálculo único de `patients.consecutive_no_shows` desde el historial; la demo se regenera con `npm run seed`.
- Revisar por separado el diff masivo preexistente por finales de línea (CRLF vs LF) en el árbol de trabajo antes de commitear; no forma parte de este fix.
