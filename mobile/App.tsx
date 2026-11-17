import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular';
import { AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { reconcileReminders, recoverPendingAction, setUpReminders } from './src/lib/reminders';
import { AppNavigation } from './src/navigation';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_700Bold,
  });

  useEffect(() => {
    setUpReminders()
      .then(recoverPendingAction)
      .then(reconcileReminders)
      .catch((error: unknown) => console.warn('Não foi possível preparar os lembretes.', error));
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}
