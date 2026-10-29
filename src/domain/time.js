// Único módulo que lee el reloj del sistema (Principio V). El resto recibe un Clock inyectado.
export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;

export class Clock {
  now() {
    return new Date();
  }
}

export class FakeClock {
  constructor(iso) {
    this.t = new Date(iso);
  }
  now() {
    return new Date(this.t);
  }
  set(iso) {
    this.t = new Date(iso);
  }
  advance(minutes) {
    this.t = new Date(this.t.getTime() + minutes * MIN);
  }
}

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * MIN);

const pad = (n) => String(n).padStart(2, '0');

function zoneParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

// Diferencia (ms) entre la hora local de la zona y UTC en un instante dado.
function offsetMs(date, tz) {
  const p = zoneParts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convierte fecha 'YYYY-MM-DD' y hora 'HH:MM' locales de la clínica a un instante UTC. */
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz);
  return new Date(t);
}

export function localDate(date, tz) {
  const p = zoneParts(date, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function localTime(date, tz) {
  const p = zoneParts(date, tz);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Los 7 días (lunes a domingo) de la semana que contiene a dateStr. */
export function weekRange(dateStr) {
  const wd = weekdayOf(dateStr);
  const monday = addDays(dateStr, wd === 0 ? -6 : 1 - wd);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** 'lun 02/11/2026 09:00' en la zona de la clínica. */
export function formatLocal(date, tz) {
  const d = localDate(date, tz);
  const [y, m, day] = d.split('-');
  return `${DAY_NAMES[weekdayOf(d)]} ${day}/${m}/${y} ${localTime(date, tz)}`;
}
