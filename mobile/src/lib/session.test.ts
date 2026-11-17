import { beforeEach, expect, jest, test } from '@jest/globals';
import { Buffer } from 'node:buffer';

import { ApiError, ApiUnavailableError } from '../api/client';
import { accountDelete, authLogin, authLogout, authRefresh, syncDownload } from '../api/generated/client';
import { blockedAccountKey, clearAccountData, hasPendingChanges, restoreAccountData } from './accountData';
import { getSetting } from './db';

const mockSecure = new Map<string, string>();
const mockSet = jest.fn<(key: string, value: string) => Promise<void>>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockSecure.get(key) ?? null,
  setItemAsync: (key: string, value: string) => mockSet(key, value),
  deleteItemAsync: async (key: string) => { mockSecure.delete(key); },
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-device' }));
jest.mock('../api/generated/client', () => ({
  accountDelete: jest.fn(),
  authLogin: jest.fn(),
  authLogout: jest.fn(),
  authRefresh: jest.fn(),
  syncDownload: jest.fn(),
}));
jest.mock('./accountData', () => ({
  blockedAccountKey: 'sync_blocked_account',
  clearAccountData: jest.fn(),
  hasPendingChanges: jest.fn(),
  restoreAccountData: jest.fn(),
}));
jest.mock('./db', () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));

const token = 'header.' + Buffer.from(JSON.stringify({ sub: 'alice' })).toString('base64url') + '.signature';
const stored = {
  accountId: 'alice', suggestedName: 'Alice', accessToken: 'expired', refreshToken: 'old',
  expiresAt: 0, expired: false,
};

function load() {
  mockSecure.set('cmi.session', JSON.stringify(stored));
  mockSecure.set('cmi.device', 'old-device');
  return jest.requireActual<typeof import('./session')>('./session');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  // The session state is module-local. Keep the same mock APIs while each test imports a fresh session.
  jest.doMock('../api/client', () => ({ ApiError, ApiUnavailableError }));
  jest.doMock('../api/generated/client', () => ({ accountDelete, authLogin, authLogout, authRefresh, syncDownload }));
  jest.doMock('./accountData', () => ({ blockedAccountKey, clearAccountData, hasPendingChanges, restoreAccountData }));
  jest.doMock('./db', () => ({ getSetting, setSetting: jest.fn() }));
  mockSecure.clear();
  mockSet.mockImplementation(async (key, value) => { mockSecure.set(key, value); });
  jest.mocked(getSetting).mockResolvedValue('true');
  jest.mocked(hasPendingChanges).mockResolvedValue(false);
  jest.mocked(authLogout).mockResolvedValue(undefined);
});

test('loads an offline session and rotates its token once when requests overlap', async () => {
  const { loadSession, withSession } = load();
  expect(await loadSession()).toMatchObject({ accountId: 'alice', expired: false });
  jest.mocked(authRefresh).mockResolvedValueOnce({ accessToken: 'new', refreshToken: 'rotated', expiresIn: 900 });
  const request = async ({ headers }: RequestInit) => headers;
  await expect(Promise.all([withSession(request), withSession(request)])).resolves.toEqual([
    { Authorization: 'Bearer new' },
    { Authorization: 'Bearer new' },
  ]);
  expect(authRefresh).toHaveBeenCalledTimes(1);
  expect(JSON.parse(mockSecure.get('cmi.session')!)).toMatchObject({ refreshToken: 'rotated' });
});

test('keeps the session offline and requests login only after refresh is refused', async () => {
  const { loadSession, withSession, SessionRequiredError } = load();
  jest.mocked(authRefresh)
    .mockRejectedValueOnce(new ApiUnavailableError())
    .mockRejectedValueOnce(new ApiError(401));
  await expect(withSession(async () => undefined)).rejects.toBeInstanceOf(ApiUnavailableError);
  expect(await loadSession()).toMatchObject({ expired: false });
  await expect(withSession(async () => undefined)).rejects.toBeInstanceOf(SessionRequiredError);
  expect(await loadSession()).toMatchObject({ expired: true, accountId: 'alice' });
  expect(clearAccountData).not.toHaveBeenCalled();
});

