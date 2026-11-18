import { useNavigation } from '@react-navigation/native';
import { Phone, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Linking } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { colors } from '../../theme';
import { callUrl } from '../contact/contact';
import { ContactActions } from '../contact/ContactActions';
import { useContact } from '../contact/store';

// The free SOS: a call or an SMS from the phone's own plan, never through the server, so it works offline and with
// sync blocked (docs/escopo.md, "Botão SOS"). The WhatsApp request joins it with Premium.
export function SosScreen() {
  const navigation = useNavigation();
  const contact = useContact();
  const [error, setError] = useState('');

  const callEmergency = () => {
    setError('');
    Linking.openURL(callUrl('192')).catch(() => setError('Este celular não conseguiu abrir a ligação. Disque 192.'));
  };

  return (
    <Screen title="Pedir ajuda" onBack={() => navigation.goBack()}>
      {contact && (
        <>
          <AppText>Ligue para {contact.name} ou mande um SMS com o pedido de ajuda já escrito.</AppText>
          <ContactActions contact={contact} help />
        </>
      )}
      {contact === null && (
        <Card>
          <AppText>Cadastre um contato de confiança para pedir ajuda a alguém com um toque.</AppText>
          <Button label="Cadastrar contato" variant="secondary" icon={UserPlus} onPress={() => navigation.navigate('Contact')} />
        </Card>
      )}
      <Button label="Ligar 192 · SAMU" variant="danger" icon={Phone} onPress={callEmergency} />
      {error !== '' && <AppText accessibilityRole="alert" color={colors.red700}>{error}</AppText>}
    </Screen>
  );
}
