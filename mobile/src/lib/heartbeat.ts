import * as BackgroundTask from 'expo-background-task';
import Constants from 'expo-constants';
import {
  BackgroundNotificationTaskResult,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  registerTaskAsync,
  type NotificationTaskPayload,
} from 'expo-notifications';
import { defineTask, isTaskRegisteredAsync } from 'expo-task-manager';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { DevicePlatform, syncHeartbeat } from '../api/generated/client';
import { getSetting, setSetting } from './db';
import { loadSession, withSession } from './session';

const periodicTask = 'cmi-background';
const pingTask = 'cmi-push-ping';
const pushTokenKey = 'expo_push_token';
const backgroundInterval = 15;
const platform = Platform.OS === 'ios' ? DevicePlatform.Ios : DevicePlatform.Android;
let sending: Promise<boolean> | undefined;

async function send() {
  const session = await loadSession();
  if (!session || session.expired) {
    return false;
  }
  const pushToken = await getSetting(pushTokenKey) || null;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await withSession((options) => syncHeartbeat({ platform, timeZone, pushToken }, options));
  return true;
}

function sendHeartbeat() {
  sending ??= send().finally(() => { sending = undefined; });
  return sending;
}

defineTask(periodicTask, async () => {
  try {
    await sendHeartbeat();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

function isPing(payload: NotificationTaskPayload | undefined) {
  if (!payload || 'actionIdentifier' in payload) {
    return false;
  }
  if (payload.data?.type === 'ping') {
    return true;
  }
  try {
    return !!payload.data?.dataString && JSON.parse(payload.data.dataString)?.type === 'ping';
  } catch {
    return false;
  }
}

defineTask<NotificationTaskPayload>(pingTask, async ({ data, error }) => {
  if (error || !isPing(data)) {
    return BackgroundNotificationTaskResult.NoData;
  }
  try {
    return await sendHeartbeat() ? BackgroundNotificationTaskResult.NewData : BackgroundNotificationTaskResult.NoData;
  } catch {
    return BackgroundNotificationTaskResult.Failed;
  }
});

function pushConfigured() {
  return Platform.OS === 'ios' || Constants.expoConfig?.extra?.androidPushConfigured === true;
}

async function registerTasks() {
  if (await BackgroundTask.getStatusAsync() === BackgroundTask.BackgroundTaskStatus.Available &&
    !await isTaskRegisteredAsync(periodicTask)) {
    await BackgroundTask.registerTaskAsync(periodicTask, { minimumInterval: backgroundInterval });
  }
  if (pushConfigured() && !await isTaskRegisteredAsync(pingTask)) {
    await registerTaskAsync(pingTask);
  }
}

let registeringPush: Promise<void> | undefined;

async function updatePushToken() {
  const previous = await getSetting(pushTokenKey);
  const permitted = pushConfigured() && (await getPermissionsAsync()).granted;
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  const token = permitted && projectId ? (await getExpoPushTokenAsync({ projectId })).data : '';
  if (token !== (previous ?? '')) {
    await setSetting(pushTokenKey, token);
    await sending?.catch(() => undefined);
    await sendHeartbeat();
  }
}

function onForeground() {
  void sendHeartbeat().catch(() => undefined);
  registeringPush ??= updatePushToken().catch(() => undefined).finally(() => { registeringPush = undefined; });
}

export function useHeartbeat(accountId: string | undefined) {
  useEffect(() => {
    if (!accountId) {
      return;
    }
    onForeground();
    void registerTasks().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        onForeground();
      }
    });
    return () => subscription.remove();
  }, [accountId]);
}
