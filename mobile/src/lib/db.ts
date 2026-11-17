import { addDatabaseChangeListener, openDatabaseAsync, type SQLiteBindValue, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

// The device's copy of the account, and the source of truth while offline. Ids are UUIDs made on the device;
// updated_at is the device's clock at the last change, as the API's SyncModel expects. Instants are ISO strings, dates
// "YYYY-MM-DD" and times "HH:mm" on the person's wall clock; lists of times are JSON arrays.
//
// Each entry moves the schema up one version, and PRAGMA user_version counts the ones already run. Only append.
export const migrations = [
  `
  CREATE TABLE medications (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    dose TEXT,
    times TEXT NOT NULL,
    paused INTEGER NOT NULL DEFAULT 0,
    shared_with_contact INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  -- The schedule's history: times from starts_at until the medication's next period, none while paused.
  -- A new one starts when a medication is created, its times change, or it is paused or resumed; none changes after.
  CREATE TABLE medication_periods (
    id TEXT PRIMARY KEY NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications (id),
    starts_at TEXT NOT NULL,
    times TEXT NOT NULL,
    paused INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX medication_periods_medication ON medication_periods (medication_id, starts_at);

  -- Which dose a record is never changes; undoing "Tomei" clears taken_at.
  CREATE TABLE dose_records (
    id TEXT PRIMARY KEY NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications (id),
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    taken_at TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (medication_id, scheduled_date, scheduled_time)
  );

  CREATE TABLE contact (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- A single row; a null answer is one the person skipped. Conditions are codes, never display text.
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    name TEXT,
    birth_date TEXT,
    conditions TEXT NOT NULL DEFAULT '[]',
    other_condition TEXT,
    lives_alone INTEGER,
    fell_last_year INTEGER,
    vision_difficulty INTEGER,
    updated_at TEXT
  );

  -- What waits for the server, in order. The payload is a copy taken in the same transaction as the change, so an
  -- edit made while a batch is in flight is a new row rather than a lost one.
  CREATE TABLE outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    last_error TEXT
  );

  -- Device settings, such as the large-text mode; they stay on this phone.
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export function pendingMigrations(version: number) {
  return migrations.slice(version);
}

async function open() {
  const db = await openDatabaseAsync('cmi.db', { enableChangeListener: true });
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  for (const [index, sql] of pendingMigrations(version).entries()) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(sql);
      await transaction.execAsync(`PRAGMA user_version = ${version + index + 1}`);
    });
  }

  return db;
}

let database: Promise<SQLiteDatabase> | undefined;
let pendingWrite = Promise.resolve();
const committed = new Set<() => void>();

export function getDatabase() {
  return database ??= open().catch((error: unknown) => {
    database = undefined;
    throw error;
  });
}

export function writeTransaction(change: (transaction: SQLiteDatabase) => Promise<void>) {
  const write = pendingWrite.then(async () => {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(change);
    committed.forEach((listener) => listener());
  });
  pendingWrite = write.catch(() => undefined);
  return write;
}

// The rows of a query, read again whenever the database changes.
export function useRows<T>(sql: string, params: SQLiteBindValue[] = []) {
  const [rows, setRows] = useState<T[]>();
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let active = true;
    let generation = 0;
    const values = JSON.parse(paramsKey) as SQLiteBindValue[];
    const load = async () => {
      const current = ++generation;
      const db = await getDatabase();
      const result = await db.getAllAsync<T>(sql, values);
      if (active && generation === current) {
        setRows(result);
      }
    };

    const refresh = () => {
      load().catch((error: unknown) => console.warn('Não foi possível ler o banco local.', error));
    };
    refresh();
    committed.add(refresh);
    const subscription = addDatabaseChangeListener(refresh);

    return () => {
      active = false;
      committed.delete(refresh);
      subscription.remove();
    };
  }, [sql, paramsKey]);

  return rows;
}

export async function getSetting(key: string) {
  const db = await getDatabase();
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key))?.value ?? null;
}

export function setSetting(key: string, value: string) {
  return writeTransaction(async (transaction) => {
    await transaction.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  });
}
