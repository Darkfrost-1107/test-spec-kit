# Problem Definition: Pérdida de solicitudes y fricción por cortes de conectividad

- **Slug**: offline-sync
- **Created**: 2026-10-29
- **Inputs used**: intake.md, research.md

## Problem Statement

Los pacientes que intentan programar o gestionar citas médicas en entornos con conectividad inestable o caídas repentinas de red sufren interrupciones y pérdida de datos en sus formularios, lo que provoca incertidumbre sobre si su solicitud fue procesada y genera reintentos redundantes o llamadas a la clínica.

## Affected Users & Stakeholders

- **Users**: 
  - Pacientes — Experimentan frustración y pérdida de tiempo al completarse formularios de reserva que no logran enviarse o cuyo estado queda indeterminado debido a fluctuaciones de conectividad móvil o Wi-Fi.
- **Stakeholders**:
  - Personal de recepción — Recibe llamadas o consultas adicionales de pacientes inseguros de haber concretado su turno.
  - Administración de la clínica — Interesada en evitar pérdidas de pacientes y mantener una tasa alta de conversión en el agendamiento digital, minimizando disputas por turnos superpuestos.

## Goals

- Evitar que los usuarios pierdan la información que ya completaron en la interfaz cuando la conexión a internet sufra interrupciones transitorias.
- Proveer a los usuarios certeza transparente y oportuna sobre el estado real de su solicitud de turno frente a fallas de comunicación con el servidor.

## Non-Goals

- Habilitar una experiencia offline integral para explorar catálogos médicos o navegar historiales completos sin acceso previo.
- Garantizar la adjudicación de un horario específico si otro paciente lo reservó de forma concurrente mientras el primero se encontraba desconectado.
- Reemplazar la atención telefónica o presencial de emergencia de la clínica.

## Success Metrics

- Reducción en la tasa de formularios de reserva abandonados o fallidos debido a errores de red transitorios (baseline: desconocido / sin telemetría actual).
- Disminución de llamadas a recepción originadas por dudas sobre si una reserva web se procesó tras un corte de señal (baseline: desconocido).

## Cost of Inaction

Si no se aborda el problema, los usuarios en zonas de baja cobertura continuarán experimentando la pantalla de error estándar del navegador al enviar el formulario; algunos reintentarán manualmente cuando recuperen señal, mientras que otros desistirán o llamarán a recepción para verificar el turno. No obstante, al tratarse de transacciones cortas (pocos clics), la gran mayoría de las reservas en condiciones normales no se ven afectadas.

## Open Questions

- [NEEDS CLARIFICATION: ¿Existe registro o quejas directas de pacientes de la clínica que señalen que la inestabilidad de red les impide agendar turnos hoy en día?]
- [NEEDS CLARIFICATION: ¿El dolor principal radica en tener que reescribir datos del formulario o en no saber si el turno quedó tomado?]
- [NEEDS CLARIFICATION: ¿Qué nivel de tolerancia tienen los pacientes y la clínica ante la eventualidad de que un turno solicitado en desconexión resulte no disponible al reanudar la comunicación?]
