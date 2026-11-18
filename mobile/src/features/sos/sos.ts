import { randomUUID } from 'expo-crypto';

import { ApiUnavailableError } from '../../api/client';
import { NoticeStatus, sosGet, sosSend, type SosStatusModel } from '../../api/generated/client';
import { getDatabase, useRows, writeTransaction } from '../../lib/db';
import { withSession } from '../../lib/session';

// Opening SOS again within this time shows the same request rather than paying for, and alarming the family with, a
// second message.
export const reuseMs = 5 * 60_000;
// A request the server hasn't settled by then says so, next to the call buttons.
export const slowMs = 10_000;
export const pollMs = 3_000;
export const pollLimitMs = 2 * 60_000;

type HelpRow = { id: string; requested_at: string; accepted: number; status: NoticeStatus; last_error: string | null };

export type HelpRequest = { id: string; requestedAt: string; status: NoticeStatus; offline: boolean };

export type HelpView = 'sending' | 'slow' | 'offline' | 'sent' | 'delivered' | 'read' | 'notSent' | 'failed';

export function helpView(request: HelpRequest, now: number): HelpView {
  switch (request.status) {
    case NoticeStatus.Sent: return 'sent';
    case NoticeStatus.Delivered: return 'delivered';
    case NoticeStatus.Read: return 'read';
    case NoticeStatus.NotSent: return 'notSent';
    case NoticeStatus.Failed: return 'failed';
  }
  if (request.offline) {
    return 'offline';
  }
  return now - Date.parse(request.requestedAt) >= slowMs ? 'slow' : 'sending';
}

// Nothing will change it any more, so the screen stops asking.
export function isSettled(status: NoticeStatus) {
  return status === NoticeStatus.Read || status === NoticeStatus.NotSent || status === NoticeStatus.Failed;
}

// With the phone's offset, so the message to the family carries the person's own clock: "2026-11-18T14:32:00-03:00".
export function localInstant(date: Date) {
  const offset = -date.getTimezoneOffset();
  const pad = (value: number) => String(Math.floor(Math.abs(value))).padStart(2, '0');
  const local = new Date(date.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return `${local}${offset < 0 ? '-' : '+'}${pad(offset / 60)}:${pad(offset % 60)}`;
}

export function useHelpRequest(id: string | null): HelpRequest | null | undefined {
  const rows = useRows<HelpRow>('SELECT * FROM sos_requests WHERE id = ?', [id]);
  const row = rows?.[0];
  return rows && (row
    ? { id: row.id, requestedAt: row.requested_at, status: row.status, offline: row.last_error === 'connection' }
    : null);
}

// A new request, or the recent one still under way. The id makes it safe to send again until the server answers.
export async function requestHelp(again = false, now = new Date()) {
  const db = await getDatabase();
  const latest = await db.getFirstAsync<HelpRow>('SELECT * FROM sos_requests ORDER BY rowid DESC LIMIT 1');
  if (!again && latest && latest.status !== NoticeStatus.Failed &&
    now.getTime() - Date.parse(latest.requested_at) < reuseMs) {
    return latest.id;
  }
  const id = randomUUID();
  await writeTransaction(async (transaction) => {
    await transaction.runAsync('INSERT INTO sos_requests (id, requested_at) VALUES (?, ?)', id, localInstant(now));
  });
  void refreshHelpRequest(id);
  return id;
}

async function refresh(row: HelpRow) {
  let result: SosStatusModel;
  try {
    result = row.accepted
      ? await withSession((options) => sosGet(row.id, options))
      : await withSession((options) => sosSend({ id: row.id, requestedAt: row.requested_at }, options));
  } catch (error) {
    await writeTransaction(async (transaction) => {
      await transaction.runAsync(
        'UPDATE sos_requests SET last_error = ? WHERE id = ?',
        error instanceof ApiUnavailableError ? 'connection' : 'server', row.id,
      );
    });
    return;
  }
  await writeTransaction(async (transaction) => {
    await transaction.runAsync(
      'UPDATE sos_requests SET accepted = 1, status = ?, last_error = NULL WHERE id = ?', result.status, row.id,
    );
  });
}

export async function refreshHelpRequest(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<HelpRow>('SELECT * FROM sos_requests WHERE id = ?', id);
  if (row) {
    await refresh(row);
  }
}

// The requests the server hasn't settled yet, sent when the connection returns and from the background task. Unlike
// sync, a phone whose account is open on another one may still ask for help.
export async function sendHelpRequests() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<HelpRow>('SELECT * FROM sos_requests WHERE status IS NULL ORDER BY rowid');
  for (const row of rows) {
    await refresh(row);
  }
}
