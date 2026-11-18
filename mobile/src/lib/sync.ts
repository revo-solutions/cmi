import { addNetworkStateListener } from 'expo-network';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { ApiError, ApiUnavailableError } from '../api/client';
import { accountActivateDevice, syncDownload, syncUpload } from '../api/generated/client';
import { sendHelpRequests } from '../features/sos/sos';
import { blockedAccountKey, restoreAccountData } from './accountData';
import { getDatabase, getSetting, setSetting, useRows, writeTransaction } from './db';
import { nextAttempt, outboxBatch, recoverableDoses, retryStartMs, type OutboxRow } from './outbox';
import { canEditAccount, loadSession, localAccountId, SessionRequiredError, withSession } from './session';

const batchSize = 100;
let sending: Promise<void> | undefined;
let recovering: Promise<void> | undefined;
let requested = false;
let retryNow = false;

export async function isSyncBlocked(accountId: string) {
  return await getSetting(blockedAccountKey) === accountId;
}

export function useSyncBlocked(accountId: string) {
  const rows = useRows<{ value: string }>('SELECT value FROM settings WHERE key = ?', [blockedAccountKey]);
  return rows?.[0]?.value === accountId;
}

export async function rememberSyncConflict(error: unknown, accountId: string) {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return false;
  }
  if (!await isSyncBlocked(accountId)) {
    await setSetting(blockedAccountKey, accountId);
  }
  return true;
}

async function drain(force: boolean) {
  const session = await loadSession();
  if (!session || session.expired || recovering || await isSyncBlocked(session.accountId)) {
    return;
  }
  const db = await getDatabase();
  while (!recovering) {
    const rows = await db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY id LIMIT ?', batchSize);
    const head = rows[0];
    if (!head || (!force && head.next_attempt_at && Date.parse(head.next_attempt_at) > Date.now())) {
      return;
    }
    const lastId = rows[rows.length - 1].id;
    try {
      await withSession((options) => syncUpload(outboxBatch(rows), options));
    } catch (error) {
      if (error instanceof SessionRequiredError || await rememberSyncConflict(error, session.accountId)) {
        return;
      }
      const reason = error instanceof ApiUnavailableError ? 'connection' : 'server';
      await writeTransaction(async (transaction) => {
        await transaction.runAsync(
          'UPDATE outbox SET attempts = attempts + 1, next_attempt_at = ?, last_error = ? WHERE id <= ?',
          nextAttempt(head.attempts, Date.now()), reason, lastId,
        );
      });
      return;
    }

    // IDs are never reused. Rows inserted during the request have higher IDs than this snapshot.
    await writeTransaction(async (transaction) => {
      await transaction.runAsync('DELETE FROM outbox WHERE id <= ?', lastId);
    });
    force = false;
  }
}

export function flushOutbox(force = false) {
  requested = true;
  retryNow ||= force;
  sending ??= (async () => {
    while (requested) {
      requested = false;
      const retry = retryNow;
      retryNow = false;
      await drain(retry);
    }
  })().finally(() => { sending = undefined; });
  return sending;
}

export function requestSync(force = false) {
  return flushOutbox(force).catch(() => undefined);
}

// A change to the signed-in account's records, saved with its queued copy and then sent.
export async function changeAccount(change: (transaction: SQLiteDatabase) => Promise<void>) {
  const accountId = await localAccountId();
  await writeTransaction(async (transaction) => {
    if (!canEditAccount(accountId)) {
      throw new SessionRequiredError();
    }
    await change(transaction);
  });
  void requestSync();
}

export function useOutboxSync(accountId: string | undefined) {
  useEffect(() => {
    if (!accountId) {
      return;
    }
    // Help requests go along, on their own: a blocked sync doesn't hold them back.
    const send = (force = false) => {
      void requestSync(force);
      void sendHelpRequests().catch(() => undefined);
    };
    send();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        send();
      }
    });
    const network = addNetworkStateListener(({ isConnected }) => {
      if (isConnected) {
        send(true);
      }
    });
    const timer = setInterval(send, retryStartMs);
    return () => {
      appState.remove();
      network.remove();
      clearInterval(timer);
    };
  }, [accountId]);
}

export function reactivateDevice() {
  recovering ??= (async () => {
    await sending?.catch(() => undefined);
    const session = await loadSession();
    if (!session || session.expired) {
      throw new SessionRequiredError();
    }
    await withSession(accountActivateDevice);
    const snapshot = await withSession(syncDownload);
    const db = await getDatabase();
    const queued = await db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY id');
    const lastId = queued.at(-1)?.id ?? 0;
    const doses = recoverableDoses(queued, snapshot);
    for (let start = 0; start < doses.length; start += batchSize) {
      await withSession((options) => syncUpload({ doseRecords: doses.slice(start, start + batchSize) }, options));
    }
    const restored = doses.length ? await withSession(syncDownload) : snapshot;
    await restoreAccountData(restored, lastId);
  })().finally(() => { recovering = undefined; });
  return recovering;
}
