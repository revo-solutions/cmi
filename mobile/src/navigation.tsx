import { createStaticNavigation, type StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';

import { AppText } from './components/AppText';
import { Button } from './components/Button';
import { Screen } from './components/Screen';
import { SignInScreen } from './features/auth/SignInScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { TodayScreen } from './features/today/TodayScreen';
import { DisplayModeProvider } from './lib/displayMode';
import { useHeartbeat } from './lib/heartbeat';
import { loadSession, useSession } from './lib/session';
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

function SessionNavigation() {
  const session = useSession();
  const [failed, setFailed] = useState(false);
  const accountId = session && !session.expired ? session.accountId : undefined;
  useHeartbeat(accountId);

  async function open() {
    setFailed(false);
    try {
      await loadSession();
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    loadSession().catch(() => setFailed(true));
  }, []);

  if (session === undefined) {
    return (
      <Screen title="Central Melhor Idade">
        {failed ? (
          <>
            <AppText accessibilityRole="alert">Não foi possível abrir o aplicativo.</AppText>
            <Button label="Tentar novamente" onPress={() => void open()} />
          </>
        ) : <AppText accessibilityLiveRegion="polite">Carregando…</AppText>}
      </Screen>
    );
  }
  return accountId ? <Navigation /> : <SignInScreen />;
}

export function AppNavigation() {
  return (
    <DisplayModeProvider>
      <SessionNavigation />
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

