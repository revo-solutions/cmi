import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, createStaticNavigation, type StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BookOpen, House, Phone, Pill, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText } from './components/AppText';
import { Button } from './components/Button';
import { Screen } from './components/Screen';
import { ArticleScreen } from './features/articles/ArticleScreen';
import { ArticlesScreen } from './features/articles/ArticlesScreen';
import { DeviceConflictScreen } from './features/auth/DeviceConflictScreen';
import { SignInScreen } from './features/auth/SignInScreen';
import { ContactScreen } from './features/contact/ContactScreen';
import { WhatsAppLinkScreen } from './features/contact/WhatsAppLinkScreen';
import { HistoryScreen } from './features/medications/HistoryScreen';
import { MedicationFormScreen } from './features/medications/MedicationFormScreen';
import { MedicationsScreen } from './features/medications/MedicationsScreen';
import { ReminderScreen } from './features/medications/ReminderScreen';
import { AboutScreen } from './features/profile/AboutScreen';
import { HealthScreen } from './features/profile/HealthScreen';
import { PhonesScreen } from './features/phones/PhonesScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { hasHealthAnswers, useProfile } from './features/profile/store';
import {
  askHealthLater, firstSetupStep, saveSetupStep, SetupContext, useNeedsSetup, useSetupDone, useStoredSetupStep,
  type SetupStep,
} from './features/setup/setup';
import { SetupScreen } from './features/setup/SetupScreen';
import { SosScreen } from './features/sos/SosScreen';
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
    Phones: { screen: PhonesScreen, options: tab('Telefones', Phone) },
    Articles: { screen: ArticlesScreen, options: tab('Artigos', BookOpen) },
  },
});

// Screens draw their own header (components/Screen), so it grows with the system font and the large-text mode.
// Until setup is done only its screen exists; the first screen of the group shown is where the app opens.
const RootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false, contentStyle: { backgroundColor: colors.surface } },
  groups: {
    Setup: {
      if: useNeedsSetup,
      screens: { Setup: SetupScreen },
    },
    App: {
      if: useSetupDone,
      screens: {
        Tabs,
        Profile: ProfileScreen,
        ProfileAbout: AboutScreen,
        ProfileHealth: HealthScreen,
        History: HistoryScreen,
        Contact: ContactScreen,
        WhatsAppLink: WhatsAppLinkScreen,
        Sos: SosScreen,
        Article: ArticleScreen,
      },
    },
    Shared: {
      screens: {
        MedicationForm: MedicationFormScreen,
        Reminder: ReminderScreen,
        DeviceConflict: DeviceConflictScreen,
      },
    },
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
  const profile = useProfile();
  const storedStep = useStoredSetupStep(accountId);
  const step = storedStep ?? (profile && firstSetupStep(profile));
  const setup = useMemo(() => step && {
    step,
    setStep: (next: SetupStep) => {
      saveSetupStep(accountId, next).catch((error: unknown) => console.warn('Não foi possível salvar a configuração.', error));
    },
  }, [accountId, step]);

  // The first step is worked out once, so saving the profile doesn't move setup along by itself.
  useEffect(() => {
    if (storedStep === null && profile) {
      const first = firstSetupStep(profile);
      void saveSetupStep(accountId, first);
      if (first === 'permissions' && !hasHealthAnswers(profile)) {
        void askHealthLater(accountId);
      }
    }
  }, [accountId, storedStep, profile]);

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

  if (!setup) {
    return null;
  }
  return (
    <SetupContext.Provider value={setup}>
      <Navigation ref={navigation} onReady={() => {
        openReminder(waiting);
        if (blocked) {
          navigation.navigate('DeviceConflict');
        }
      }} />
    </SetupContext.Provider>
  );
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
