import { randomUUID } from 'expo-crypto';
import {
  addNotificationResponseReceivedListener,
  AndroidImportance,
  clearLastNotificationResponse,
  dismissNotificationAsync,
  getExactAlarmPermissionsAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  registerTaskAsync,
  requestExactAlarmPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationCategoryAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationResponse,
  type NotificationTaskPayload,
} from 'expo-notifications';
import { openDatabaseAsync } from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';

// A channel's importance can't change after it is created, so the test already uses the app's final channel.
const channel = 'medicamentos';
const category = 'reminder-test';
const task = 'reminder-test-actions';
const takeAction = 'reminder-test-take';
const snoozeAction = 'reminder-test-snooze';
export const testDelayMinutes = 1;
const testDelayMs = testDelayMinutes * 60_000;

type RecordSource = 'background-task' | 'background-event' | 'inactive-event' | 'active-event' | 'startup';

export type ReminderTest = {
  id: string;
  revision: number;
  scheduledAt: number;
  takenAt: number | null;
  source: RecordSource | null;
};

async function openDatabase() {
  const db = await openDatabaseAsync('cmi-reminders.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reminder_tests (
      id TEXT PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      scheduled_at INTEGER NOT NULL,
      taken_at INTEGER,
      source TEXT
    );
  `);
  return db;
}

let database: ReturnType<typeof openDatabase> | undefined;

function getDatabase() {
  return database ??= openDatabase().catch((error: unknown) => {
    database = undefined;
    throw error;
  });
}

const listeners = new Set<() => void>();
let pendingWrite = Promise.resolve();

function enqueueWrite(write: () => Promise<void>) {
  const result = pendingWrite.then(write);
  pendingWrite = result.then(() => undefined, () => undefined);
  return result;
}

export function onReminderTestChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getLatestReminderTest() {
  const db = await getDatabase();
  return db.getFirstAsync<ReminderTest>(`
    SELECT id, revision, scheduled_at AS scheduledAt, taken_at AS takenAt, source
    FROM reminder_tests ORDER BY rowid DESC LIMIT 1
  `);
}

export async function scheduleReminderTest() {
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync(channel, {
      name: 'Lembretes de medicamentos',
      importance: AndroidImportance.HIGH,
    });
  }

  let permission = await getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await requestPermissionsAsync();
  }
  if (!permission.granted) {
    return 'notifications-disabled';
  }

  if (Platform.OS === 'android') {
    let exactAlarm = await getExactAlarmPermissionsAsync();
    if (!exactAlarm.granted && exactAlarm.canAskAgain) {
      exactAlarm = await requestExactAlarmPermissionsAsync();
    }
    if (!exactAlarm.granted) {
      return 'exact-alarm-disabled';
    }

    await registerTaskAsync(task);
  }

  await setNotificationCategoryAsync(category, [
    { identifier: takeAction, buttonTitle: 'Tomei', options: { opensAppToForeground: false } },
    { identifier: snoozeAction, buttonTitle: 'Lembrar depois', options: { opensAppToForeground: false } },
  ]);

  await enqueueWrite(async () => {
    const db = await getDatabase();
    const id = randomUUID();
    const scheduledAt = Date.now() + testDelayMs;
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('INSERT INTO reminder_tests (id, scheduled_at) VALUES (?, ?)', id, scheduledAt);
      await scheduleNotification(id, 0, scheduledAt);
    });
  });
  return 'scheduled';
}

async function scheduleNotification(id: string, revision: number, scheduledAt: number) {
  await scheduleNotificationAsync({
    identifier: `${id}:${revision}`,
    content: {
      title: 'Lembrete de teste',
      body: 'Use “Tomei” para testar o registro ou adie com “Lembrar depois”.',
      categoryIdentifier: category,
      sound: 'default',
      interruptionLevel: 'timeSensitive',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: scheduledAt,
      channelId: channel,
      delivery: 'alarmClock',
    },
  });
}

export async function recoverPendingReminderResponse() {
  const response = getLastNotificationResponse();
  if (response) {
    await handleResponse(response, 'startup');
  }
}

function handleResponse(response: NotificationResponse, source: RecordSource) {
  const { actionIdentifier, notification } = response;
  if (actionIdentifier !== takeAction && actionIdentifier !== snoozeAction) {
    return Promise.resolve();
  }

  // Android's background task receives the native dataString instead of the listener's parsed data.
  const { identifier } = notification.request;
  const reminder = /^([^:]+):([0-9]+)$/.exec(identifier);
  if (!reminder) {
    return Promise.resolve();
  }

  const [, id, revisionText] = reminder;
  const revision = Number(revisionText);
  if (!Number.isSafeInteger(revision)) {
    return Promise.resolve();
  }

  // Android can deliver the same action to both the notification task and the listener.
  return enqueueWrite(async () => {
    const db = await getDatabase();
    if (actionIdentifier === takeAction) {
      await db.runAsync(`
        UPDATE reminder_tests SET taken_at = ?, source = ?
        WHERE id = ? AND revision = ? AND taken_at IS NULL
      `, Date.now(), source, id, revision);
    } else {
      const scheduledAt = Date.now() + testDelayMs;
      await db.withExclusiveTransactionAsync(async (transaction) => {
        const result = await transaction.runAsync(`
          UPDATE reminder_tests SET revision = revision + 1, scheduled_at = ?
          WHERE id = ? AND revision = ? AND taken_at IS NULL
        `, scheduledAt, id, revision);
        if (result.changes > 0) {
          await scheduleNotification(id, revision + 1, scheduledAt);
        }
      });
    }

    // Android leaves the notification in the tray after an action button.
    await dismissNotificationAsync(identifier);

    const lastResponse = getLastNotificationResponse();
    if (lastResponse?.notification.request.identifier === identifier && lastResponse.actionIdentifier === actionIdentifier) {
      clearLastNotificationResponse();
    }
    listeners.forEach((listener) => listener());
  });
}

addNotificationResponseReceivedListener((response) => {
  const source = AppState.currentState === 'background' ? 'background-event'
    : AppState.currentState === 'active' ? 'active-event' : 'inactive-event';
  void handleResponse(response, source).catch((error: unknown) => {
    console.warn('Não foi possível salvar a ação do lembrete.', error);
  });
});

TaskManager.defineTask<NotificationTaskPayload>(task, async ({ data, error }) => {
  if (error) {
    console.warn('A tarefa de notificações falhou.', error);
  } else if (data && 'actionIdentifier' in data) {
    await handleResponse(data, 'background-task');
  }
});

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
