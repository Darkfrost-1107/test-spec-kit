# Feature Specification: TurnoYa – Reservas en línea para una clínica pequeña

**Feature Branch**: `001-reservas-turnoya`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Aplicación web para que los pacientes de una clínica médica pequeña reserven citas en línea. Hoy todo se gestiona por teléfono y WhatsApp, lo que genera citas duplicadas, olvidos y llamadas perdidas. Usuarios: paciente, recepcionista, médico, administrador."

## Clarifications

### Session 2026-10-29

- Q: ¿En qué zona horaria se muestran y evalúan las horas? → A: Una zona horaria única, configurada para la clínica; todo se muestra y evalúa en ella.
- Q: ¿Qué ocurre con los días feriados? → A: El administrador registra feriados (fecha + nombre); ese día no se ofrece disponibilidad para ningún médico.
- Q: ¿Qué pasa si un médico bloquea un rango con citas activas? → A: El bloqueo se rechaza y se listan las citas en conflicto; recepción las reprograma/cancela primero.
- Q: ¿Cómo se cuentan las tres inasistencias consecutivas y cómo se levanta el bloqueo? → A: Consecutivas = las últimas 3 citas con resultado marcado son "no asistió"; una "asistió" reinicia el conteo a 0; las cancelaciones no cuentan; el paciente bloqueado puede asistir a citas agendadas por recepción y al asistir se desbloquea.
- Q: ¿Recepción está sujeta al límite de 3 citas y a las 2 h de anticipación? → A: Recepción está sujeta a duración y no-solapamiento, pero exenta del límite de 3 citas, de las 2 h de anticipación y del bloqueo por inasistencias.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paciente reserva una cita en línea (Priority: P1)

Un paciente se registra con correo y contraseña, inicia sesión, busca disponibilidad filtrando por
especialidad, médico y fecha, elige un horario libre y reserva. Recibe un correo de confirmación
con médico, especialidad, fecha y hora.

**Why this priority**: es el núcleo del producto. Sin reserva en línea no se reducen las llamadas
ni las citas duplicadas. Por sí sola ya entrega valor (MVP).

**Independent Test**: registrar un paciente, buscar horarios de un médico de prueba, reservar uno y
comprobar que la cita aparece en "Mis citas", que el horario deja de estar disponible y que se
generó el correo de confirmación.

**Acceptance Scenarios**:

1. **Given** un visitante sin cuenta, **When** se registra con un correo válido y una contraseña
   que cumple los requisitos, **Then** puede iniciar sesión; con un correo ya registrado el sistema
   rechaza el registro con un mensaje claro.
2. **Given** un paciente con sesión iniciada, **When** busca por especialidad, médico y fecha,
   **Then** ve solo los horarios libres, cuya duración corresponde a la especialidad
   (30 min consulta general, 45 min especialidades).
3. **Given** un horario libre con más de 2 horas de anticipación, **When** el paciente lo reserva,
   **Then** la cita queda confirmada, el horario deja de ofrecerse y se envía el correo de
   confirmación.
4. **Given** un horario que empieza en menos de 2 horas, **When** el paciente intenta reservarlo,
   **Then** el sistema lo rechaza indicando el motivo.
5. **Given** un paciente que ya tiene 3 citas activas, **When** intenta reservar una cuarta,
   **Then** el sistema lo rechaza indicando el límite.
6. **Given** dos pacientes que intentan reservar el mismo horario casi al mismo tiempo, **When** ambos
   confirman, **Then** solo uno obtiene la cita y el otro recibe un aviso para elegir otro horario.

---

### User Story 2 - Paciente reprograma y cancela; recordatorio automático (Priority: P2)

El paciente puede cambiar la fecha/hora o cancelar una cita propia hasta 24 horas antes. Además,
24 horas antes de cada cita recibe un recordatorio por correo.

**Why this priority**: reduce olvidos e inasistencias, el segundo gran dolor del proceso actual,
y libera horarios cuando el paciente no va a asistir.

**Independent Test**: con una cita existente, reprogramarla a otro horario libre (el horario
original vuelve a quedar libre), cancelar otra, y verificar que una cita a 24 h genera un único
recordatorio.

**Acceptance Scenarios**:

