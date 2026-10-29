# Concept: Manejo de conectividad intermitente en reservas

- **Slug**: offline-sync
- **Created**: 2026-10-29
- **Recommended option**: Option A — Preservación local de formulario con reintento asistido

## Options

### Option A — Preservación local de formulario con reintento asistido
- **Sketch**: El formulario de reserva detecta pérdidas momentáneas de conectividad en el navegador del paciente y preserva en memoria/sesión del cliente los datos seleccionados (médico, fecha, horario). Al restablecerse la señal, la interfaz muestra de forma visible el estado de reconexión y habilita un botón claro de "Reintentar confirmación", validando de inmediato la disponibilidad del turno ante el servidor antes de comprometerlo.
- **Appetite**: small (días)
- **Trade-offs**: 
  - *Gana*: Elimina la pérdida de datos y la frustración del paciente sin alterar la arquitectura central del servidor; funciona de manera homogénea en todos los navegadores (incluyendo Safari en iOS); mantiene al paciente en control y consciente del resultado exacto de su cita.
  - *Sacrifica*: Requiere que el paciente conserve la pestaña abierta hasta recuperar señal (no ejecuta envíos ocultos si el navegador se cierra).
- **Rabbit holes**: Intentar convertir el almacenamiento local en una base de datos offline completa; almacenar información clínica o credenciales en almacenamiento no protegido.

### Option B — PWA completa con sincronización autónoma en segundo plano (Background Sync)
- **Sketch**: Transformar la aplicación en una Progressive Web App (PWA) instalable que registre un Service Worker, intercepte solicitudes de reserva, las encole en IndexedDB y utilice la Background Sync API para enviarlas automáticamente al servidor cuando el sistema operativo detecte conectividad, notificando el resultado con avisos diferidos.
- **Appetite**: large (meses)
- **Trade-offs**:
  - *Gana*: Cumple con el concepto original de sincronización en segundo plano sin requerir atención activa del paciente tras enviar.
  - *Sacrifica*: Incompatibilidad crítica en Safari/iOS y Firefox (la Background Sync API no existe en WebKit); tasa elevada de rechazos de citas porque los turnos son perecederos y pueden ser reservados por otros usuarios en línea mientras el dispositivo estuvo desconectado; complejiza drásticamente la base de código SSR minimalista.
- **Rabbit holes**: Conciliación asíncrona de conflictos si el turno fue tomado mientras el usuario estaba offline; gestión de notificaciones de error a usuarios que ya cerraron la app; reescritura de la política CSP y arquitectura de cliente.

### Option C — Mantener flujo síncrono puro (No construir / Status Quo)
- **Sketch**: Mantener la aplicación estrictamente como un sistema SSR síncrono. Ante una falla de red, el navegador muestra su pantalla de desconexión por defecto y el paciente debe refrescar o volver a ingresar cuando disponga de conexión estable, confiando en los canales telefónicos habituales de la clínica para contingencias.
- **Appetite**: small (cero desarrollo)
- **Trade-offs**:
  - *Gana*: Cero deuda técnica, cero complejidad y cero riesgo de inconsistencias o reservas fantasma.
  - *Sacrifica*: No resuelve la pérdida de datos del paciente en entornos de conectividad inestable.
- **Rabbit holes**: Ninguno.

## Recommendation

Se recomienda **Option A (Preservación local de formulario con reintento asistido)** y se descarta categóricamente Option B (sincronización en segundo plano autónoma). 

*Justificación*: La idea original de sincronizar citas en segundo plano autónomamente no es viable técnicamente para un público general debido a la falta de soporte de la Background Sync API en dispositivos Apple (iOS Safari), sumado al alto riesgo de que el turno médico ya esté ocupado al momento del envío diferido. La Opción A cumple con los objetivos de evitar la pérdida de datos y brindar retroalimentación oportuna, con un apetito pequeño (`small`) y sin desestabilizar la arquitectura de TurnoYa.

## Out of Scope (for the recommended option)

- Sincronización autónoma en segundo plano cuando la pestaña o el navegador se encuentren cerrados.
- Navegación offline del historial de citas o de los horarios disponibles sin conexión previa.
- Adjudicación o reserva garantizada de un horario si existió conflicto concurrente en el servidor.
- Modificación del esquema de base de datos o lógica transaccional de citas en el backend.

## Assumptions to Validate

- La mayoría de las interrupciones de red que experimentan los pacientes son de corta duración (segundos o minutos).
- Los pacientes prefieren verificar y confirmar explícitamente su horario en tiempo real al volver la conexión, en vez de confiar en una sincronización diferida no determinista.
- Es admisible dentro de los estándares del proyecto incorporar un script mínimo en el frontend dentro de la CSP para gestionar la detección de red y reintento.
