// Which doses a day has and the state of each, from the device's own data (AGENTS.md, "Mobile"): Pendente until
// the deadline, Registrado once taken, Sem confirmação after it. A past day is read with the schedule it had, from
// the medication's periods, never with today's times.

// Mirrors the server's NoticeSettings.MissedDoseAfter; docs/escopo.md keeps them one number.
export const deadlineMinutes = 60;

export type Medication = {
  id: string;
  name: string;
  dose: string | null;
  times: string[];
  paused: boolean;
  sharedWithContact: boolean;
  deleted: boolean;
  updatedAt: string;
};

export type Period = {
  id: string;
  medicationId: string;
  startsAt: string;
  times: string[];
  paused: boolean;
};

export type DoseRecord = {
  id: string;
  medicationId: string;
  scheduledDate: string;
  scheduledTime: string;
  takenAt: string | null;
};

export type DoseState = 'pending' | 'taken' | 'unconfirmed' | 'paused';

export type Dose = {
  medication: Medication;
  date: string;
  time: string;
  scheduledAt: Date;
  state: DoseState;
  takenAt: string | null;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function localDate(instant: Date) {
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

export function localTime(instant: Date) {
  return `${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
}

export function localInstant(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

export function addDays(date: string, days: number) {
  const instant = localInstant(date, '12:00');
  instant.setDate(instant.getDate() + days);
  return localDate(instant);
}

export function dosesOn(date: string, medications: Medication[], periods: Period[], records: DoseRecord[], now: Date): Dose[] {
  const taken = new Map(records.filter((r) => r.scheduledDate === date).map((r) => [`${r.medicationId} ${r.scheduledTime}`, r]));
  const doses: Dose[] = [];

  for (const medication of medications) {
    const own = periods.filter((p) => p.medicationId === medication.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const deletedAt = medication.deleted ? new Date(medication.updatedAt) : null;

    own.forEach((period, index) => {
      const startsAt = new Date(period.startsAt);
      const until = index + 1 < own.length ? new Date(own[index + 1].startsAt) : null;

      for (const time of period.times) {
        const scheduledAt = localInstant(date, time);
        if (scheduledAt < startsAt || (until && scheduledAt >= until) || (deletedAt && scheduledAt >= deletedAt)) {
          continue;
        }

        const record = taken.get(`${medication.id} ${time}`);
        doses.push({
          medication,
          date,
          time,
          scheduledAt,
          takenAt: record?.takenAt ?? null,
          state: stateOf(scheduledAt, record?.takenAt ?? null, period.paused, now),
        });
      }
    });
  }

  // A dose taken and then moved by a schedule change still shows as taken.
  for (const record of taken.values()) {
    const medication = medications.find((m) => m.id === record.medicationId);
    const shown = doses.some((d) => d.medication.id === record.medicationId && d.time === record.scheduledTime);
    if (medication && record.takenAt && !shown) {
      doses.push({ medication, date, time: record.scheduledTime, scheduledAt: localInstant(date, record.scheduledTime), takenAt: record.takenAt, state: 'taken' });
    }
  }

  return doses.sort((a, b) => a.time.localeCompare(b.time) || a.medication.name.localeCompare(b.medication.name, 'pt-BR'));
}

function stateOf(scheduledAt: Date, takenAt: string | null, paused: boolean, now: Date): DoseState {
  if (takenAt) {
    return 'taken';
  }
  if (paused) {
    return 'paused';
  }
  return now.getTime() < scheduledAt.getTime() + deadlineMinutes * 60_000 ? 'pending' : 'unconfirmed';
}

// The dose Hoje puts first: the earliest one still within its deadline.
export function nextDose(doses: Dose[]) {
  return doses.find((dose) => dose.state === 'pending') ?? null;
}

export function sameTimes(a: string[], b: string[]) {
  const sorted = (times: string[]) => [...times].sort().join(',');
  return sorted(a) === sorted(b);
}
