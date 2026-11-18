import { randomUUID } from 'expo-crypto';
import { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { ApiError } from '../api/client';
import {
  accountDelete, authDevLogin, authLogin, authLogout, authRefresh, syncDownload, type LoginProvider, type TokenResponse,
} from '../api/generated/client';
import { blockedAccountKey, clearAccountData, hasPendingChanges, restoreAccountData } from './accountData';
import { getSetting, setSetting } from './db';

const deviceKey = 'cmi.device';
const sessionKey = 'cmi.session';
const installationKey = 'installation_initialized';
const secureOptions = { keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

type Session = {
  accountId: string;
  suggestedName: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  expired: boolean;
};

export class SessionRequiredError extends Error {}
export class PendingChangesError extends Error {}

let session: Session | null | undefined;
let loading: Promise<Session | null> | undefined;
let refreshing: Promise<Session> | undefined;
let closing = false;
const listeners = new Set<() => void>();

function publish(next: Session | null) {
  session = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => session);
}

async function readSession() {
  // The iOS Keychain can survive reinstall. The SQLite marker belongs to this installation.
  if (!await getSetting(installationKey)) {
    await deleteItemAsync(sessionKey);
    await setItemAsync(deviceKey, randomUUID(), secureOptions);
    await setSetting(installationKey, 'true');
  }
  const stored = await getItemAsync(sessionKey);
  if (stored === 'clear') {
    await clearAccountData();
    await deleteItemAsync(sessionKey);
  }
  const next = stored && stored !== 'clear' ? JSON.parse(stored) as Session : null;
  publish(next);
  return next;
}

export function loadSession() {
  if (session !== undefined) {
    return Promise.resolve(session);
  }
  loading ??= readSession().finally(() => { loading = undefined; });
  return loading;
}

export async function localAccountId() {
  const current = await loadSession();
  return closing ? undefined : current?.accountId;
}

export function canEditAccount(accountId: string | undefined) {
  return !closing && !!accountId && session?.accountId === accountId;
}

async function saveSession(next: Session) {
  await setItemAsync(sessionKey, JSON.stringify(next), secureOptions);
  publish(next);
  return next;
}

function accountIdOf(accessToken: string) {
  const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const { sub } = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))) as { sub?: unknown };
  if (typeof sub !== 'string' || !sub) {
    throw new Error('Resposta de sessão inválida.');
  }
  return sub;
}

function withTokens(data: TokenResponse, accountId: string, suggestedName: string | null): Session {
  return {
    accountId,
    suggestedName,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1_000,
    expired: false,
  };
}

function bearer(accessToken: string): RequestInit {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export function signIn(provider: LoginProvider, idToken: string, suggestedName: string | null) {
  return startSession((deviceId) => authLogin({ provider, idToken, deviceId }), suggestedName);
}

export function signInDev() {
  return startSession((deviceId) => authDevLogin({ deviceId }), 'Conta de teste');
}

async function startSession(authenticate: (deviceId: string) => Promise<TokenResponse>, suggestedName: string | null) {
  const previous = await loadSession();
  if (closing || (previous && !previous.expired)) {
    throw new SessionRequiredError();
  }
  let deviceId = await getItemAsync(deviceKey);
  if (!deviceId) {
    deviceId = randomUUID();
    await setItemAsync(deviceKey, deviceId, secureOptions);
  }
  const tokens = await authenticate(deviceId);
  try {
    const accountId = accountIdOf(tokens.accessToken);
    const sameAccount = previous?.accountId === accountId;
    const pending = await hasPendingChanges();
    if (pending && previous && !sameAccount) {
      throw new PendingChangesError();
    }
    // With no session, a queue can only come from a backup of another installation: the server's copy wins.
    if (!pending || !sameAccount) {
      await restoreAccountData(await syncDownload(bearer(tokens.accessToken)));
    }
    await saveSession(withTokens(tokens, accountId, suggestedName ?? (sameAccount ? previous.suggestedName : null)));
  } catch (error) {
    await authLogout({ refreshToken: tokens.refreshToken }).catch(() => undefined);
    throw error;
  }
}

async function refresh(previous: Session) {
  const current = await loadSession();
  if (!current || current.expired || current.accountId !== previous.accountId) {
    throw new SessionRequiredError();
  }
  if (current.refreshToken !== previous.refreshToken) {
    return current;
  }

  refreshing ??= (async () => {
    try {
      const tokens = await authRefresh({ refreshToken: current.refreshToken });
      return await saveSession(withTokens(tokens, current.accountId, current.suggestedName));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await saveSession({ ...current, expired: true });
        throw new SessionRequiredError();
      }
      throw error;
    }
  })().finally(() => { refreshing = undefined; });
  return refreshing;
}

async function requestWithSession<T>(request: (options: RequestInit) => Promise<T>, duringClose: boolean) {
  const current = await loadSession();
  if (!current || current.expired || (closing && !duringClose)) {
    throw new SessionRequiredError();
  }
  if (Date.now() >= current.expiresAt) {
    const renewed = await refresh(current);
    if (closing && !duringClose) {
      throw new SessionRequiredError();
    }
    return request(bearer(renewed.accessToken));
  }
  try {
    return await request(bearer(current.accessToken));
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || (closing && !duringClose)) {
      throw error;
    }
    const renewed = await refresh(current);
    if (closing && !duringClose) {
      throw new SessionRequiredError();
    }
    return request(bearer(renewed.accessToken));
  }
}

export function withSession<T>(request: (options: RequestInit) => Promise<T>) {
  return requestWithSession(request, false);
}

async function closeAccount(remove: boolean) {
  if (closing) {
    throw new SessionRequiredError();
  }
  closing = true;
  try {
    await refreshing?.catch(() => undefined);
    const current = await loadSession();
    if (!current) {
      throw new SessionRequiredError();
    }
    if (remove) {
      // A 404 is a deletion whose answer was lost: the account is already gone.
      await requestWithSession(accountDelete, true).catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 404) {
          throw error;
        }
      });
    } else {
      // A blocked phone can't send its queue, and taking the account back would discard it anyway.
      if (await hasPendingChanges() && await getSetting(blockedAccountKey) !== current.accountId) {
        throw new PendingChangesError();
      }
      await authLogout({ refreshToken: current.refreshToken });
    }

    await setItemAsync(sessionKey, 'clear', secureOptions);
    try {
      await clearAccountData();
      await deleteItemAsync(sessionKey);
    } finally {
      publish(null);
    }
  } finally {
    closing = false;
  }
}

export function signOut() {
  return closeAccount(false);
}

export function deleteAccount() {
  return closeAccount(true);
}
