import { randomUUID } from 'expo-crypto';

import { getDatabase, useRows } from '../../lib/db';
import { sameTimes, type DoseRecord, type Medication, type Period } from './doses';

type MedicationRow = {
  id: string;
  name: string;
  dose: string | null;
  times: string;
  paused: number;
  shared_with_contact: number;
  deleted: number;
  updated_at: string;
};

type PeriodRow = { id: string; medication_id: string; starts_at: string; times: string; paused: number };

type DoseRecordRow = { id: string; medication_id: string; scheduled_date: string; scheduled_time: string; taken_at: string | null };

const medicationsSql = 'SELECT * FROM medications ORDER BY name COLLATE NOCASE';
const periodsSql = 'SELECT * FROM medication_periods';
const recordsSql = 'SELECT * FROM dose_records WHERE scheduled_date = ?';

function toMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    dose: row.dose,
    times: JSON.parse(row.times) as string[],
    paused: row.paused === 1,
    sharedWithContact: row.shared_with_contact === 1,
    deleted: row.deleted === 1,
    updatedAt: row.updated_at,
  };
}

function toPeriod(row: PeriodRow): Period {
  return { id: row.id, medicationId: row.medication_id, startsAt: row.starts_at, times: JSON.parse(row.times) as string[], paused: row.paused === 1 };
}

function toRecord(row: DoseRecordRow): DoseRecord {
  return { id: row.id, medicationId: row.medication_id, scheduledDate: row.scheduled_date, scheduledTime: row.scheduled_time, takenAt: row.taken_at };
}

// Deleted medications stay in the list: their past doses still belong to the history.
export async function listMedications() {
  const db = await getDatabase();
  return (await db.getAllAsync<MedicationRow>(medicationsSql)).map(toMedication);
}

export function useMedications() {
  return useRows<MedicationRow>(medicationsSql)?.map(toMedication);
}

export function usePeriods() {
  return useRows<PeriodRow>(periodsSql)?.map(toPeriod);
}

export function useDoseRecords(date: string) {
  return useRows<DoseRecordRow>(recordsSql, [date])?.map(toRecord);
}

export type MedicationInput = {
  name: string;
  dose: string | null;
  times: string[];
  sharedWithContact: boolean;
};

// A new medication, or a change to its times, starts a period; a name, dose or sharing edit doesn't.
export async function saveMedication(id: string | null, input: MedicationInput) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const times = [...input.times].sort();
  const medicationId = id ?? randomUUID();

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = id ? await transaction.getFirstAsync<MedicationRow>('SELECT * FROM medications WHERE id = ?', id) : null;
    if (!existing) {
      await transaction.runAsync(
        'INSERT INTO medications (id, name, dose, times, shared_with_contact, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        medicationId, input.name, input.dose, JSON.stringify(times), input.sharedWithContact ? 1 : 0, now,
      );
      await addPeriod(transaction, medicationId, now, times, false);
      return;
    }

    await transaction.runAsync(
      'UPDATE medications SET name = ?, dose = ?, times = ?, shared_with_contact = ?, updated_at = ? WHERE id = ?',
      input.name, input.dose, JSON.stringify(times), input.sharedWithContact ? 1 : 0, now, medicationId,
    );
    if (!sameTimes(JSON.parse(existing.times) as string[], times)) {
      await addPeriod(transaction, medicationId, now, times, existing.paused === 1);
    }
  });

  return medicationId;
}

export async function setPaused(id: string, paused: boolean) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<MedicationRow>('SELECT * FROM medications WHERE id = ?', id);
    if (!existing || (existing.paused === 1) === paused) {
      return;
    }

    await transaction.runAsync('UPDATE medications SET paused = ?, updated_at = ? WHERE id = ?', paused ? 1 : 0, now, id);
    await addPeriod(transaction, id, now, JSON.parse(existing.times) as string[], paused);
  });
}

// Kept as a tombstone: its dose history still points at it, and its doses stop at the deletion.
export async function deleteMedication(id: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE medications SET deleted = 1, updated_at = ? WHERE id = ?', new Date().toISOString(), id);
}

type Transaction = Parameters<Parameters<Awaited<ReturnType<typeof getDatabase>>['withExclusiveTransactionAsync']>[0]>[0];

async function addPeriod(transaction: Transaction, medicationId: string, startsAt: string, times: string[], paused: boolean) {
  await transaction.runAsync(
    'INSERT INTO medication_periods (id, medication_id, starts_at, times, paused, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    randomUUID(), medicationId, startsAt, JSON.stringify(times), paused ? 1 : 0, startsAt,
  );
}

// "Tomei" keeps the first tap: the same action delivered twice, by the notification task and the listener, records
// one dose. Undoing it (takenAt null) clears it.
export async function recordDose(medicationId: string, date: string, time: string, takenAt: string | null) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  if (takenAt) {
    await db.runAsync(
      `INSERT INTO dose_records (id, medication_id, scheduled_date, scheduled_time, taken_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (medication_id, scheduled_date, scheduled_time)
       DO UPDATE SET taken_at = excluded.taken_at, updated_at = excluded.updated_at WHERE taken_at IS NULL`,
      randomUUID(), medicationId, date, time, takenAt, now,
    );
  } else {
    await db.runAsync(
      'UPDATE dose_records SET taken_at = NULL, updated_at = ? WHERE medication_id = ? AND scheduled_date = ? AND scheduled_time = ?',
      now, medicationId, date, time,
    );
  }
}

export async function isDoseTaken(medicationId: string, date: string, time: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ taken_at: string | null }>(
    'SELECT taken_at FROM dose_records WHERE medication_id = ? AND scheduled_date = ? AND scheduled_time = ?',
    medicationId, date, time,
  );
  return Boolean(row?.taken_at);
}
