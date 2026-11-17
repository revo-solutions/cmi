import { useNavigation } from '@react-navigation/native';
import { Settings } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { ApiUnavailableError } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { YesNo } from '../../components/YesNo';
import { useDisplayMode } from '../../lib/displayMode';
import { deleteAccount, PendingChangesError, signOut } from '../../lib/session';
import { requestSync } from '../../lib/sync';
import { forgetGoogleSignIn } from '../auth/socialLogin';

export function ProfileScreen() {
  const navigation = useNavigation();
  const { largeText, setLargeText } = useDisplayMode();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function close(remove: boolean) {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setBusy(true);
    setMessage('');
    try {
      await (remove ? deleteAccount() : signOut());
      void forgetGoogleSignIn().catch(() => undefined);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setMessage('Sem conexão. Confira sua internet e tente novamente.');
      } else if (error instanceof PendingChangesError) {
        void requestSync(true);
        setMessage('Há registros ainda não enviados. Conecte-se à internet e tente sair de novo daqui a pouco.');
      } else {
        setMessage(remove ? 'Não foi possível excluir sua conta. Tente novamente.' : 'Não foi possível sair. Tente novamente.');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Excluir sua conta?', 'Seus dados e registros serão apagados. Esta decisão é definitiva.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir conta', style: 'destructive', onPress: () => void close(true) },
    ]);
  }

  return (
    <Screen title="Perfil" onBack={() => navigation.goBack()}>
      <Card>
        <YesNo
          question="Letras grandes e mais contraste"
          value={largeText}
          onChange={(on) => setLargeText(on ?? false)}
        />
        <AppText variant="support">Vale só para este celular e soma com o tamanho de letra do sistema.</AppText>
      </Card>

      {/* Xiaomi, Samsung and Motorola close apps to save battery (docs/arquitetura.md, "Pontos de atenção no Android"). */}
      {Platform.OS === 'android' && (
        <Card>
          <AppText variant="title" accessibilityRole="header">Para os lembretes tocarem na hora</AppText>
          <AppText>
            Em alguns celulares, a economia de bateria atrasa os lembretes. Nos ajustes do app, em Bateria, escolha “Sem
            restrições”.
          </AppText>
          <Button label="Abrir os ajustes do app" variant="secondary" icon={Settings} onPress={() => void Linking.openSettings()} />
        </Card>
      )}
      <Card accessibilityState={{ busy }}>
        <AppText variant="title" accessibilityRole="header">Conta</AppText>
        <AppText>Sair mantém sua conta e seus dados salvos no servidor.</AppText>
        <Button label="Sair" variant="secondary" onPress={() => void close(false)} disabled={busy} />
        <AppText>Excluir a conta apaga seus dados e lembretes.</AppText>
        <Button label="Excluir conta" variant="secondary" onPress={confirmDelete} disabled={busy} />
        {busy && <AppText accessibilityLiveRegion="polite">Aguarde…</AppText>}
        {message !== '' && <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive">{message}</AppText>}
      </Card>
    </Screen>
  );
}
