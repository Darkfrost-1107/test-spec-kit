# Capturas del proceso SDD – TurnoYa v1

Evidencia del flujo completo de Spec Kit (`speckit-constitution → specify → clarify → plan → tasks → implement`).

**Cómo se generaron**: cada comando se ejecutó de verdad en PowerShell y su salida (o el archivo resultante)
se renderizó como ventana de terminal y se fotografió con Edge headless
([`_tools/capture.mjs`](_tools/capture.mjs), [`_tools/run-and-capture.sh`](_tools/run-and-capture.sh)).
Las capturas de `07-app-v1` son capturas reales del navegador sobre la aplicación en marcha
([`_tools/ui-capture.mjs`](_tools/ui-capture.mjs)). No son capturas del escritorio ni de la interfaz del IDE.

| Carpeta | Fase | Qué muestran |
|---------|------|--------------|
| `00-setup` | Inicio | Archivos de spec-kit 1.2.5 (integración `agy`, scripts PowerShell) |
| `01-constitution` | `/speckit-constitution` | Resolución de plantilla y constitución v1.0.0 (6 principios) |
| `02-specify` | `/speckit-specify` | Creación de la feature `001-reservas-turnoya`, historias P1–P3, requisitos y checklist de calidad |
| `03-clarify` | `/speckit-clarify` | 5 preguntas (zona horaria, feriados, bloqueos, inasistencias, exenciones de recepción) y su integración en `spec.md` |
| `04-plan` | `/speckit-plan` | Technical Context, Constitution Check, research, data-model, contracts y quickstart |
| `05-tasks` | `/speckit-tasks` | 49 tareas por historia de usuario con validación de formato |
| `06-implement` | `/speckit-implement` | Gate de checklists, TDD rojo → verde, suite completa (104 pruebas) y prueba de mutación |
| `07-app-v1` | Resultado | La aplicación: paciente, recepción, médico, administración y vista móvil |
| `08-cierre` | Cierre | 49/49 tareas completadas y arranque rápido (`npm run seed`) |

Notas de honestidad:

- Las respuestas de `/speckit-clarify` las eligió el asistente aceptando la opción recomendada (pediste ejecutar el
  proceso de forma autónoma); el registro de la sesión está en `specs/001-reservas-turnoya/clarify-session.md`.
- El envío de correo es simulado (archivos en `data/mails/` y bandeja `/admin/correos`).
