/**
 * Toda la app usa la hora de Colombia en formato de 12 horas, sin importar dónde corra el código
 * (servidor en UTC, navegador en otra zona). Colombia es UTC-5 todo el año: no tiene horario de verano.
 */
export const APP_TIME_ZONE = "America/Bogota";
const COLOMBIA_OFFSET = "-05:00";

type DateLike = string | number | Date;

function parts(value: DateLike) {
  const out: Record<string, string> = {};
  const formatter = new Intl.DateTimeFormat("es-CO", { timeZone: APP_TIME_ZONE, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (const p of formatter.formatToParts(new Date(value))) out[p.type] = p.value.replace(/\./g, "");
  return { weekday: out.weekday, day: out.day, month: out.month, year: out.year, hour: (out.hour ?? "00").padStart(2, "0"), minute: (out.minute ?? "00").padStart(2, "0") };
}

/** "8:00 p. m." */
export function formatTime(value: DateLike): string {
  const p = parts(value);
  const hour = Number(p.hour);
  return `${hour % 12 || 12}:${p.minute} ${hour < 12 ? "a. m." : "p. m."}`;
}

/** "6 nov" */
export function formatDayMonth(value: DateLike): string {
  const p = parts(value);
  return `${p.day} ${p.month}`;
}

/** "vie 6 nov" */
export function formatDate(value: DateLike): string {
  const p = parts(value);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "vie 6 nov, 8:00 p. m." */
export function formatDateTime(value: DateLike): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/** "6 nov 2026, 8:00 p. m." */
export function formatFullDateTime(value: DateLike): string {
  const p = parts(value);
  return `${p.day} ${p.month} ${p.year}, ${formatTime(value)}`;
}

/** Instante ISO → "2026-11-06T20:00": hora de Colombia en el formato interno de los campos de fecha. */
export function isoToColombiaInput(value: DateLike): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - 5 * 60 * 60 * 1000).toISOString();
  return local.slice(0, 16);
}

/** "2026-11-06T20:00" (hora de Colombia) → instante ISO en UTC. */
export function colombiaInputToIso(value: string): string {
  return new Date(`${value}:00${COLOMBIA_OFFSET}`).toISOString();
}

/** Mañana a las 8:00 p. m., hora de Colombia. */
export function defaultStartInput(now: DateLike = Date.now()): string {
  const tomorrow = new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000);
  return `${isoToColombiaInput(tomorrow).slice(0, 10)}T20:00`;
}