1. **Given** una cita a más de 24 horas, **When** el paciente la reprograma a un horario libre
   válido, **Then** la cita conserva su identidad con la nueva fecha/hora, el horario anterior
   queda libre y se avisa por correo.
2. **Given** una cita a menos de 24 horas, **When** el paciente intenta reprogramar o cancelar,
   **Then** el sistema lo impide e indica que debe contactar a la clínica.
3. **Given** una cita a más de 24 horas, **When** el paciente la cancela, **Then** queda cancelada,
   el horario vuelve a estar disponible y deja de contar para el límite de 3 citas activas.
4. **Given** una cita confirmada, **When** faltan 24 horas para su inicio, **Then** el paciente
   recibe un recordatorio por correo, una sola vez.
5. **Given** una cita cancelada o reprogramada, **When** llega el momento del recordatorio original,
   **Then** no se envía recordatorio para el horario anterior.

---

### User Story 3 - Recepción gestiona la agenda y la asistencia (Priority: P2)

La recepcionista ve la agenda del día y de la semana (por médico), crea y modifica citas en nombre
de pacientes (incluso por teléfono) y marca si el paciente asistió o no.

**Why this priority**: la clínica sigue atendiendo por teléfono y mostrador; recepción necesita la
misma fuente de verdad para evitar duplicados. El registro de asistencia habilita la política de
inasistencias.

**Independent Test**: como recepcionista, abrir la agenda del día, crear una cita para un paciente,
modificarla, marcar una asistencia y una inasistencia, y comprobar el efecto sobre el paciente.

**Acceptance Scenarios**:

1. **Given** citas existentes, **When** recepción abre la agenda diaria o semanal, **Then** ve las
   citas ordenadas por hora, con médico, paciente y estado.
2. **Given** un paciente (registrado o atendido por teléfono), **When** recepción agenda o modifica
   su cita, **Then** se aplican las mismas reglas de solapamiento y duración que en línea.
3. **Given** un paciente con 3 inasistencias consecutivas, **When** intenta reservar en línea,
   **Then** el sistema lo rechaza indicando que debe contactar a recepción, y recepción sí puede
   agendarle citas.
4. **Given** una cita pasada, **When** recepción marca "asistió" o "no asistió", **Then** el estado
   se guarda y se actualiza el conteo de inasistencias consecutivas del paciente (una asistencia
   lo reinicia a 0).
5. **Given** un horario que empieza en menos de 2 horas o un paciente con 3 citas activas,
   **When** recepción agenda en su nombre, **Then** el sistema lo permite (recepción está exenta de
   esos límites) pero sigue rechazando solapamientos del médico.

---

### User Story 4 - Médico consulta su agenda y bloquea horarios (Priority: P3)

El médico ve su agenda diaria y semanal y bloquea rangos de tiempo (vacaciones, reuniones) para que
no se ofrezcan a los pacientes.

**Why this priority**: evita citas en horarios en que el médico no está disponible; no es necesario
para operar el primer día porque el administrador puede ajustar horarios.

**Independent Test**: como médico, bloquear una tarde y comprobar que esos horarios dejan de
aparecer en la búsqueda de pacientes.

**Acceptance Scenarios**:

1. **Given** un médico con sesión iniciada, **When** abre su agenda, **Then** ve solo sus propias
   citas del día/semana.
2. **Given** un rango sin citas, **When** el médico lo bloquea con un motivo, **Then** esos
   horarios dejan de estar disponibles para reservar.
3. **Given** un bloqueo existente, **When** el médico lo elimina, **Then** los horarios vuelven a
   estar disponibles.
4. **Given** un rango que contiene citas activas, **When** el médico intenta bloquearlo, **Then** el
   sistema rechaza el bloqueo y lista las citas en conflicto para que recepción las reprograme o
   cancele primero.

---

### User Story 5 - Administrador gestiona médicos, especialidades y horarios (Priority: P3)

El administrador da de alta médicos y especialidades y define los horarios de atención de cada
médico.

**Why this priority**: es configuración; en la primera operación puede cubrirse con datos
iniciales, pero es necesaria para que la clínica sea autónoma.

