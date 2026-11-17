import { localDate } from '../medications/doses';

export const birthdayHour = 9;

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Someone born on 29 February is congratulated on the 28th in other years, as the server's birthday notice does.
export function nextBirthday(birthDate: string, now: Date) {
  const [, month, day] = birthDate.split('-').map(Number);
  for (let year = now.getFullYear(); ; year++) {
    const leapDay = month === 2 && day === 29 && !isLeapYear(year);
    const at = new Date(year, month - 1, leapDay ? 28 : day, birthdayHour);
    if (at > now) {
      return at;
    }
  }
}

export function birthdayReminder(name: string | null, birthDate: string, now: Date) {
  const at = nextBirthday(birthDate, now);
  const firstName = name?.trim().split(/\s+/)[0];
  return {
    at,
    date: localDate(at),
    title: firstName ? `Feliz aniversário, ${firstName}!` : 'Feliz aniversário!',
    body: 'A Central Melhor Idade deseja um dia muito feliz para você.',
  };
}

export function formatBirthDate(birthDate: string) {
  const [year, month, day] = birthDate.split('-');
  return `${day}/${month}/${year}`;
}
