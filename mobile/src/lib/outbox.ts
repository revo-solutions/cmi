import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  ContactModel, DoseRecordModel, MedicationModel, MedicationPeriodModel, ProfileModel, SyncModel,
} from '../api/generated/client';

type Changes = {
  medications: MedicationModel;
  medicationPeriods: MedicationPeriodModel;
  doseRecords: DoseRecordModel;
  contacts: ContactModel;
  profile: ProfileModel;
};

export type OutboxRow = {
  id: number;
  type: keyof Changes;
  payload: string;
  created_at: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
};

export const pendingNoticeMs = 5 * 60_000;
export const retryStartMs = 15_000;
const retryLimitMs = 5 * 60_000;

// Last write wins on the server, so a change is always later than the one it replaces, even with the clock set back.
export function updatedAfter(previous?: string | null) {
  return new Date(Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0)).toISOString();
}

export async function enqueue<K extends keyof Changes>(db: SQLiteDatabase, type: K, change: Changes[K]) {
  await db.runAsync('INSERT INTO outbox (type, payload, created_at) VALUES (?, ?, ?)', type, JSON.stringify(change), new Date().toISOString());
}

export function nextAttempt(attempts: number, now: number) {
  return new Date(now + Math.min(retryStartMs * 2 ** attempts, retryLimitMs)).toISOString();
}

export function outboxBatch(rows: OutboxRow[]): SyncModel {
  const medications = new Map<string, MedicationModel>();
  const medicationPeriods = new Map<string, MedicationPeriodModel>();
  const doseRecords = new Map<string, DoseRecordModel>();
  const contacts = new Map<string, ContactModel>();
  let profile: ProfileModel | undefined;

  for (const row of rows) {
    switch (row.type) {
      case 'medications': {
        const item = JSON.parse(row.payload) as MedicationModel;
        medications.set(item.id, item);
        break;
      }
      case 'medicationPeriods': {
        const item = JSON.parse(row.payload) as MedicationPeriodModel;
        medicationPeriods.set(item.id, item);
        break;
      }
      case 'doseRecords': {
        const item = JSON.parse(row.payload) as DoseRecordModel;
        doseRecords.set(item.id, item);
        break;
      }
      case 'contacts': {
        const item = JSON.parse(row.payload) as ContactModel;
        contacts.set(item.id, item);
        break;
      }
      case 'profile':
        profile = JSON.parse(row.payload) as ProfileModel;
        break;
    }
  }
  return {
    medications: [...medications.values()],
    medicationPeriods: [...medicationPeriods.values()],
    doseRecords: [...doseRecords.values()],
    contacts: [...contacts.values()],
    profile,
  };
}

function doseKey(dose: DoseRecordModel) {
  return `${dose.medicationId}:${dose.scheduledDate}:${dose.scheduledTime.slice(0, 5)}`;
}

// An inactive phone may have created its own UUID for a dose already registered by the other phone.
export function recoverableDoses(rows: OutboxRow[], snapshot: SyncModel) {
  const medications = new Set(snapshot.medications?.map(({ id }) => id));
  const stored = new Map(snapshot.doseRecords?.map((dose) => [doseKey(dose), dose]));
  const recovered = new Map<string, DoseRecordModel>();
  for (const row of rows) {
    if (row.type !== 'doseRecords') {
      continue;
    }
    const dose = JSON.parse(row.payload) as DoseRecordModel;
    if (!medications.has(dose.medicationId)) {
      continue;
    }
    const key = doseKey(dose);
    const previous = stored.get(key);
    if (previous && Date.parse(previous.updatedAt) >= Date.parse(dose.updatedAt)) {
      continue;
    }
    recovered.set(key, { ...dose, id: previous?.id ?? recovered.get(key)?.id ?? dose.id });
  }
  return [...recovered.values()];
}
