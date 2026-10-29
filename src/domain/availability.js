// Generación pura de horarios libres: horario − bloqueos − feriados − citas activas.
import { zonedToUtc, weekdayOf, addMinutes, HOUR } from './time.js';
import { intervalsOverlap, MIN_NOTICE_HOURS } from './rules.js';

export function availableSlots({
  date, durationMin, schedules, blocks, holidays, appointments, now, tz, enforceNotice,
}) {
  if (holidays.includes(date)) return [];
  const weekday = weekdayOf(date);
  const earliest = enforceNotice ? now.getTime() + MIN_NOTICE_HOURS * HOUR : now.getTime();
  const busy = [
    ...blocks.map((b) => [b.starts_at, b.ends_at]),
    ...appointments.filter((a) => a.status === 'active').map((a) => [a.starts_at, a.ends_at]),
  ];

  const slots = [];
  for (const sch of schedules.filter((s) => s.weekday === weekday)) {
    const windowEnd = zonedToUtc(date, sch.end_time, tz);
    for (let start = zonedToUtc(date, sch.start_time, tz); ; start = addMinutes(start, durationMin)) {
      const end = addMinutes(start, durationMin);
      if (end > windowEnd) break;
      if (start.getTime() < earliest) continue;
      if (busy.some(([bs, be]) => intervalsOverlap(start, end, bs, be))) continue;
      slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    }
  }
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