**Independent Test**: como administrador, crear una especialidad, un médico y su horario semanal, y
comprobar que aparecen horarios reservables para ese médico.

**Acceptance Scenarios**:

1. **Given** un administrador, **When** crea una especialidad con su duración de cita, **Then** queda
   disponible para asignar a médicos y para la búsqueda de pacientes.
2. **Given** un médico con horario semanal definido, **When** un paciente busca disponibilidad,
   **Then** solo se ofrecen horarios dentro de ese horario.
3. **Given** un usuario sin rol de administrador, **When** intenta acceder al panel de
   administración, **Then** el acceso es denegado.
4. **Given** un feriado registrado por el administrador, **When** un paciente busca disponibilidad
   en esa fecha, **Then** no se ofrece ningún horario de ningún médico.

---

### Edge Cases

- Feriados: el día completo queda sin disponibilidad; las citas ya existentes ese día no se
  cancelan automáticamente (recepción decide).
- Zona horaria: todas las horas se muestran y evalúan en la zona de la clínica.
- Bloqueo de un médico sobre citas activas: se rechaza y se listan los conflictos.
- Inasistencias: cuentan solo las marcadas "no asistió"; una asistencia reinicia el conteo; las
  cancelaciones no cuentan.
- Cita reservada con menos de 24 horas de anticipación: no recibe recordatorio, solo confirmación.
- Si el correo de confirmación o recordatorio no se puede entregar, la cita sigue vigente y el
  envío se reintenta.
- Médico o especialidad desactivados: no se ofrecen horarios nuevos; las citas futuras existentes
  se conservan y recepción las gestiona.
- Cita exactamente a 24 h (o a 2 h) del inicio: el límite es inclusivo, es decir, a 24 h exactas
  todavía se puede reprogramar/cancelar y a 2 h exactas todavía se puede reservar.
- Un paciente no puede tener dos citas activas que se solapen en el tiempo, aunque sean con médicos
  distintos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Los pacientes MUST poder registrarse e iniciar sesión con correo y contraseña; el
  correo MUST ser único.
- **FR-002**: El sistema MUST ofrecer búsqueda de disponibilidad filtrando por especialidad, médico
  y fecha, mostrando únicamente horarios libres.
- **FR-003**: El paciente MUST poder reservar un horario libre y recibir un correo de confirmación.
- **FR-004**: Cada cita MUST durar 30 minutos para consulta general y 45 minutos para
  especialidades.
- **FR-005**: El sistema MUST impedir que un médico tenga dos citas solapadas, incluso ante
  solicitudes simultáneas.
- **FR-006**: El sistema MUST impedir que un paciente tenga más de 3 citas activas.
- **FR-007**: El sistema MUST rechazar reservas con menos de 2 horas de anticipación.
- **FR-008**: El paciente MUST poder reprogramar y cancelar sus propias citas hasta 24 horas antes
  del inicio; pasado ese límite MUST impedirlo. Reprogramar aplica las mismas reglas que reservar.
- **FR-009**: El sistema MUST enviar un recordatorio por correo 24 horas antes de cada cita
  vigente, una sola vez por cita y horario, y MUST NOT enviarlo para citas canceladas.
- **FR-010**: Recepción y médicos MUST poder ver la agenda diaria y semanal; el médico solo ve la
  suya.
- **FR-011**: Recepción MUST poder crear y modificar citas en nombre de pacientes, y marcar la
  asistencia (asistió / no asistió) de citas pasadas.
- **FR-012**: Tres inasistencias consecutivas de un paciente MUST bloquear su reserva en línea;
  solo recepción puede agendarle citas mientras dure el bloqueo.
- **FR-013**: Los médicos MUST poder bloquear y desbloquear rangos de tiempo propios, que MUST dejar
  de ofrecerse como disponibles.
- **FR-014**: El administrador MUST poder gestionar médicos, especialidades (con su duración de
  cita) y horarios de atención.
- **FR-015**: El acceso a cada función MUST depender del rol (paciente, recepcionista, médico,
  administrador); un paciente solo puede ver y modificar sus propias citas.
- **FR-016**: Cada cambio de estado de una cita (reserva, reprogramación, cancelación) MUST
  notificar al paciente por correo.