test('uses a fresh device id after reinstall and opens the session after restoring the account', async () => {
  jest.mocked(getSetting).mockResolvedValueOnce(null);
  jest.mocked(authLogin).mockResolvedValueOnce({ accessToken: token, refreshToken: 'alice-refresh', expiresIn: 900 });
  const snapshot = { medications: [] };
  jest.mocked(syncDownload).mockResolvedValueOnce(snapshot);
  jest.mocked(restoreAccountData).mockImplementationOnce(async () => {
    expect(mockSecure.get('cmi.session')).toBeUndefined();
  });
  const { signIn, loadSession } = load();
  await expect(loadSession()).resolves.toBeNull();
  await signIn('Apple', 'provider', 'Alice');
  expect(authLogin).toHaveBeenCalledWith({ provider: 'Apple', idToken: 'provider', deviceId: 'new-device' });
  expect(syncDownload).toHaveBeenCalledWith({ headers: { Authorization: `Bearer ${token}` } });
  expect(restoreAccountData).toHaveBeenCalledWith(snapshot);
  expect(await loadSession()).toMatchObject({ accountId: 'alice', suggestedName: 'Alice' });
});

test('clears the device only after the server confirms account removal', async () => {
  const { deleteAccount, loadSession } = load();
  jest.mocked(authRefresh).mockResolvedValueOnce({ accessToken: 'new', refreshToken: 'rotated', expiresIn: 900 });
  jest.mocked(accountDelete).mockRejectedValueOnce(new ApiUnavailableError()).mockResolvedValueOnce(undefined);
  await expect(deleteAccount()).rejects.toBeInstanceOf(ApiUnavailableError);
  expect(clearAccountData).not.toHaveBeenCalled();
  expect(await loadSession()).toMatchObject({ accountId: 'alice' });
  await deleteAccount();
  expect(clearAccountData).toHaveBeenCalledTimes(1);
  expect(await loadSession()).toBeNull();
  expect(mockSecure.get('cmi.device')).toBe('old-device');
});

test('leaves the outbox and session intact when logout would discard changes', async () => {
  const { signOut, loadSession, PendingChangesError } = load();
  jest.mocked(hasPendingChanges).mockResolvedValueOnce(true);
  await expect(signOut()).rejects.toBeInstanceOf(PendingChangesError);
  expect(authLogout).not.toHaveBeenCalled();
  expect(clearAccountData).not.toHaveBeenCalled();
  expect(await loadSession()).toMatchObject({ accountId: 'alice' });
});

test('signs out a blocked phone even with changes it can no longer send', async () => {
  const { signOut, loadSession } = load();
  jest.mocked(getSetting).mockImplementation(async (key) => (key === blockedAccountKey ? 'alice' : 'true'));
  jest.mocked(hasPendingChanges).mockResolvedValueOnce(true);
  await signOut();
  expect(authLogout).toHaveBeenCalledWith({ refreshToken: 'old' });
  expect(clearAccountData).toHaveBeenCalledTimes(1);
  expect(await loadSession()).toBeNull();
});

test('treats a repeated deletion of a gone account as done', async () => {
  const { deleteAccount, loadSession } = load();
  jest.mocked(authRefresh).mockResolvedValueOnce({ accessToken: 'new', refreshToken: 'rotated', expiresIn: 900 });
  jest.mocked(accountDelete).mockRejectedValueOnce(new ApiError(404));
  await deleteAccount();
  expect(clearAccountData).toHaveBeenCalledTimes(1);
  expect(await loadSession()).toBeNull();
});

test('restores from the server when queued rows have no session behind them', async () => {
  jest.mocked(authLogin).mockResolvedValueOnce({ accessToken: token, refreshToken: 'alice-refresh', expiresIn: 900 });
  jest.mocked(hasPendingChanges).mockResolvedValueOnce(true);
  const snapshot = { medications: [] };
  jest.mocked(syncDownload).mockResolvedValueOnce(snapshot);
  const { signIn, loadSession } = load();
  mockSecure.delete('cmi.session');
  await signIn('Google', 'provider', null);
  expect(restoreAccountData).toHaveBeenCalledWith(snapshot);
  expect(await loadSession()).toMatchObject({ accountId: 'alice' });
});

test('finishes cleaning account data after the app closed during logout', async () => {
  const { loadSession } = load();
  mockSecure.set('cmi.session', 'clear');
  await expect(loadSession()).resolves.toBeNull();
  expect(clearAccountData).toHaveBeenCalledTimes(1);
  expect(mockSecure.get('cmi.session')).toBeUndefined();
});
