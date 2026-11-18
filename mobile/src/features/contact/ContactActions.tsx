import { MessageSquareText, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { colors } from '../../theme';
import { useProfile } from '../profile/store';
import { callUrl, helpMessage, smsUrl } from './contact';
import type { Contact } from './store';

// Through the phone's own plan, with no SMS permission and no server: free, and working offline (docs/escopo.md).
export function ContactActions({ contact, help }: { contact: Contact; help?: boolean }) {
  const profile = useProfile();
  const [error, setError] = useState('');

  const open = (url: string) => {
    setError('');
    Linking.openURL(url).catch(() => setError('Este celular não conseguiu abrir. Tente ligar pelo próprio telefone.'));
  };
  const sms = smsUrl(contact.phone, help ? helpMessage(profile?.name ?? null) : '', Platform.OS === 'ios' ? 'ios' : 'android');

  return (
    <>
      <Button label={`Ligar para ${contact.name}`} icon={Phone} onPress={() => open(callUrl(contact.phone))} />
      <Button
        label={help ? `Mandar SMS para ${contact.name}` : 'Mandar SMS'}
        accessibilityHint={help ? 'Abre o SMS com o pedido de ajuda escrito' : undefined}
        variant="secondary"
        icon={MessageSquareText}
        onPress={() => open(sms)}
      />
      {error !== '' && <AppText accessibilityRole="alert" color={colors.red700}>{error}</AppText>}
    </>
  );
}
