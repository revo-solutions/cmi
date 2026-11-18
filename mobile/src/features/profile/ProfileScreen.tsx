import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';

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
import { useContact } from '../contact/store';
import { LocationCard } from '../sos/LocationCard';
import { BatteryCard } from './BatteryCard';
import { formatBirthDate } from './birthday';
import { DeleteAccountPrompt } from './DeleteAccountPrompt';
import { conditionLabels } from './health';
import { hasHealthAnswers, useProfile } from './store';

export function ProfileScreen() {
  const navigation = useNavigation();
  const profile = useProfile();
  const contact = useContact();
  const { largeText, setLargeText, growsText } = useDisplayMode();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
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
        <AppText variant="title" accessibilityRole="header">Contato de confiança</AppText>
        <AppText>{contact ? `${contact.name}, ${contact.phone}` : 'Nenhum contato cadastrado'}</AppText>
        <Button
          label={contact ? 'Abrir' : 'Cadastrar'}
          accessibilityLabel={contact ? `Abrir o contato de confiança, ${contact.name}` : 'Cadastrar um contato de confiança'}
          variant="secondary"
          onPress={() => navigation.navigate('Contact')}
        />
      </Card>

      <Card>
        <YesNo
          question={growsText ? 'Letras grandes e mais contraste' : 'Mais contraste'}
          value={largeText}
          onChange={(on) => setLargeText(on ?? false)}
        />
        <AppText variant="support">
          {growsText
            ? 'Vale só para este celular e soma com o tamanho de letra do sistema.'
            : 'Vale só para este celular. A letra já está grande nos ajustes do celular, então aqui só reforçamos o contraste.'}
        </AppText>
      </Card>
      <BatteryCard />
      <LocationCard />
      <Card accessibilityState={{ busy }}>
        <AppText variant="title" accessibilityRole="header">Conta</AppText>
        <AppText>Sair mantém sua conta e seus dados salvos no servidor.</AppText>
        <Button label="Sair" variant="secondary" onPress={() => void close(false)} disabled={busy} />
        <AppText>Excluir a conta apaga seus dados e lembretes.</AppText>
        <Button label="Excluir conta" variant="secondary" onPress={() => setDeletePromptOpen(true)} disabled={busy || !profile} />
        {busy && <AppText accessibilityLiveRegion="polite">Aguarde…</AppText>}
        {message !== '' && <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive">{message}</AppText>}
      </Card>
      {deletePromptOpen && profile && (
        <DeleteAccountPrompt
          key={profile.name} name={profile.name} onCancel={() => setDeletePromptOpen(false)}
          onConfirm={() => {
            setDeletePromptOpen(false);
            void close(true);
          }}
        />
      )}
    </Screen>
  );
}