- **FR-017**: El sistema MUST validar todas las entradas del usuario y mostrar mensajes de error
  claros junto al campo afectado.
- **FR-018**: Todas las horas MUST mostrarse y evaluarse en una única zona horaria configurable de
  la clínica (reglas de 2 h y 24 h, recordatorios, agenda del día).
- **FR-019**: El administrador MUST poder registrar feriados (fecha y nombre); en un feriado no se
  ofrece disponibilidad de ningún médico.
- **FR-020**: Si un bloqueo de médico incluye citas activas, el sistema MUST rechazarlo y listar las
  citas en conflicto.
- **FR-021**: El conteo de inasistencias consecutivas MUST considerar solo citas marcadas "no
  asistió"; una asistencia lo reinicia a 0 y las cancelaciones no cuentan. Un paciente bloqueado
  para reserva en línea MUST poder asistir a citas agendadas por recepción, lo que lo desbloquea.
- **FR-022**: La recepción MUST estar exenta del límite de 3 citas activas, de la anticipación
  mínima de 2 horas y del bloqueo por inasistencias, pero MUST respetar duración y no-solapamiento.
- **FR-023**: Un paciente MUST NOT tener dos citas activas solapadas en el tiempo.
- **FR-024**: Los límites de 2 h y 24 h MUST ser inclusivos: a exactamente 2 h aún se puede reservar y
  a exactamente 24 h aún se puede reprogramar o cancelar.

### Key Entities

- **Paciente**: persona con cuenta (correo, contraseña, nombre) o atendida solo por teléfono;
  tiene citas y un historial de asistencia (conteo de inasistencias consecutivas).
- **Médico**: profesional asociado a una especialidad, con horario de atención y bloqueos.
- **Especialidad**: tipo de atención con su duración de cita (30 o 45 minutos).
- **Horario de atención**: días y franjas en que un médico atiende.
- **Feriado**: fecha no laborable de la clínica, con nombre, definida por el administrador.
- **Bloqueo**: rango de tiempo en que un médico no atiende (vacaciones, reunión), con motivo.
- **Cita**: reserva de un paciente con un médico en un horario; estados: activa, cancelada,
  asistida, no asistida.
- **Notificación**: mensaje por correo asociado a una cita (confirmación, cambio, cancelación,
  recordatorio) y su estado de entrega.
- **Usuario / Rol**: identidad autenticada con rol de paciente, recepcionista, médico o
  administrador.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un paciente nuevo puede registrarse y completar su primera reserva en menos de
  3 minutos.
- **SC-002**: En el 100 % de los casos de prueba, ningún médico queda con dos citas solapadas, ni
  siquiera con solicitudes simultáneas sobre el mismo horario.
- **SC-003**: El 100 % de las citas confirmadas genera un correo de confirmación, y el 100 % de las
  citas vigentes genera exactamente un recordatorio 24 horas antes.
- **SC-004**: La cantidad de citas duplicadas por solapamiento pasa de "frecuente" a cero en el
  primer mes de uso.
- **SC-005**: Recepción puede consultar la agenda del día de cualquier médico en menos de 5 segundos
  y crear una cita para un paciente en menos de 1 minuto.
- **SC-006**: Todas las reglas de negocio (duración, solapamiento, límite de 3 citas, 2 h de
  anticipación, ventana de 24 h, 3 inasistencias) tienen casos de prueba de aceptación en su
  frontera, y todos pasan.
- **SC-007**: Todas las pantallas pueden completarse solo con teclado.

## Assumptions

- El alcance v1 es una sola clínica con un pequeño número de médicos.
- Los pacientes tienen un correo electrónico propio; el correo es el único canal de notificación.
- El idioma de la interfaz es español.
- Una cita reservada con menos de 24 horas de anticipación recibe solo el correo de confirmación,
  no un recordatorio adicional.
- Una cita "activa" es una cita confirmada que aún no ocurrió (no cancelada, no asistida, no
  marcada como inasistencia).
- La recepción puede agendar pacientes que no tienen cuenta en línea (atención telefónica).
- Los pacientes menores de edad o representantes no se modelan en v1.
- **Fuera de alcance (v1)**: pagos, historia clínica, telemedicina, aplicación móvil, integración
  con seguros.
