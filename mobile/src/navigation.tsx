import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, createStaticNavigation, type StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { House, Pill, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './components/AppText';
import { HistoryScreen } from './features/medications/HistoryScreen';
import { MedicationFormScreen } from './features/medications/MedicationFormScreen';
import { MedicationsScreen } from './features/medications/MedicationsScreen';
import { ReminderScreen } from './features/medications/ReminderScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { TodayScreen } from './features/today/TodayScreen';
import { DisplayModeProvider } from './lib/displayMode';
import { onReminderOpened } from './lib/reminders';
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

export function AppNavigation() {
  useEffect(() => onReminderOpened(({ medicationId, date, time }) => openReminder({ medicationId, date, time })), []);

  return (
    <DisplayModeProvider>
      <Navigation ref={navigation} onReady={() => openReminder(waiting)} />
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
