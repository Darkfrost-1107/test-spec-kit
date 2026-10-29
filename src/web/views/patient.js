import { html, select, field, csrfInput, statusBadge } from './layout.js';
import { formatLocal, localTime } from '../../domain/time.js';

/** Lista de horarios como botones; cada uno es un formulario POST a `action`. */
export function slotButtons({ slots, tz, action, csrf, hidden = {} }) {
  if (!slots.length) return html`<p class="muted">No hay horarios libres para esta fecha.</p>`;
  return html`<ul class="slots">${slots.map((s) => html`<li>
    <form method="post" action="${action}">${csrfInput(csrf)}
      ${Object.entries(hidden).map(([k, v]) => html`<input type="hidden" name="${k}" value="${v}">`)}
      <input type="hidden" name="starts_at" value="${s.startsAt}">
      <button type="submit" aria-label="Reservar ${localTime(new Date(s.startsAt), tz)}">${localTime(new Date(s.startsAt), tz)}</button>
    </form></li>`)}</ul>`;
}

export function availabilityView({ csrf, tz, specialties, doctors, query, results }) {
  return html`<form method="get" action="/disponibilidad" class="card">
    <div class="row">
      ${select({ name: 'especialidad', label: 'Especialidad', options: specialties.map((s) => [s.id, `${s.name} (${s.duration_min} min)`]), value: query.especialidad ?? '', required: false, blank: 'Todas' })}
      ${select({ name: 'medico', label: 'Médico', options: doctors.map((d) => [d.id, `${d.name} · ${d.specialty_name}`]), value: query.medico ?? '', required: false, blank: 'Todos' })}
      ${field({ name: 'fecha', label: 'Fecha', type: 'date', value: query.fecha })}
      <div><button type="submit">Buscar</button></div>
    </div>
  </form>
  ${results.length ? results.map(({ doctor, slots }) => html`<section class="card" aria-labelledby="d${doctor.id}">
      <h2 id="d${doctor.id}">${doctor.name} <span class="muted">· ${doctor.specialty_name} · ${doctor.duration_min} min</span></h2>
      ${slotButtons({ slots, tz, action: '/citas', csrf, hidden: { doctor_id: doctor.id, fecha: query.fecha } })}
    </section>`) : html`<p>No hay médicos que coincidan con la búsqueda.</p>`}`;
}

export function myAppointmentsView({ csrf, tz, appointments, canModify }) {
  if (!appointments.length) return html`<p>Todavía no tienes citas. <a href="/disponibilidad">Busca un horario</a>.</p>`;
  return html`<table>
    <caption>Mis citas</caption>
    <thead><tr><th scope="col">Fecha y hora</th><th scope="col">Médico</th><th scope="col">Especialidad</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
    <tbody>${appointments.map((a) => html`<tr>
      <td>${formatLocal(new Date(a.starts_at), tz)}</td><td>${a.doctor_name}</td><td>${a.specialty_name}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${a.status !== 'active' ? '—' : canModify(a)
        ? html`<a href="/citas/${a.id}/reprogramar">Reprogramar</a>
            <form class="inline" method="post" action="/citas/${a.id}/cancelar">${csrfInput(csrf)}<button type="submit" class="secondary">Cancelar</button></form>`
        : html`<span class="muted">Faltan menos de 24 h: para cambios comunícate con la clínica.</span>`}</td>
    </tr>`)}</tbody></table>`;
}

export function rescheduleView({ csrf, tz, appt, fecha, slots, action, back }) {
  return html`<p>Cita actual: <strong>${formatLocal(new Date(appt.starts_at), tz)}</strong> con ${appt.doctor_name} (${appt.specialty_name}).</p>
  <form method="get" class="card"><div class="row">
    ${field({ name: 'fecha', label: 'Nueva fecha', type: 'date', value: fecha })}
    <div><button type="submit">Ver horarios</button></div></div></form>
  <section class="card" aria-label="Horarios disponibles">${slotButtons({ slots, tz, action, csrf, hidden: { fecha } })}</section>
  <p><a href="${back}">Volver</a></p>`;
}
