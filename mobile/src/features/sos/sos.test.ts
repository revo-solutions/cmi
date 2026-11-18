import { beforeEach, expect, jest, test } from '@jest/globals';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { ApiUnavailableError } from '../../api/client';
import { NoticeStatus, SosNotSentReason, sosGet, sosSend } from '../../api/generated/client';
import { migrations } from '../../lib/db';
import {
  helpView, localInstant, refreshHelpRequest, requestHelp, reuseMs, sendHelpRequests, slowMs, type HelpRequest,
} from './sos';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID }));
jest.mock('../../api/generated/client', () => ({
  ...jest.requireActual<object>('../../api/generated/client'),
  sosSend: jest.fn(),
  sosGet: jest.fn(),
}));
jest.mock('../../lib/session', () => ({
  withSession: (request: (options: RequestInit) => Promise<unknown>) => request({}),
}));

let mockSql: DatabaseSync;

jest.mock('../../lib/db', () => {
  const db = {
    getAllAsync: async (query: string, ...args: SQLInputValue[]) => mockSql.prepare(query).all(...args),
    getFirstAsync: async (query: string, ...args: SQLInputValue[]) => mockSql.prepare(query).get(...args),
    runAsync: async (query: string, ...args: SQLInputValue[]) => mockSql.prepare(query).run(...args),
  };
  return {
    migrations: jest.requireActual<typeof import('../../lib/db')>('../../lib/db').migrations,
    getDatabase: async () => db,
    writeTransaction: async (change: (transaction: typeof db) => Promise<void>) => change(db),
  };
});

const send = jest.mocked(sosSend);
const get = jest.mocked(sosGet);

function rows() {
  return mockSql.prepare('SELECT id, accepted, status, last_error FROM sos_requests ORDER BY rowid').all();
}

beforeEach(() => {
  mockSql = new DatabaseSync(':memory:');
  migrations.forEach((sql) => mockSql.exec(sql));
  send.mockReset();
  get.mockReset();
  send.mockImplementation(async ({ id }) => ({ id, status: null }));
});

const asked = '2026-11-18T14:32:00-03:00';
const request = (status: HelpRequest['status'], offline = false): HelpRequest =>
  ({ id: 'sos', requestedAt: asked, status, offline, located: false, reason: null });

test('a request reads as its delivery status, and as slow or offline while the server has none', () => {
  const at = Date.parse(asked);
  expect(helpView(request(null), at)).toBe('sending');
  expect(helpView(request(null), at + slowMs)).toBe('slow');
  expect(helpView(request(null, true), at)).toBe('offline');
  expect(helpView(request(NoticeStatus.Delivered, true), at)).toBe('delivered');
  expect(helpView(request(NoticeStatus.NotSent), at)).toBe('notSent');
});

test('the instant keeps the phone clock and its offset', () => {
  const now = new Date('2026-11-18T17:32:45.678Z');
  const instant = localInstant(now);
  expect(instant).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  expect(Date.parse(instant)).toBe(Date.parse('2026-11-18T17:32:45Z'));
});

test('opening SOS again soon shows the same request, unless it failed or the person asks again', async () => {
  const now = new Date();
  const first = await requestHelp(false, now);
  expect(await requestHelp(false, new Date(now.getTime() + reuseMs - 1000))).toBe(first);
  expect(await requestHelp(false, new Date(now.getTime() + reuseMs + 1000))).not.toBe(first);

  const again = await requestHelp(true, now);
  mockSql.prepare('UPDATE sos_requests SET status = ? WHERE id = ?').run(NoticeStatus.Failed, again);
  expect(await requestHelp(false, now)).not.toBe(again);
});

test('a new request carries the position, and a reused one does not wait for it', async () => {
  const id = await requestHelp(false, new Date(), Promise.resolve({ latitude: -23.55, longitude: -46.63 }));
  await refreshHelpRequest(id);
  expect(send).toHaveBeenLastCalledWith(
    expect.objectContaining({ id, latitude: -23.55, longitude: -46.63 }), {},
  );

  expect(await requestHelp(false, new Date(), new Promise(() => undefined))).toBe(id);
});

test('without a position the request goes all the same', async () => {
  const id = await requestHelp(true, new Date(), Promise.resolve(null));
  await refreshHelpRequest(id);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ id, latitude: null, longitude: null }), {});
});

test('a request waits offline, then is sent with its id and read back once the server has it', async () => {
  send.mockRejectedValue(new ApiUnavailableError());
  const id = await requestHelp();
  await refreshHelpRequest(id);
  expect(rows()).toEqual([{ id, accepted: 0, status: null, last_error: 'connection' }]);

  send.mockImplementation(async (model) => ({ id: model.id, status: null }));
  await sendHelpRequests();
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ id }), {});
  expect(rows()).toEqual([{ id, accepted: 1, status: null, last_error: null }]);

  get.mockResolvedValueOnce({ id, status: NoticeStatus.Sent });
  await sendHelpRequests();
  expect(rows()).toEqual([{ id, accepted: 1, status: NoticeStatus.Sent, last_error: null }]);

  await sendHelpRequests();
  expect(get).toHaveBeenCalledTimes(1);
});

test('a request the server did not send keeps why', async () => {
  send.mockImplementation(async ({ id }) => ({ id, status: NoticeStatus.NotSent, reason: SosNotSentReason.NoPremium }));
  const id = await requestHelp();
  await refreshHelpRequest(id);
  expect(mockSql.prepare('SELECT status, reason FROM sos_requests WHERE id = ?').get(id))
    .toEqual({ status: NoticeStatus.NotSent, reason: SosNotSentReason.NoPremium });
});
