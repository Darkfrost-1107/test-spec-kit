# Decision: Sincronización en segundo plano al recuperar conexión

- **Slug**: offline-sync
- **Decided**: 2026-10-29
- **Verdict**: kill
- **Artifacts reviewed**: intake.md, research.md, problem.md, concept.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | weak | No existe evidencia de que los pacientes de la clínica pierdan citas por caídas de red durante una interacción que toma menos de un minuto. |
| Evidence strength | weak | Demanda puramente asumida; no hay registros de soporte, tickets ni quejas registradas en TurnoYa. |
| Value vs. inaction | weak | El costo de no construir es insignificante; los canales telefónicos y el reintento manual inmediato cubren la necesidad sin costo técnico. |
| Feasibility / appetite | weak | La Background Sync API carece de soporte en Safari (iOS/macOS), dejando fuera a la mayoría de los usuarios móviles, y el inventario perecedero de turnos genera colisiones críticas. |
| Strategic fit | weak | Rompe con el principio de simplicidad arquitectónica SSR de TurnoYa, forzando la introducción de Service Workers, almacenamiento en cliente y conciliación asíncrona. |
| Risk posture | weak | Riesgo severo de experiencia de usuario: confirmar citas en diferido genera altas probabilidades de que el turno ya esté ocupado o fuera de la ventana de anticipación. |

## Verdict & Rationale

**Veredicto: KILL (Descartar)**.

La iniciativa de sincronizar citas en segundo plano se descarta formalmente por inviabilidad técnica, incompatibilidad con el modelo de negocio de turnos médicos y ausencia total de demanda comprobada:

1. **Incompatibilidad de plataforma crítica**: Apple WebKit (Safari en iOS y macOS) no implementa la Background Sync API. Construir una solución basada en Service Workers no funcionaría en los dispositivos móviles más utilizados por los pacientes.
2. **Conflicto inherente al dominio de reservas**: A diferencia de mensajes o correos, los turnos médicos son recursos exclusivos con inventario unitario y restricciones temporales estrictas (ej. anticipación mínima de 2 horas). Sincronizar solicitudes minutos u horas después tiene una tasa de colisión o rechazo inaceptable, provocando que el paciente crea erróneamente tener una cita confirmada.
3. **Desproporción costo-beneficio**: TurnoYa es una aplicación SSR minimalista y determinista. La complejidad técnica de implementar y mantener una arquitectura offline-first excede con creces cualquier beneficio marginal para una clínica pequeña.
