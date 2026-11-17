import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, createStaticNavigation, type StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { House, Pill, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText } from './components/AppText';
import { Button } from './components/Button';
import { Screen } from './components/Screen';
import { DeviceConflictScreen } from './features/auth/DeviceConflictScreen';
import { SignInScreen } from './features/auth/SignInScreen';
import { HistoryScreen } from './features/medications/HistoryScreen';
import { MedicationFormScreen } from './features/medications/MedicationFormScreen';
import { MedicationsScreen } from './features/medications/MedicationsScreen';
import { ReminderScreen } from './features/medications/ReminderScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { TodayScreen } from './features/today/TodayScreen';
import { DisplayModeProvider } from './lib/displayMode';
import { useHeartbeat } from './lib/heartbeat';
import { onReminderOpened, reconcileReminders, recoverPendingAction, setUpReminders } from './lib/reminders';
import { loadSession, useSession } from './lib/session';
import { useOutboxSync, useSyncBlocked } from './lib/sync';
import { colors, maxFontScale } from './theme';

function tab(title: string, Icon: LucideIcon) {
  return {
    title,
    tabBarAccessibilityLabel: title,
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
      <View style={[styles.indicator, focused && styles.active]}>
        <Icon size={26} strokeWidth={2.5} color={color} />
      </View>
    ),
    tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) => (
      <AppText variant="support" bold={focused} color={color} maxFontSizeMultiplier={maxFontScale.tab} numberOfLines={1}>
        {title}
      </AppText>
    ),
  };
}

// Tabs come as their features do: Telefones and Artigos with phase 8 (docs/plano-app.md).
const Tabs = createBottomTabNavigator({
  screenOptions: {
    headerShown: false,
    tabBarActiveTintColor: colors.orchid800,
    tabBarInactiveTintColor: colors.graphite,
    tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.divider, minHeight: 76 },
    tabBarItemStyle: { paddingVertical: 6 },
  },
  screens: {
    Today: { screen: TodayScreen, options: tab('Hoje', House) },
    Medications: { screen: MedicationsScreen, options: tab('Remédios', Pill) },
  },
});

// Screens draw their own header (components/Screen), so it grows with the system font and the large-text mode.
const RootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false, contentStyle: { backgroundColor: colors.surface } },
  screens: {
    Tabs,
    Profile: ProfileScreen,
    MedicationForm: MedicationFormScreen,
    History: HistoryScreen,
    Reminder: ReminderScreen,
    DeviceConflict: DeviceConflictScreen,
  },
});

const Navigation = createStaticNavigation(RootStack);

type RootStackParamList = StaticParamList<typeof RootStack>;

const navigation = createNavigationContainerRef<RootStackParamList>();

type OpenedReminder = { medicationId: string; date: string; time: string };

// A tap that launched the app arrives before the navigation is ready, so it waits here for onReady.
let waiting: OpenedReminder | null = null;

function openReminder(reminder: OpenedReminder | null) {
  if (reminder && navigation.isReady()) {
    navigation.navigate('Reminder', reminder);
    waiting = null;
  } else {
    waiting = reminder;
  }
}

function AccountNavigation({ accountId }: { accountId: string }) {
  const blocked = useSyncBlocked(accountId);

  useEffect(() => {
    setUpReminders()
      .then(recoverPendingAction)
      .then(reconcileReminders)
      .catch((error: unknown) => console.warn('Não foi possível preparar os lembretes.', error));
    const unsubscribe = onReminderOpened(({ medicationId, date, time }) => openReminder({ medicationId, date, time }));
    // Coming back from the system settings may have just allowed the notifications.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reconcileReminders().catch((error: unknown) => console.warn('Não foi possível preparar os lembretes.', error));
      }
    });
    return () => {
      unsubscribe();
      appState.remove();
      waiting = null;
    };
  }, []);

  useEffect(() => {
    if (blocked && navigation.isReady()) {
      navigation.navigate('DeviceConflict');
    }
  }, [blocked]);

  return <Navigation ref={navigation} onReady={() => {
    openReminder(waiting);
    if (blocked) {
      navigation.navigate('DeviceConflict');
    }
  }} />;
}

function SessionNavigation() {
  const session = useSession();
  const [failed, setFailed] = useState(false);
  const accountId = session && !session.expired ? session.accountId : undefined;
  useHeartbeat(accountId);
  useOutboxSync(accountId);

  function open() {
    loadSession().catch(() => setFailed(true));
  }

  useEffect(open, []);

  if (session === undefined) {
    return (
      <Screen title="Central Melhor Idade">
        {failed ? (
          <>
            <AppText accessibilityRole="alert">Não foi possível abrir o aplicativo.</AppText>
            <Button label="Tentar novamente" onPress={() => { setFailed(false); open(); }} />
          </>
        ) : <AppText accessibilityLiveRegion="polite">Carregando…</AppText>}
      </Screen>
    );
  }
  return accountId ? <AccountNavigation key={accountId} accountId={accountId} /> : <SignInScreen />;
}

export function AppNavigation() {
  return (
    <DisplayModeProvider>
      <SessionNavigation />
    </DisplayModeProvider>
  );
}

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

const styles = StyleSheet.create({
  indicator: {
    width: 56,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.orchid100,
  },
});
