import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

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
import { BatteryCard } from './BatteryCard';
import { formatBirthDate } from './birthday';
import { conditionLabels } from './health';
import { hasHealthAnswers, useProfile } from './store';

export function ProfileScreen() {
  const navigation = useNavigation();
  const profile = useProfile();
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
      {profile && (
        <>
          <Card>
            <AppText variant="title" accessibilityRole="header">Sobre você</AppText>
            <AppText>{profile.name ?? 'Nome não informado'}</AppText>
            <AppText variant="support">
              {profile.birthDate ? `Nascimento: ${formatBirthDate(profile.birthDate)}` : 'Data de nascimento não informada'}
            </AppText>
            <Button
              label="Editar" accessibilityLabel="Editar nome e data de nascimento" variant="secondary"
              onPress={() => navigation.navigate('ProfileAbout')}
            />
          </Card>
          <Card>
            <AppText variant="title" accessibilityRole="header">Sua saúde</AppText>
            <AppText>
              {hasHealthAnswers(profile)
                ? conditionLabels(profile.conditions, profile.otherCondition).join(', ') || 'Nenhuma condição marcada'
                : 'Questionário não respondido'}
            </AppText>
            <Button
              label="Editar" accessibilityLabel="Editar o questionário de saúde" variant="secondary"
              onPress={() => navigation.navigate('ProfileHealth')}
            />
          </Card>
        </>
      )}

      <Card>
        <YesNo
          question="Letras grandes e mais contraste"
          value={largeText}
          onChange={(on) => setLargeText(on ?? false)}
        />
        <AppText variant="support">Vale só para este celular e soma com o tamanho de letra do sistema.</AppText>
      </Card>
      <BatteryCard />
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
