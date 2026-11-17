import { localInstant } from './doses';

const weekdayAndDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

// "Segunda, 16 de novembro", as in the canvas.
export function formatDay(date: string) {
  const text = weekdayAndDate.format(localInstant(date, '12:00')).replace('-feira', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "8:05", as people say it.
export function formatClock(instant: string) {
  const date = new Date(instant);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function medicationLabel(name: string, dose: string | null) {
  return dose ? `${name}, ${dose}` : name;
}
