import { html, field, csrfInput } from './layout.js';
import { formatLocal } from '../../domain/time.js';

export function blocksView({ csrf, tz, blocks, values = {}, errors = {} }) {
  return html`<form method="post" action="/medico/bloqueos" class="card" novalidate>${csrfInput(csrf)}
    <div class="row">
      ${field({ name: 'date', label: 'Fecha', type: 'date', value: values.date ?? '', error: errors.date })}
      ${field({ name: 'start', label: 'Desde (HH:MM)', type: 'time', value: values.start ?? '', error: errors.start })}
      ${field({ name: 'end', label: 'Hasta (HH:MM)', type: 'time', value: values.end ?? '', error: errors.end })}
      ${field({ name: 'reason', label: 'Motivo', value: values.reason ?? '', error: errors.reason, attrs: 'maxlength="120"' })}
      <div><button type="submit">Bloquear horario</button></div></div></form>
  ${blocks.length ? html`<table><caption>Mis bloqueos</caption>
    <thead><tr><th scope="col">Desde</th><th scope="col">Hasta</th><th scope="col">Motivo</th><th scope="col">Acción</th></tr></thead>
    <tbody>${blocks.map((b) => html`<tr><td>${formatLocal(new Date(b.starts_at), tz)}</td><td>${formatLocal(new Date(b.ends_at), tz)}</td><td>${b.reason}</td>
      <td><form class="inline" method="post" action="/medico/bloqueos/${b.id}/eliminar">${csrfInput(csrf)}<button type="submit" class="secondary">Quitar bloqueo</button></form></td></tr>`)}</tbody></table>`
    : html`<p>No tienes bloqueos.</p>`}`;
}
