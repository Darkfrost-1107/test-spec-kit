// Errores de negocio con mensaje visible para el usuario (sin detalles internos).
export const MESSAGES = {
  SLOT_TAKEN: 'Ese horario ya no está disponible. Por favor elige otro.',
  OVERLAP: 'El médico ya tiene una cita que se solapa con ese horario.',
  PATIENT_OVERLAP: 'El paciente ya tiene otra cita en ese mismo horario.',
  TOO_SOON: 'Las citas deben reservarse con al menos 2 horas de anticipación.',
  LIMIT_REACHED: 'Ya tienes 3 citas activas. Cancela una para reservar otra.',
  ONLINE_LOCKED: 'Tu reserva en línea está bloqueada por inasistencias. Comunícate con recepción para agendar.',
  TOO_LATE_TO_CHANGE: 'Solo puedes reprogramar o cancelar hasta 24 horas antes. Comunícate con la clínica.',
  BLOCK_CONFLICT: 'El rango contiene citas activas. Recepción debe reprogramarlas o cancelarlas primero.',
  NOT_OWNER: 'No tienes permiso para modificar esa cita.',
  NOT_ACTIVE: 'La cita ya no está activa.',
  NOT_STARTED: 'Solo se puede marcar asistencia de citas que ya comenzaron.',
  NOT_FOUND: 'No se encontró el registro solicitado.',
  DOCTOR_UNAVAILABLE: 'El médico no está disponible para reservas.',
  INVALID: 'Los datos enviados no son válidos.',
};

export class BizError extends Error {
  constructor(code, details) {
    super(MESSAGES[code] ?? code);
    this.code = code;
    this.details = details;
  }
}
