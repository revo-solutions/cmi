import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, ApiUnavailableError, apiUrl } from '../../api/client';
import { LoginProvider } from '../../api/generated/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { useDisplayMode } from '../../lib/displayMode';
import { PendingChangesError, signIn, useSession } from '../../lib/session';
import { colors, touch } from '../../theme';
import { appleIdentity, googleIdentity } from './socialLogin';

export function SignInScreen() {
  const session = useSession();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submitting = useRef(false);
  const { fontScale } = useWindowDimensions();
  const { textScale } = useDisplayMode();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  async function enter(provider: LoginProvider) {
    if (submitting.current) {
      return;
    }
    if (!apiUrl) {
      setMessage('A entrada está indisponível nesta versão do aplicativo.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setMessage('');
    try {
      const identity = await (provider === LoginProvider.Apple ? appleIdentity() : googleIdentity());
      if (identity) {
        await signIn(provider, identity.idToken, identity.name);
      }
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setMessage('Não foi possível conectar. Confira sua internet e tente novamente.');
      } else if (error instanceof PendingChangesError) {
        setMessage('Há registros pendentes neste celular. Entre com a conta que você usou antes.');
      } else if (error instanceof ApiError && error.status === 409) {
        setMessage('Sua conta foi aberta em outro celular. Tente entrar de novo neste aparelho.');
      } else {
        setMessage('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.intro}>
          <Image source={require('../../../assets/icon.png')} accessible accessibilityLabel="Central Melhor Idade"
            accessibilityRole="image" style={styles.logo} />
          <AppText variant="screen" accessibilityRole="header" style={styles.center}>
            Seus remédios na hora certa, e sua família por perto.
          </AppText>
          <AppText style={styles.center}>Lembretes que funcionam mesmo sem internet e ajuda a um toque.</AppText>
        </View>

        <View style={styles.actions} accessibilityState={{ busy }}>
          {session?.expired && <AppText>Entre de novo para acessar sua conta.</AppText>}
          <Button label="Entrar com Google" variant="secondary" onPress={() => void enter(LoginProvider.Google)} disabled={busy} />
          {appleAvailable && (
            <View pointerEvents={busy ? 'none' : 'auto'}>
              <AppleAuthentication.AppleAuthenticationButton
                accessibilityLabel="Entrar com Apple"
                accessibilityState={{ disabled: busy }}
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={18}
                style={{ height: touch.main * Math.max(1, fontScale * textScale), opacity: busy ? 0.5 : 1 }}
                onPress={() => void enter(LoginProvider.Apple)}
              />
            </View>
          )}
          {busy && <AppText accessibilityLiveRegion="polite">Entrando…</AppText>}
          {message !== '' && (
            <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.orchid900}>{message}</AppText>
          )}
          <AppText variant="support" style={styles.center}>Sem senha. Se trocar de celular, é só entrar de novo.</AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  container: { flexGrow: 1, justifyContent: 'space-between', padding: 24, gap: 32, width: '100%', maxWidth: 480, alignSelf: 'center' },
  intro: { alignItems: 'center', gap: 20, paddingTop: 24 },
  logo: { width: 136, height: 136, resizeMode: 'contain' },
  center: { textAlign: 'center' },
  actions: { gap: 16 },
});
