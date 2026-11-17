// The arithmetic behind the large date and time fields: plus and minus wrap around instead of stopping, and a day
// never passes the end of its month.

export type Time = { hour: number; minute: number };

export type DateParts = { day: number; month: number; year: number };

export const minuteStep = 5;

function wrap(value: number, min: number, max: number) {
  const size = max - min + 1;
  return ((((value - min) % size) + size) % size) + min;
}

export function stepHour(time: Time, delta: number): Time {
  return { ...time, hour: wrap(time.hour + delta, 0, 23) };
}

// Moves to the next multiple of the step, so 08:07 goes to 08:10 and back to 08:05.
export function stepMinute(time: Time, delta: number): Time {
  const base = delta > 0 ? Math.floor(time.minute / minuteStep) : Math.ceil(time.minute / minuteStep);
  return { ...time, minute: wrap((base + Math.sign(delta)) * minuteStep, 0, 59) };
}

export function formatTime({ hour, minute }: Time) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseTime(text: string): Time | null {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export function daysInMonth(month: number, year: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function stepDate(date: DateParts, field: keyof DateParts, delta: number, years: { min: number; max: number }): DateParts {
  const next = { ...date };
  if (field === 'day') {
    next.day = wrap(date.day + delta, 1, daysInMonth(date.month, date.year));
  } else if (field === 'month') {
    next.month = wrap(date.month + delta, 1, 12);
  } else {
    next.year = Math.min(years.max, Math.max(years.min, date.year + delta));
  }

  next.day = Math.min(next.day, daysInMonth(next.month, next.year));
  return next;
}

export function isValidDate({ day, month, year }: DateParts) {
  return Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year)
    && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(month, year);
}

export function toIsoDate({ day, month, year }: DateParts) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
