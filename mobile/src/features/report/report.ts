import {
  addDays, dosesOn, localDate, type DoseRecord, type DoseState, type Medication, type Period,
} from '../medications/doses';

export const periodDays = [30, 60, 90] as const;
export type PeriodDays = typeof periodDays[number];

export type MedicationReport = {
  medication: Medication;
  // Doses past their deadline, paused days left out: the ones a record was expected for.
  expected: number;
  taken: number;
  unconfirmed: number;
  // Median of how late the recorded doses were, in minutes; negative when usually early.
  typicalDelay: number | null;
  times: string[];
  // One entry per day of the period, oldest first: the state of each of its times, absent when it had none.
  days: { date: string; states: Partial<Record<string, DoseState>> }[];
};

export type Report = { from: string; to: string; medications: MedicationReport[]; expected: number; taken: number };

export function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// The last `days` days up to today, read day by day with the schedule each one had, as the history does.
export function buildReport(
  days: number, medications: Medication[], periods: Period[], records: DoseRecord[], now: Date,
): Report {
  const to = localDate(now);
  const from = addDays(to, 1 - days);
  const byMedication = new Map(medications.map((medication) => [medication.id, {
    medication, expected: 0, taken: 0, unconfirmed: 0, delays: [] as number[], times: new Set<string>(),
    days: [] as MedicationReport['days'],
  }]));

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const states = new Map<string, Partial<Record<string, DoseState>>>();
    for (const dose of dosesOn(date, medications, periods, records, now)) {
      const entry = byMedication.get(dose.medication.id)!;
      entry.times.add(dose.time);
      states.set(dose.medication.id, { ...states.get(dose.medication.id), [dose.time]: dose.state });
      if (dose.state === 'taken') {
        entry.expected++;
        entry.taken++;
        entry.delays.push(Math.round((Date.parse(dose.takenAt!) - dose.scheduledAt.getTime()) / 60_000));
      } else if (dose.state === 'unconfirmed') {
        entry.expected++;
        entry.unconfirmed++;
      }
    }
    for (const entry of byMedication.values()) {
      entry.days.push({ date, states: states.get(entry.medication.id) ?? {} });
    }
  }

  const reports = [...byMedication.values()]
    .filter((entry) => entry.times.size > 0)
    .map(({ delays, times, ...entry }) => ({ ...entry, typicalDelay: median(delays), times: [...times].sort() }));
  return {
    from,
    to,
    medications: reports,
    expected: reports.reduce((sum, entry) => sum + entry.expected, 0),
    taken: reports.reduce((sum, entry) => sum + entry.taken, 0),
  };
}

export function percent(taken: number, expected: number) {
  return Math.round((taken / expected) * 100);
}

// "no horário", "15 min depois", "1 h 20 min depois".
export function formatDelay(minutes: number | null) {
  if (minutes === null) {
    return '—';
  }
  if (minutes <= 0) {
    return 'no horário ou antes';
  }
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`} depois`;
}
