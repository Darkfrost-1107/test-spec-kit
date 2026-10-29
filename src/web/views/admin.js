import { html, field, select, csrfInput } from './layout.js';
import { formatLocal } from '../../domain/time.js';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const toggle = (action, csrf, active) => html`<form class="inline" method="post" action="${action}">${csrfInput(csrf)}
  <input type="hidden" name="active" value="${active ? 0 : 1}"><button type="submit" class="secondary">${active ? 'Desactivar' : 'Activar'}</button></form>`;

export const adminHome = () => html`<ul>
  <li><a href="/admin/especialidades">Especialidades y duración de citas</a></li>
  <li><a href="/admin/medicos">Médicos y horarios de atención</a></li>
  <li><a href="/admin/feriados">Feriados</a></li>
  <li><a href="/admin/correos">Bandeja de correos enviados</a></li></ul>`;

export function specialtiesView({ csrf, specialties, values = {}, errors = {} }) {
  return html`<form method="post" action="/admin/especialidades" class="card" novalidate>${csrfInput(csrf)}<div class="row">
    ${field({ name: 'name', label: 'Nombre de la especialidad', value: values.name ?? '', error: errors.name })}
    ${select({ name: 'duration_min', label: 'Duración de la cita', options: [[30, '30 minutos (consulta general)'], [45, '45 minutos (especialidad)']], value: values.duration_min ?? 30, error: errors.duration_min })}
    <div><button type="submit">Crear especialidad</button></div></div></form>
  <table><caption>Especialidades</caption><thead><tr><th scope="col">Nombre</th><th scope="col">Duración</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead>
  <tbody>${specialties.map((s) => html`<tr><td>${s.name}</td><td>${s.duration_min} min</td><td>${s.active ? 'Activa' : 'Inactiva'}</td><td>${toggle(`/admin/especialidades/${s.id}/estado`, csrf, s.active)}</td></tr>`)}</tbody></table>`;
}

export function doctorsView({ csrf, doctors, specialties, values = {}, errors = {} }) {
  return html`<form method="post" action="/admin/medicos" class="card" novalidate>${csrfInput(csrf)}<h2>Nuevo médico</h2>
    <div class="row">
    ${field({ name: 'name', label: 'Nombre', value: values.name ?? '', error: errors.name })}
    ${select({ name: 'specialty_id', label: 'Especialidad', options: specialties.filter((s) => s.active).map((s) => [s.id, s.name]), value: values.specialty_id ?? '', error: errors.specialty_id })}
    ${field({ name: 'email', label: 'Correo de acceso', type: 'email', value: values.email ?? '', error: errors.email })}
    ${field({ name: 'password', label: 'Contraseña inicial', type: 'password', error: errors.password })}
    <div><button type="submit">Crear médico</button></div></div></form>
  <table><caption>Médicos</caption><thead><tr><th scope="col">Nombre</th><th scope="col">Especialidad</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
  <tbody>${doctors.map((d) => html`<tr><td>${d.name}</td><td>${d.specialty_name} (${d.duration_min} min)</td><td>${d.active ? 'Activo' : 'Inactivo'}</td>
    <td><a href="/admin/medicos/${d.id}/horarios">Horarios</a> ${toggle(`/admin/medicos/${d.id}/estado`, csrf, d.active)}</td></tr>`)}</tbody></table>`;
}

export function schedulesView({ csrf, doctor, schedules, values = {}, errors = {} }) {
  return html`<p>${doctor.name} · ${doctor.specialty_name}. Las horas se interpretan en la zona horaria de la clínica.</p>
  <form method="post" action="/admin/medicos/${doctor.id}/horarios" class="card" novalidate>${csrfInput(csrf)}<div class="row">
    ${select({ name: 'weekday', label: 'Día', options: DAYS.map((d, i) => [i, d]), value: values.weekday ?? 1, error: errors.weekday })}
    ${field({ name: 'start', label: 'Desde', type: 'time', value: values.start ?? '', error: errors.start })}
    ${field({ name: 'end', label: 'Hasta', type: 'time', value: values.end ?? '', error: errors.end })}
    <div><button type="submit">Agregar franja</button></div></div></form>
  ${schedules.length ? html`<table><caption>Horario semanal</caption><thead><tr><th scope="col">Día</th><th scope="col">Franja</th><th scope="col">Acción</th></tr></thead>
  <tbody>${schedules.map((s) => html`<tr><td>${DAYS[s.weekday]}</td><td>${s.start_time} – ${s.end_time}</td>
    <td><form class="inline" method="post" action="/admin/medicos/${doctor.id}/horarios/${s.id}/eliminar">${csrfInput(csrf)}<button type="submit" class="secondary">Eliminar</button></form></td></tr>`)}</tbody></table>`
    : html`<p>Sin horario definido: no se ofrecerán citas.</p>`}
  <p><a href="/admin/medicos">Volver a médicos</a></p>`;
}

export function holidaysView({ csrf, holidays, values = {}, errors = {} }) {
  return html`<form method="post" action="/admin/feriados" class="card" novalidate>${csrfInput(csrf)}<div class="row">
    ${field({ name: 'date', label: 'Fecha', type: 'date', value: values.date ?? '', error: errors.date })}
    ${field({ name: 'name', label: 'Nombre del feriado', value: values.name ?? '', error: errors.name })}
    <div><button type="submit">Registrar feriado</button></div></div></form>
  ${holidays.length ? html`<table><caption>Feriados (sin disponibilidad)</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Nombre</th><th scope="col">Acción</th></tr></thead>
  <tbody>${holidays.map((h) => html`<tr><td>${h.date}</td><td>${h.name}</td><td><form class="inline" method="post" action="/admin/feriados/eliminar">${csrfInput(csrf)}<input type="hidden" name="date" value="${h.date}"><button type="submit" class="secondary">Eliminar</button></form></td></tr>`)}</tbody></table>`
    : html`<p>No hay feriados registrados.</p>`}`;
}

export function outboxView({ rows, tz }) {
  if (!rows.length) return html`<p>No se han generado correos todavía.</p>`;
  return html`<table><caption>Correos (más recientes primero)</caption>
  <thead><tr><th scope="col">#</th><th scope="col">Tipo</th><th scope="col">Destinatario</th><th scope="col">Asunto</th><th scope="col">Estado</th><th scope="col">Creado</th></tr></thead>
  <tbody>${rows.map((m) => html`<tr><td>${m.id}</td><td>${m.kind}</td><td>${m.to_email}</td><td>${m.subject}</td><td>${m.status}</td><td>${formatLocal(new Date(m.created_at), tz)}</td></tr>`)}</tbody></table>`;
}
