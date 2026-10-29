import { html, field, csrfInput } from './layout.js';

export function loginView({ csrf, values = {}, error }) {
  return html`<form method="post" action="/login" class="card" novalidate>
    ${csrfInput(csrf)}
    ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
    ${field({ name: 'email', label: 'Correo', type: 'email', value: values.email ?? '' })}
    ${field({ name: 'password', label: 'Contraseña', type: 'password' })}
    <p><button type="submit">Ingresar</button></p>
    <p>¿Eres paciente y no tienes cuenta? <a href="/registro">Regístrate</a>.</p>
  </form>`;
}

export function registerView({ csrf, values = {}, errors = {} }) {
  return html`<form method="post" action="/registro" class="card" novalidate>
    ${csrfInput(csrf)}
    ${field({ name: 'name', label: 'Nombre completo', value: values.name ?? '', error: errors.name })}
    ${field({ name: 'email', label: 'Correo', type: 'email', value: values.email ?? '', error: errors.email })}
    ${field({ name: 'password', label: 'Contraseña (mínimo 8 caracteres, con letras y números)', type: 'password', error: errors.password })}
    <p><button type="submit">Crear cuenta</button></p>
    <p>¿Ya tienes cuenta? <a href="/login">Ingresa</a>.</p>
  </form>`;
}
