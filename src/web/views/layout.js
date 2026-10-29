// Plantillas HTML con escape por defecto, layout semántico y accesible (Principio III).
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s));

function render(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}

/** Tagged template: todo valor interpolado se escapa salvo que sea raw() o html``. */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += render(vals[i]);
  });
  return new Raw(out);
}

const NAV = {
  patient: [['/disponibilidad', 'Buscar horarios'], ['/mis-citas', 'Mis citas']],
  reception: [['/recepcion/agenda', 'Agenda'], ['/recepcion/citas/nueva', 'Nueva cita']],
  doctor: [['/medico/agenda', 'Mi agenda'], ['/medico/bloqueos', 'Bloqueos']],
  admin: [['/admin', 'Panel'], ['/admin/especialidades', 'Especialidades'], ['/admin/medicos', 'Médicos'], ['/admin/feriados', 'Feriados'], ['/admin/correos', 'Correos']],
};

export const CSS = `
:root{--ink:#1a1a1a;--muted:#4d4d4d;--bg:#f6f8fa;--card:#fff;--line:#c9d1d9;--brand:#0b5cab;--brand-dark:#084a8a;--ok:#14532d;--okbg:#e6f4ea;--bad:#8a1c1c;--badbg:#fdecea}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--brand)}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,.tbl:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}
.skip{position:absolute;left:-999px;top:0;background:#fff;padding:.5rem 1rem;z-index:10}.skip:focus{left:0}
header{background:var(--brand);color:#fff}header .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:1rem;padding:.75rem 1rem}
header a{color:#fff}.brand{font-weight:700;font-size:1.25rem;text-decoration:none}
nav ul{display:flex;flex-wrap:wrap;gap:1rem;list-style:none;margin:0;padding:0}nav a{padding:.25rem .1rem}
.who{margin-left:auto;display:flex;align-items:center;gap:.75rem}.who form{margin:0}
main{max-width:1000px;margin:1.5rem auto;padding:0 1rem}h1{margin-top:0}h2{margin-top:1.75rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:1rem 1.25rem;margin:1rem 0}
label{display:block;font-weight:600;margin:.75rem 0 .25rem}input,select{font:inherit;padding:.5rem;border:1px solid #6b7280;border-radius:6px;width:100%;max-width:26rem;background:#fff;color:var(--ink)}
input[type=radio],input[type=checkbox]{width:auto;margin-right:.4rem}
button,.btn{font:inherit;background:var(--brand);color:#fff;border:0;border-radius:6px;padding:.5rem 1rem;cursor:pointer;text-decoration:none;display:inline-block}
button:hover,.btn:hover{background:var(--brand-dark)}button.secondary{background:#fff;color:var(--brand);border:2px solid var(--brand)}button.danger{background:var(--bad)}
.err{color:var(--bad);font-weight:600;margin:.25rem 0 0}.flash{padding:.75rem 1rem;border-radius:6px;margin:1rem 0;border:2px solid}.flash.ok{background:var(--okbg);color:var(--ok);border-color:var(--ok)}.flash.err{background:var(--badbg);color:var(--bad);border-color:var(--bad);margin:1rem 0}
.tbl{overflow-x:auto;max-width:100%}table{border-collapse:collapse;width:100%;min-width:34rem;background:#fff}caption{text-align:left;font-weight:700;padding:.5rem 0}th,td{border:1px solid var(--line);padding:.5rem .6rem;text-align:left;vertical-align:top}th{background:#eef2f6}
.slots{display:flex;flex-wrap:wrap;gap:.5rem;padding:0;list-style:none}.slots form{margin:0}.row{display:flex;flex-wrap:wrap;gap:1rem;align-items:end}.row>div{flex:1 1 12rem}.muted{color:var(--muted)}.inline{display:inline;margin:0}
.badge{display:inline-block;padding:.1rem .5rem;border-radius:99px;border:2px solid;font-size:.9rem;font-weight:600}.b-active{color:#084a8a;border-color:#084a8a}.b-cancelled{color:#555;border-color:#555}.b-attended{color:var(--ok);border-color:var(--ok)}.b-no_show{color:var(--bad);border-color:var(--bad)}
`;

// En pantallas angostas las tablas se desplazan dentro de un contenedor accesible por teclado.
const scrollableTables = (s) => s
  .replaceAll('<table>', '<div class="tbl" role="region" aria-label="Tabla de datos, desplazable" tabindex="0"><table>')
  .replaceAll('</table>', '</table></div>');

export function page({ title, user, csrf, flash, content }) {
  const links = user ? NAV[user.role] ?? [] : [['/login', 'Ingresar'], ['/registro', 'Registrarme']];
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · TurnoYa</title><style>${CSS}</style></head>
<body><a class="skip" href="#contenido">Saltar al contenido</a>
<header><div class="wrap"><a class="brand" href="/">TurnoYa</a>
<nav aria-label="Principal"><ul>${links.map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join('')}</ul></nav>
${user ? `<div class="who"><span>${esc(user.name)}</span><form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(csrf)}"><button type="submit" class="secondary">Cerrar sesión</button></form></div>` : ''}
</div></header>
<main id="contenido" tabindex="-1">
${flash ? `<p class="flash ${flash.t === 'ok' ? 'ok' : 'err'}" role="${flash.t === 'ok' ? 'status' : 'alert'}">${esc(flash.m)}</p>` : ''}
<h1>${esc(title)}</h1>
${scrollableTables(render(content))}
</main></body></html>`;
}

export const csrfInput = (csrf) => html`<input type="hidden" name="csrf" value="${csrf}">`;

/** Campo de formulario con label asociado y error en texto junto al campo. */
export function field({ name, label, type = 'text', value = '', error, required = true, attrs = '' }) {
  return html`<div>
    <label for="${name}">${label}</label>
    <input id="${name}" name="${name}" type="${type}" value="${value}" ${required ? raw('required') : ''} ${raw(attrs)}
      ${error ? raw(`aria-invalid="true" aria-describedby="${esc(name)}-err"`) : ''}>
    ${error ? html`<p class="err" id="${name}-err" role="alert">${error}</p>` : ''}
  </div>`;
}

export function select({ name, label, options, value = '', error, required = true, blank }) {
  return html`<div>
    <label for="${name}">${label}</label>
    <select id="${name}" name="${name}" ${required && !blank ? raw('required') : ''}
      ${error ? raw(`aria-invalid="true" aria-describedby="${esc(name)}-err"`) : ''}>
      ${blank ? html`<option value="">${blank}</option>` : ''}
      ${options.map(([v, t]) => html`<option value="${v}" ${String(v) === String(value) ? raw('selected') : ''}>${t}</option>`)}
    </select>
    ${error ? html`<p class="err" id="${name}-err" role="alert">${error}</p>` : ''}
  </div>`;
}

export const STATUS = { active: 'Activa', cancelled: 'Cancelada', attended: 'Asistió', no_show: 'No asistió' };
export const statusBadge = (s) => html`<span class="badge b-${s}">${STATUS[s] ?? s}</span>`;
