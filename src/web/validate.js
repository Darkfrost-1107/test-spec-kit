// Validación y normalización de entradas en el borde (Principio II). Mensajes en español por campo.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const toInt = (s) => (typeof s === 'string' && /^-?\d+$/.test(s.trim()) ? Number(s) : NaN);

export function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function isTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function isIso(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function validName(value, errors, field = 'name') {
  const v = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (v.length < 2 || v.length > 80) errors[field] = 'Escribe un nombre de 2 a 80 caracteres.';
  return v;
}

export function validEmail(value, errors, field = 'email', { required = true } = {}) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v && !required) return '';
  if (!EMAIL_RE.test(v) || v.length > 120) errors[field] = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  return v;
}

export function validPassword(value, errors, field = 'password') {
  const v = String(value ?? '');
  if (v.length < 8 || v.length > 100 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) {
    errors[field] = 'La contraseña debe tener al menos 8 caracteres, con letras y números.';
  }
  return v;
}

export function validPhone(value, errors, field = 'phone') {
  const v = String(value ?? '').trim();
  if (v && !/^[\d+\-()\s]{6,20}$/.test(v)) errors[field] = 'Escribe un teléfono válido (6 a 20 dígitos).';
  return v;
}

export function validateRegistration(input) {
  const errors = {};
  const values = {
    name: validName(input.name, errors),
    email: validEmail(input.email, errors),
    password: validPassword(input.password, errors),
  };
  return { values, errors };
}

export function validateLogin(input) {
  return { email: String(input.email ?? '').trim().toLowerCase(), password: String(input.password ?? '') };
}
