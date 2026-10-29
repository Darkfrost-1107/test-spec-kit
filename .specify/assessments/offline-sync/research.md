# Idea Research: Sincronización en segundo plano al recuperar conexión

- **Slug**: offline-sync
- **Created**: 2026-10-29
- **Evidence confidence (overall)**: medium

## Users & Demand

- Usuarios con conexiones inestables o intermitentes (ej. datos móviles en salas de espera o transporte) podrían perder datos de formularios al intentar reservar citas si la conexión cae antes de enviar el formulario — [ASSUMPTION] (confidence: low)
- No existen reportes de usuarios, tickets de soporte ni métricas en el sistema actual que señalen que la falta de sincronización offline sea un obstáculo activo para la adopción de TurnoYa — [source: specs/001-reservas-turnoya/spec.md] (confidence: high)

## Prior Art

- **Web Background Synchronization API (WICG/W3C)** — Especificación para diferir tareas en Service Workers hasta tener conectividad estable. Sin embargo, su soporte está fragmentado: navegadores basados en Chromium lo implementan, pero Safari (WebKit en iOS y macOS) y Firefox no ofrecen soporte para `SyncManager` ni eventos `sync` — [source: https://github.com/WICG/background-sync]
- **Arquitectura TurnoYa (v1)** — La aplicación actual es 100% Server-Side Rendered (SSR) sin scripts en el cliente, con renderizado directo de plantillas HTML y transacciones síncronas en SQLite (`BEGIN IMMEDIATE`) — [source: src/web/server.js, src/services/appointments.js]

## Market & Context

- En servicios de reservas y agendamiento médico (ej. Zocdoc, Doctoralia), el flujo es predominantemente síncrono y en tiempo real debido a que los horarios son recursos compartidos altamente perecederos; los sistemas estándar informan errores de red de inmediato en vez de encolar reservas en segundo plano — [ASSUMPTION] (confidence: medium)
- El costo de no implementar sincronización offline es bajo si las transacciones de reserva toman pocos segundos y se realizan en entornos urbanos con cobertura habitual — [ASSUMPTION] (confidence: medium)

## Data & Constraints

- **Limitaciones de plataforma en navegadores web**: En iOS Safari, al no existir soporte para Background Sync API, cualquier mecanismo en segundo plano requiere que la pestaña permanezca abierta o el uso de polling activo cuando el usuario regrese a la app — [source: https://github.com/WICG/background-sync]
- **Política de Seguridad de Contenido (CSP) y arquitectura sin JS**: La CSP actual (`src/web/server.js`) define `default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'` y no cuenta con `script-src` ni despacha scripts del lado del cliente. Habilitar sincronización en segundo plano exigiría introducir JavaScript del cliente, registro de Service Worker y almacenamiento local (IndexedDB) — [source: src/web/server.js]
- **Restricciones transaccionales de negocio**: Las reservas requieren validaciones críticas en tiempo de ejecución (anticipación mínima de 2 horas, máximo 3 citas activas por paciente, bloqueos médicos concurrentes). Una reserva sincronizada en diferido tras minutos u horas tiene una alta tasa esperada de rechazo — [source: specs/001-reservas-turnoya/spec.md]

## Evidence Against the Idea

- **Riesgo crítico de colisiones y reservas obsoletas**: A diferencia de aplicaciones de mensajería o notas, los turnos médicos son exclusivos. Si un paciente guarda una reserva localmente sin conexión y se sincroniza más tarde, es muy probable que otro usuario en línea haya ocupado el horario o que el médico haya cargado un bloqueo, provocando que la cita falle de manera asíncrona cuando el paciente creía tenerla asegurada — [source: specs/001-reservas-turnoya/spec.md]
- **Aumento exponencial de complejidad para una clínica pequeña**: Incorporar capacidades offline requiere transformar la arquitectura SSR minimalista en una Progressive Web App (PWA) con Service Workers, colas de mutaciones persistentes, conciliación de estados y una interfaz de usuario compleja para gestionar fallos y conflictos diferidos — [source: src/web/server.js]
- **Mala experiencia de usuario (UX) para confirmaciones médicas**: Un paciente necesita certeza inmediata de su turno médico (confirmación y correo) para planificar su agenda médica; una sincronización silenciosa en segundo plano crea incertidumbre sobre si la cita fue aceptada o rechazada — [ASSUMPTION] (confidence: high)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: ¿El requerimiento proviene de un rol específico, como médicos/recepcionistas en zonas con Wi-Fi deficiente, o de pacientes externos reservando?]
- [NEEDS CLARIFICATION: Si una sincronización en segundo plano falla porque el turno ya no está libre o no cumple las 2 horas de anticipación, ¿cómo se notifica y gestiona la alternativa con el usuario si la pestaña ya fue cerrada?]
- [NEEDS CLARIFICATION: ¿Justifica el valor de negocio de una clínica pequeña el costo arquitectónico de migrar a una arquitectura cliente PWA/Service Worker?]

## Sources

- https://github.com/WICG/background-sync (host: github.com, policy: allowlisted)
- src/web/server.js (host: local repository)
- src/services/appointments.js (host: local repository)
- specs/001-reservas-turnoya/spec.md (host: local repository)
