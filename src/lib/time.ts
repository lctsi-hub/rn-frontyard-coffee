// Dates and times in the shop's time zone (Asia/Manila, UTC+8, no daylight saving).

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-06" for the given moment in Manila. */
export function manilaDateString(date: Date = new Date()) {
  return new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00+08:00`));
}

/** Start/end (UTC ISO) of a Manila calendar day, for database filters. */
export function manilaDayRange(dateString: string = manilaDateString()) {
  const start = new Date(`${dateString}T00:00:00+08:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + DAY_MS).toISOString() };
}

const timeFormat = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** "just now", "4 min", "1 h 12 min" since `iso`. */
export function elapsed(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
