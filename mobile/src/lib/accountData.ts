import {
  cancelAllScheduledNotificationsAsync, clearLastNotificationResponse, dismissAllNotificationsAsync,
} from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { SyncModel } from '../api/generated/client';
import { writeTransaction } from './db';
import { enqueue, recoverableDoses, type OutboxRow } from './outbox';

export const blockedAccountKey = 'sync_blocked_account';

async function clearRows(db: SQLiteDatabase) {
  await db.execAsync(`
    DELETE FROM outbox;
    DELETE FROM dose_records;
    DELETE FROM medication_periods;
    DELETE FROM medications;
    DELETE FROM contact;
    DELETE FROM profile;
    DELETE FROM sos_requests;
  `);
  await db.runAsync('DELETE FROM settings WHERE key = ?', blockedAccountKey);
}

async function clearNotifications() {
  await cancelAllScheduledNotificationsAsync();
  await dismissAllNotificationsAsync();
  clearLastNotificationResponse();
}

export async function hasPendingChanges() {
  let pending = false;
  await writeTransaction(async (transaction) => {
    pending = !!await transaction.getFirstAsync('SELECT id FROM outbox LIMIT 1');
  });
  return pending;
}

export async function clearAccountData() {
  await clearNotifications();
  await writeTransaction(clearRows);
}

// Without keepDosesAfter the account may be another one, so its notifications go too. Taking the account back keeps
// them: reconcileReminders follows, and snoozes stay.
export async function restoreAccountData(snapshot: SyncModel, keepDosesAfter?: number) {
  await writeTransaction(async (transaction) => {
    const newer = keepDosesAfter === undefined ? [] : await transaction.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox WHERE id > ? AND type = ? ORDER BY id', keepDosesAfter, 'doseRecords',
    );
    await clearRows(transaction);
    const profile = snapshot.profile;
    if (profile) {
      await transaction.runAsync(`
        INSERT INTO profile (id, name, sex, birth_date, conditions, other_condition, lives_alone,
          fell_last_year, vision_difficulty, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, profile.name, profile.sex ?? null, profile.birthDate, JSON.stringify(profile.conditions), profile.otherCondition,
      profile.livesAlone, profile.fellLastYear, profile.visionDifficulty, profile.updatedAt);
    }
    for (const medication of snapshot.medications ?? []) {
      await transaction.runAsync(`
        INSERT INTO medications (id, name, dose, times, paused, shared_with_contact, deleted, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, medication.id, medication.name, medication.dose, JSON.stringify(medication.times.map(wallTime)),
      medication.paused, medication.sharedWithContact, medication.deleted, medication.updatedAt);
    }
    for (const period of snapshot.medicationPeriods ?? []) {
      await transaction.runAsync(`
        INSERT INTO medication_periods (id, medication_id, starts_at, times, paused, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, period.id, period.medicationId, period.startsAt, JSON.stringify(period.times.map(wallTime)),
      period.paused, period.updatedAt);
    }
    // The server has no unique dose key, so two phones may have stored the same dose: the newer one wins.
    for (const dose of snapshot.doseRecords ?? []) {
      await transaction.runAsync(`
        INSERT INTO dose_records (id, medication_id, scheduled_date, scheduled_time, taken_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (medication_id, scheduled_date, scheduled_time)
        DO UPDATE SET id = excluded.id, taken_at = excluded.taken_at, updated_at = excluded.updated_at
        WHERE excluded.updated_at > dose_records.updated_at
      `, dose.id, dose.medicationId, dose.scheduledDate, wallTime(dose.scheduledTime), dose.takenAt, dose.updatedAt);
    }
    for (const dose of recoverableDoses(newer, snapshot)) {
      await transaction.runAsync(`
        INSERT INTO dose_records (id, medication_id, scheduled_date, scheduled_time, taken_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (medication_id, scheduled_date, scheduled_time)
        DO UPDATE SET taken_at = excluded.taken_at, updated_at = excluded.updated_at
      `, dose.id, dose.medicationId, dose.scheduledDate, wallTime(dose.scheduledTime), dose.takenAt, dose.updatedAt);
      await enqueue(transaction, 'doseRecords', dose);
    }
    for (const contact of snapshot.contacts ?? []) {
      if (!contact.deleted) {
        await transaction.runAsync(`
          INSERT INTO contact (id, name, phone, relationship, updated_at) VALUES (?, ?, ?, ?, ?)
        `, contact.id, contact.name, contact.phone, contact.relationship, contact.updatedAt);
      }
    }
  });
  if (keepDosesAfter === undefined) {
    await clearNotifications();
  }
}

function wallTime(time: string) {
  return time.slice(0, 5);
}
