import { createStaticNavigation, type StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ProfileScreen } from './features/profile/ProfileScreen';
import { TodayScreen } from './features/today/TodayScreen';
import { DisplayModeProvider } from './lib/displayMode';
import { colors } from './theme';

// Screens draw their own header (components/Screen), so it grows with the system font and the large-text mode.
const RootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false, contentStyle: { backgroundColor: colors.surface } },
  screens: {
    Today: TodayScreen,
    Profile: ProfileScreen,
  },
});

const Navigation = createStaticNavigation(RootStack);

export function AppNavigation() {
  return (
    <DisplayModeProvider>
      <Navigation />
    </DisplayModeProvider>
  );
}

type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

