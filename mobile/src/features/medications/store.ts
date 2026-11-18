import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase, useRows, writeTransaction } from '../../lib/db';
import { enqueue, updatedAfter } from '../../lib/outbox';
import { canEditAccount, localAccountId } from '../../lib/session';
import { changeAccount, requestSync } from '../../lib/sync';
import { sameTimes, type DoseRecord, type Medication, type Period } from './doses';

export type MedicationRow = {
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

type DoseRecordRow = {
  id: string; medication_id: string; scheduled_date: string; scheduled_time: string; taken_at: string | null; updated_at: string;
};

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

function apiTime(time: string) {
  return `${time}:00`;
}

export async function queueMedication(transaction: SQLiteDatabase, row: MedicationRow | null) {
  if (row) {
    const medication = toMedication(row);
    await enqueue(transaction, 'medications', { ...medication, times: medication.times.map(apiTime) });
  }
}

// A new medication or a change to its times starts a period.
export async function saveMedication(id: string | null, input: MedicationInput) {
  const times = [...input.times].sort();
  const medicationId = id ?? randomUUID();

  await changeAccount(async (transaction) => {
    const existing = id ? await transaction.getFirstAsync<MedicationRow>('SELECT * FROM medications WHERE id = ?', id) : null;
    if (id && (!existing || existing.deleted)) {
      return;
    }
    const now = updatedAfter(existing?.updated_at);
    if (!existing) {
      const row = await transaction.getFirstAsync<MedicationRow>(
        'INSERT INTO medications (id, name, dose, times, shared_with_contact, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
        medicationId, input.name, input.dose, JSON.stringify(times), input.sharedWithContact ? 1 : 0, now,
      );
      await queueMedication(transaction, row);
      await addPeriod(transaction, medicationId, now, times, false);
      return;
    }

    const row = await transaction.getFirstAsync<MedicationRow>(
      'UPDATE medications SET name = ?, dose = ?, times = ?, shared_with_contact = ?, updated_at = ? WHERE id = ? RETURNING *',
      input.name, input.dose, JSON.stringify(times), input.sharedWithContact ? 1 : 0, now, medicationId,
    );
    await queueMedication(transaction, row);
    if (!sameTimes(JSON.parse(existing.times) as string[], times)) {
      await addPeriod(transaction, medicationId, now, times, existing.paused === 1);
    }
  });

  return medicationId;
}

export async function setPaused(id: string, paused: boolean) {
  await changeAccount(async (transaction) => {
    const existing = await transaction.getFirstAsync<MedicationRow>('SELECT * FROM medications WHERE id = ?', id);
    if (!existing || existing.deleted || (existing.paused === 1) === paused) {
      return;
    }
    const now = updatedAfter(existing.updated_at);
    const row = await transaction.getFirstAsync<MedicationRow>(
      'UPDATE medications SET paused = ?, updated_at = ? WHERE id = ? RETURNING *', paused ? 1 : 0, now, id,
    );
    await queueMedication(transaction, row);
    await addPeriod(transaction, id, now, JSON.parse(existing.times) as string[], paused);
  });
}

// Kept as a tombstone because dose records point at it.
export async function deleteMedication(id: string) {
  await changeAccount(async (transaction) => {
    const existing = await transaction.getFirstAsync<MedicationRow>('SELECT * FROM medications WHERE id = ?', id);
    if (!existing || existing.deleted) {
      return;
    }
    const row = await transaction.getFirstAsync<MedicationRow>(
      'UPDATE medications SET deleted = 1, updated_at = ? WHERE id = ? RETURNING *', updatedAfter(existing.updated_at), id,
    );
    await queueMedication(transaction, row);
  });
}

async function addPeriod(transaction: SQLiteDatabase, medicationId: string, startsAt: string, times: string[], paused: boolean) {
  const id = randomUUID();
  await transaction.runAsync(
    'INSERT INTO medication_periods (id, medication_id, starts_at, times, paused, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    id, medicationId, startsAt, JSON.stringify(times), paused ? 1 : 0, startsAt,
  );
  await enqueue(transaction, 'medicationPeriods', { id, medicationId, startsAt, times: times.map(apiTime), paused, updatedAt: startsAt });
}

// A duplicated action keeps the first tap, and undo preserves the record's ID.
export async function recordDose(medicationId: string, date: string, time: string, takenAt: string | null) {
  const accountId = await localAccountId();
  let recorded = false;
  await writeTransaction(async (transaction) => {
    if (!canEditAccount(accountId) || !await transaction.getFirstAsync('SELECT id FROM medications WHERE id = ?', medicationId)) {
      return;
    }
    const existing = await transaction.getFirstAsync<DoseRecordRow>(
      'SELECT * FROM dose_records WHERE medication_id = ? AND scheduled_date = ? AND scheduled_time = ?',
      medicationId, date, time,
    );
    if (Boolean(takenAt) === Boolean(existing?.taken_at)) {
      return;
    }
    const updatedAt = updatedAfter(existing?.updated_at);
    const id = existing?.id ?? randomUUID();
    await transaction.runAsync(
      `INSERT INTO dose_records (id, medication_id, scheduled_date, scheduled_time, taken_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (medication_id, scheduled_date, scheduled_time)
       DO UPDATE SET taken_at = excluded.taken_at, updated_at = excluded.updated_at`,
      id, medicationId, date, time, takenAt, updatedAt,
    );
    await enqueue(transaction, 'doseRecords', {
      id, medicationId, scheduledDate: date, scheduledTime: apiTime(time), takenAt, updatedAt,
    });
    recorded = true;
  });
  if (recorded) {
    void requestSync();
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
