import {
  addNotificationResponseReceivedListener,
  AndroidImportance,
  cancelScheduledNotificationAsync,
  clearLastNotificationResponse,
  DEFAULT_ACTION_IDENTIFIER,
  dismissNotificationAsync,
  getAllScheduledNotificationsAsync,
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
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { localDate } from '../features/medications/doses';
import {
  dailyReminders,
  parseIdentifier,
  planReminders,
  reminderText,
  snoozeIdentifier,
  snoozeMinutes,
  type ReminderKey,
} from '../features/medications/reminderPlan';
import { isDoseTaken, listMedications, recordDose } from '../features/medications/store';

// The one interface between the app and the system's notifications (AGENTS.md, "Mobile"). Reminders are local and
// work offline: a daily repeating trigger per medication and time, with "Tomei" and "Lembrar depois".
const channel = 'medicamentos';
const category = 'dose';
const task = 'dose-actions';
const takeAction = 'take';
const snoozeAction = 'snooze';

export type ReminderPermission = 'granted' | 'notifications-denied' | 'exact-alarm-denied';

export async function setUpReminders() {
  if (Platform.OS === 'android') {
    // A channel's importance can't change after it is created.
    await setNotificationChannelAsync(channel, { name: 'Lembretes de remédios', importance: AndroidImportance.HIGH });
    await registerTaskAsync(task);
  }

  await setNotificationCategoryAsync(category, [
    { identifier: takeAction, buttonTitle: 'Tomei', options: { opensAppToForeground: false } },
    { identifier: snoozeAction, buttonTitle: 'Lembrar depois', options: { opensAppToForeground: false } },
  ]);
}

export async function reminderPermission(ask: boolean): Promise<ReminderPermission> {
  let notifications = await getPermissionsAsync();
  if (ask && !notifications.granted && notifications.canAskAgain) {
    notifications = await requestPermissionsAsync();
  }
  if (!notifications.granted) {
    return 'notifications-denied';
  }

  if (Platform.OS === 'android') {
    let exactAlarm = await getExactAlarmPermissionsAsync();
    if (ask && !exactAlarm.granted && exactAlarm.canAskAgain) {
      exactAlarm = await requestExactAlarmPermissionsAsync();
    }
    if (!exactAlarm.granted) {
      return 'exact-alarm-denied';
    }
  }

  return 'granted';
}

// Makes the scheduled daily reminders match the medications. Call it on opening and after every change.
export async function reconcileReminders() {
  const wanted = dailyReminders(await listMedications());
  const scheduled = (await getAllScheduledNotificationsAsync()).map((request) => ({
    identifier: request.identifier,
    title: request.content.title ?? '',
    body: request.content.body ?? '',
  }));
  const plan = planReminders(wanted, scheduled);

  for (const identifier of plan.cancel) {
    await cancelScheduledNotificationAsync(identifier);
  }
  for (const reminder of plan.schedule) {
    const [hour, minute] = reminder.time.split(':').map(Number);
    await scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: { title: reminder.title, body: reminder.body, categoryIdentifier: category, sound: 'default', interruptionLevel: 'timeSensitive' },
      trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: channel, delivery: 'alarmClock' },
    });
  }
}

// "Tomei" from Hoje, the reminder screen, the history or the notification: records the dose and clears its
// notification and any snooze left for it.
export async function takeDose(medicationId: string, date: string, time: string) {
  await recordDose(medicationId, date, time, new Date().toISOString());
  await cancelScheduledNotificationAsync(snoozeIdentifier(medicationId, date, time));
}

export async function undoDose(medicationId: string, date: string, time: string) {
  await recordDose(medicationId, date, time, null);
}

// "Lembrar depois": one more reminder for the same dose, which keeps its original time.
export async function snoozeDose({ medicationId, time, date }: ReminderKey & { date: string }) {
  const medication = (await listMedications()).find((m) => m.id === medicationId);
  if (!medication) {
    return;
  }

  await scheduleNotificationAsync({
    identifier: snoozeIdentifier(medicationId, date, time),
    content: { ...reminderText(medication, time), categoryIdentifier: category, sound: 'default', interruptionLevel: 'timeSensitive' },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: Date.now() + snoozeMinutes * 60_000, channelId: channel, delivery: 'alarmClock' },
  });
}

// The dose a notification is about. A daily reminder's day is the day it rang; a snooze carries its dose's day.
export function doseOf(response: NotificationResponse): (ReminderKey & { date: string }) | null {
  const key = parseIdentifier(response.notification.request.identifier);
  return key ? { ...key, date: key.date ?? localDate(new Date(response.notification.date)) } : null;
}

async function handleAction(response: NotificationResponse) {
  const dose = doseOf(response);
  if (!dose || (response.actionIdentifier !== takeAction && response.actionIdentifier !== snoozeAction)) {
    return;
  }

  if (response.actionIdentifier === takeAction) {
    await takeDose(dose.medicationId, dose.date, dose.time);
  } else {
    await snoozeDose(dose);
  }

  // Android leaves the notification in the tray after an action button.
  await dismissNotificationAsync(response.notification.request.identifier);
  if (getLastNotificationResponse()?.notification.request.identifier === response.notification.request.identifier) {
    clearLastNotificationResponse();
  }
}

// A tap on the notification itself opens the reminder screen; the navigation listens here.
const openListeners = new Set<(dose: ReminderKey & { date: string }) => void>();

export function onReminderOpened(listener: (dose: ReminderKey & { date: string }) => void) {
  openListeners.add(listener);

  // The tap that launched a closed app arrives before anyone listened.
  const launch = getLastNotificationResponse();
  const dose = launch?.actionIdentifier === DEFAULT_ACTION_IDENTIFIER ? doseOf(launch) : null;
  if (launch && dose) {
    clearLastNotificationResponse();
    listener(dose);
  }

  return () => {
    openListeners.delete(listener);
  };
}

// An action that came in while the app was closed and that no task handled is applied on the next opening.
export async function recoverPendingAction() {
  const response = getLastNotificationResponse();
  if (response && response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) {
    await handleAction(response);
  }
}

addNotificationResponseReceivedListener((response) => {
  if (response.actionIdentifier === DEFAULT_ACTION_IDENTIFIER) {
    const dose = doseOf(response);
    if (dose) {
      openListeners.forEach((listener) => listener(dose));
    }
    return;
  }

  // Android may deliver the same action to the task and to this listener; recording a dose is idempotent.
  handleAction(response).catch((error: unknown) => console.warn('Não foi possível salvar a ação do lembrete.', error));
});

TaskManager.defineTask<NotificationTaskPayload>(task, async ({ data, error }) => {
  if (error) {
    console.warn('A tarefa de notificações falhou.', error);
  } else if (data && 'actionIdentifier' in data) {
    await handleAction(data);
  }
});

// With the app open, a reminder for a dose already taken stays quiet.
setNotificationHandler({
  handleNotification: async (notification) => {
    const key = parseIdentifier(notification.request.identifier);
    const taken = key ? await isDoseTaken(key.medicationId, key.date ?? localDate(new Date(notification.date)), key.time) : false;

    return { shouldShowBanner: !taken, shouldShowList: !taken, shouldPlaySound: !taken, shouldSetBadge: false };
  },
});
