import { html, select, field, csrfInput, statusBadge } from './layout.js';
import { formatLocal, localTime, localDate } from '../../domain/time.js';
import { slotButtons } from './patient.js';

export function agendaFilters({ action, query, doctors, showDoctor = true }) {
  return html`<form method="get" action="${action}" class="card"><div class="row">
    ${field({ name: 'fecha', label: 'Fecha', type: 'date', value: query.fecha })}
    ${select({ name: 'vista', label: 'Vista', options: [['dia', 'Día'], ['semana', 'Semana']], value: query.vista })}
    ${showDoctor ? select({ name: 'medico', label: 'Médico', options: doctors.map((d) => [d.id, d.name]), value: query.medico ?? '', required: false, blank: 'Todos' }) : ''}
    <div><button type="submit">Ver agenda</button></div></div></form>`;
}

/** Tabla de agenda; con `actions` muestra marcar asistencia y editar (solo recepción). */
export function agendaTable({ items, tz, now, csrf, actions }) {
  if (!items.length) return html`<p>No hay citas en este rango.</p>`;
  return html`<table>
    <caption>Citas del rango seleccionado</caption>
    <thead><tr><th scope="col">Hora</th><th scope="col">Médico</th><th scope="col">Paciente</th><th scope="col">Estado</th>${actions ? html`<th scope="col">Acciones</th>` : ''}</tr></thead>
    <tbody>${items.map((a) => {
      const started = a.starts_at <= now.toISOString();
      return html`<tr>
      <td>${formatLocal(new Date(a.starts_at), tz)}</td><td>${a.doctor_name}<br><span class="muted">${a.specialty_name}</span></td><td>${a.patient_name}</td>
      <td>${statusBadge(a.status)}${a.status === 'active' && started ? html` <span class="muted">Pendiente de marcar</span>` : ''}</td>
      ${actions ? html`<td>${a.status === 'active' ? html`
        ${started ? html`<form class="inline" method="post" action="/recepcion/citas/${a.id}/asistencia">${csrfInput(csrf)}
          <button type="submit" name="result" value="attended">Asistió</button>
          <button type="submit" name="result" value="no_show" class="danger">No asistió</button></form>` : ''}
        <a href="/recepcion/citas/${a.id}/editar">Editar</a>` : '—'}</td>` : ''}
    </tr>`;
    })}</tbody></table>`;
}

export function newAppointmentView({ csrf, tz, patients, doctors, query, slots, errors = {}, values = {} }) {
  return html`<form method="get" action="/recepcion/citas/nueva" class="card"><div class="row">
      ${select({ name: 'medico', label: 'Médico', options: doctors.map((d) => [d.id, `${d.name} · ${d.specialty_name} (${d.duration_min} min)`]), value: query.medico ?? '' })}
      ${field({ name: 'fecha', label: 'Fecha', type: 'date', value: query.fecha })}
      <div><button type="submit">Ver horarios</button></div></div></form>
  ${query.medico ? html`<form method="post" action="/recepcion/citas" class="card">
      ${csrfInput(csrf)}<input type="hidden" name="doctor_id" value="${query.medico}">
      <h2>Paciente</h2>
      ${select({ name: 'patient_id', label: 'Paciente existente', options: patients.map((p) => [p.id, `${p.name}${p.consecutive_no_shows >= 3 ? ' (bloqueado en línea)' : ''}`]), value: values.patient_id ?? '', required: false, blank: 'Nuevo paciente…', error: errors.patient_id })}
      <p class="muted">Si es un paciente nuevo (atención telefónica), completa estos datos:</p>
      ${field({ name: 'name', label: 'Nombre', value: values.name ?? '', required: false, error: errors.name })}
      ${field({ name: 'email', label: 'Correo (opcional)', type: 'email', value: values.email ?? '', required: false, error: errors.email })}
      ${field({ name: 'phone', label: 'Teléfono (opcional)', value: values.phone ?? '', required: false, error: errors.phone })}
      <h2>Horario (${query.fecha})</h2>
      ${slots.length ? html`<fieldset><legend>Elige un horario</legend>${slots.map((s) => html`<label><input type="radio" name="starts_at" value="${s.startsAt}" required> ${localTime(new Date(s.startsAt), tz)}</label>`)}</fieldset>
        <p><button type="submit">Agendar cita</button></p>` : html`<p class="muted">No hay horarios libres para esa fecha.</p>`}
    </form>` : ''}`;
}

export function editAppointmentView({ csrf, tz, appt, fecha, slots }) {
  return html`<p>Paciente: <strong>${appt.patient_name}</strong> · ${appt.doctor_name} (${appt.specialty_name}) · actual: <strong>${formatLocal(new Date(appt.starts_at), tz)}</strong> ${statusBadge(appt.status)}</p>
  <form method="get" class="card"><div class="row">${field({ name: 'fecha', label: 'Nueva fecha', type: 'date', value: fecha })}
    <div><button type="submit">Ver horarios</button></div></div></form>
  <section class="card" aria-label="Horarios disponibles">${slotButtons({ slots, tz, action: `/recepcion/citas/${appt.id}/editar`, csrf, hidden: { fecha } })}</section>
  <form method="post" action="/recepcion/citas/${appt.id}/cancelar">${csrfInput(csrf)}<button type="submit" class="danger">Cancelar esta cita</button></form>
  <p><a href="/recepcion/agenda?fecha=${localDate(new Date(appt.starts_at), tz)}">Volver a la agenda</a></p>`;
}
