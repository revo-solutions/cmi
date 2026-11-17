import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { ApiError, ApiUnavailableError } from '../api/client';
import { accountActivateDevice, syncDownload, syncUpload, type DoseRecordModel, type SyncModel } from '../api/generated/client';
import { recordDose, saveMedication } from '../features/medications/store';
import { getDatabase, migrations } from './db';
import { enqueue, type OutboxRow } from './outbox';
import { flushOutbox, isSyncBlocked, reactivateDevice } from './sync';

jest.mock('expo-network', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID }));
jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: async () => undefined,
  dismissAllNotificationsAsync: async () => undefined,
  clearLastNotificationResponse: () => undefined,
}));
jest.mock('expo-sqlite', () => ({}));
jest.mock('../api/generated/client', () => ({
  accountActivateDevice: jest.fn(),
  syncDownload: jest.fn(),
  syncUpload: jest.fn(),
}));
jest.mock('./session', () => ({
  loadSession: async () => ({ accountId: 'account', expired: false }),
  localAccountId: async () => 'account',
  canEditAccount: (accountId: string) => accountId === 'account',
  withSession: (request: (options: RequestInit) => Promise<unknown>) => request({}),
  SessionRequiredError: class extends Error {},
}));

let mockSql: DatabaseSync;

jest.mock('./db', () => {
  const db = {
    execAsync: async (query: string) => mockSql.exec(query),
    getAllAsync: async (query: string, ...args: SQLInputValue[]) => mockSql.prepare(query).all(...args),
    getFirstAsync: async (query: string, ...args: SQLInputValue[]) => mockSql.prepare(query).get(...args),
    runAsync: async (query: string, ...args: (SQLInputValue | boolean)[]) =>
      mockSql.prepare(query).run(...args.map((value) => typeof value === 'boolean' ? Number(value) : value)),
  };
  return {
    migrations: jest.requireActual<typeof import('./db')>('./db').migrations,
    getDatabase: async () => db,
    getSetting: async (key: string) => (await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', key))?.value,
    setSetting: async (key: string, value: string) => db.runAsync('INSERT OR REPLACE INTO settings VALUES (?, ?)', key, value),
    writeTransaction: async (change: (transaction: typeof db) => Promise<void>) => {
      mockSql.exec('BEGIN');
      try {
        await change(db);
        mockSql.exec('COMMIT');
      } catch (error) {
        mockSql.exec('ROLLBACK');
        throw error;
      }
    },
  };
});

const before = '2026-11-17T10:00:00Z';
const later = '2026-11-17T11:00:00Z';
const medication = {
  id: 'med', name: 'Remédio', dose: null, times: ['07:30:00'],
  paused: false, sharedWithContact: false, deleted: false, updatedAt: before,
};
const taken: DoseRecordModel = {
  id: 'local-dose', medicationId: medication.id, scheduledDate: '2026-11-17', scheduledTime: '07:30:00',
  takenAt: later, updatedAt: later,
};

async function queued() {
  const db = await getDatabase();
  return db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY id');
}

beforeEach(() => {
  mockSql = new DatabaseSync(':memory:');
  migrations.forEach((migration) => mockSql.exec(migration));
  jest.resetAllMocks();
});

afterEach(() => mockSql.close());

test('a medication and its queue entries commit together, and undo keeps the dose ID', async () => {
  const input = { name: 'Medicamento', dose: null, times: ['07:30'], sharedWithContact: false };
  mockSql.exec(`
    CREATE TRIGGER reject_period BEFORE INSERT ON outbox WHEN NEW.type = 'medicationPeriods'
    BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;
  `);
  await expect(saveMedication(null, input)).rejects.toThrow('simulated write failure');
  expect(mockSql.prepare('SELECT id FROM medications').all()).toEqual([]);
  expect(await queued()).toEqual([]);
  mockSql.exec("DROP TRIGGER reject_period; INSERT INTO settings VALUES ('sync_blocked_account', 'account');");

  const id = await saveMedication(null, input);
  await recordDose(id, '2026-11-17', '07:30', later);
  await recordDose(id, '2026-11-17', '07:30', later);
  await recordDose(id, '2026-11-17', '07:30', null);
  await flushOutbox();
  const rows = await queued();
  expect(rows.map((row) => row.type)).toEqual(['medications', 'medicationPeriods', 'doseRecords', 'doseRecords']);
  const [first, undo] = rows.slice(2).map(({ payload }) => JSON.parse(payload) as DoseRecordModel);
  expect(first).toMatchObject({ takenAt: later, scheduledTime: '07:30:00' });
  expect(undo).toMatchObject({ id: first.id, takenAt: null });
  expect(Date.parse(undo.updatedAt)).toBeGreaterThan(Date.parse(first.updatedAt));
  expect(syncUpload).not.toHaveBeenCalled();
});

test('acknowledges only rows in flight and sends a later edit in the next batch', async () => {
  const db = await getDatabase();
  await enqueue(db, 'medications', medication);
  await enqueue(db, 'medicationPeriods', {
    id: 'period', medicationId: medication.id, startsAt: before, times: medication.times, paused: false, updatedAt: before,
  });
  jest.mocked(syncUpload).mockImplementationOnce(async (batch) => {
    expect(batch.medications).toEqual([medication]);
    expect(batch.medicationPeriods).toHaveLength(1);
    await enqueue(db, 'medications', { ...medication, name: 'Nome novo', updatedAt: later });
  }).mockImplementationOnce(async (batch) => {
    expect(await queued()).toHaveLength(1);
    expect(batch.medications?.[0]?.name).toBe('Nome novo');
    expect(batch.medicationPeriods).toEqual([]);
  });
  await flushOutbox();
  expect(syncUpload).toHaveBeenCalledTimes(2);
  expect(await queued()).toEqual([]);
});

test('keeps failed rows and lets reconnect retry before the scheduled delay', async () => {
  await enqueue(await getDatabase(), 'doseRecords', taken);
  jest.mocked(syncUpload).mockRejectedValueOnce(new ApiUnavailableError()).mockResolvedValueOnce(undefined);
  await flushOutbox();
  expect((await queued())[0]).toMatchObject({ attempts: 1, last_error: 'connection' });
  await flushOutbox();
  expect(syncUpload).toHaveBeenCalledTimes(1);
  await flushOutbox(true);
  expect(syncUpload).toHaveBeenCalledTimes(2);
  expect(await queued()).toEqual([]);
});

test('on 409 retains local changes, then recovers only eligible doses using the server IDs', async () => {
  const db = await getDatabase();
  await enqueue(db, 'medications', { ...medication, id: 'only-local' });
  await enqueue(db, 'contacts', { id: 'revoked', name: 'Contato', phone: '123', relationship: 'Friend', deleted: false, updatedAt: later });
  await enqueue(db, 'doseRecords', taken);
  await enqueue(db, 'doseRecords', { ...taken, id: 'unsupported', medicationId: 'only-local' });
  jest.mocked(syncUpload).mockRejectedValueOnce(new ApiError(409));
  await flushOutbox();
  expect(await isSyncBlocked('account')).toBe(true);
  expect(await queued()).toHaveLength(4);
  await flushOutbox(true);
  expect(syncUpload).toHaveBeenCalledTimes(1);

  const remoteDose = { ...taken, id: 'remote-dose', takenAt: null, updatedAt: before };
  const remote: SyncModel = { medications: [medication], doseRecords: [remoteDose], contacts: [] };
  jest.mocked(syncDownload).mockResolvedValueOnce(remote)
    .mockResolvedValueOnce({ ...remote, doseRecords: [{ ...taken, id: remoteDose.id }] });
  const late = { ...taken, id: 'arrived-during-restore', scheduledDate: '2026-11-18' };
  jest.mocked(syncUpload).mockImplementationOnce(async (batch) => {
    expect(await queued()).toHaveLength(4);
    expect(batch).toEqual({ doseRecords: [{ ...taken, id: remoteDose.id }] });
    await enqueue(db, 'doseRecords', late);
  });

  await reactivateDevice();
  expect(accountActivateDevice).toHaveBeenCalledTimes(1);
  expect(await isSyncBlocked('account')).toBe(false);
  expect((await queued()).map(({ payload }) => JSON.parse(payload))).toEqual([late]);
  expect(await db.getAllAsync('SELECT id, taken_at FROM dose_records ORDER BY scheduled_date')).toEqual([
    { id: remoteDose.id, taken_at: later }, { id: late.id, taken_at: later },
  ]);
  expect(await db.getAllAsync('SELECT id FROM contact')).toEqual([]);
  expect(await db.getAllAsync('SELECT id FROM medications')).toEqual([{ id: medication.id }]);
});
