import { useNavigation } from '@react-navigation/native';
import { MessageCircle, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useProfile } from '../profile/store';
import { relationshipLabel } from './contact';
import { ContactActions } from './ContactActions';
import { ContactForm } from './ContactForm';
import { SharingList } from './SharingList';
import { removeContact, useContact, usePendingRevocation, type Contact } from './store';

export function ContactScreen() {
  const navigation = useNavigation();
  const contact = useContact();
  const pending = usePendingRevocation();
  const [editing, setEditing] = useState(false);

  return (
    <Screen title="Contato de confiança" onBack={() => navigation.goBack()}>
      {contact === null && (
        <>
          {pending?.contact && <RemovalPending />}
          <AppText>Alguém da família ou um amigo para você ligar, mandar SMS e pedir ajuda pelo botão SOS.</AppText>
          <ContactForm contact={null} submitLabel="Salvar contato" onSaved={() => undefined} />
        </>
      )}
      {contact && editing && (
        <ContactForm contact={contact} submitLabel="Salvar" onSaved={() => setEditing(false)} />
      )}
      {contact && !editing && <Details contact={contact} onEdit={() => setEditing(true)} />}
    </Screen>
  );
}

function Details({ contact, onEdit }: { contact: Contact; onEdit: () => void }) {
  const navigation = useNavigation();
  const sex = useProfile()?.sex ?? null;
  const confirmRemove = () => {
    Alert.alert(
      `Remover ${contact.name}?`,
      `${contact.name} deixa de acompanhar seus remédios, e os dados de contato são apagados do servidor.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => void removeContact() },
      ],
    );
  };

  return (
    <>
      <Card>
        <AppText variant="title">{contact.name}</AppText>
        <AppText>{contact.phone}</AppText>
        <AppText variant="support">Para {contact.name}, você é: {relationshipLabel(contact.relationship, sex).toLowerCase()}</AppText>
        <Button label="Editar" accessibilityLabel={`Editar ${contact.name}`} variant="secondary" onPress={onEdit} />
      </Card>
      <ContactActions contact={contact} />
      <Card>
        <AppText variant="title" accessibilityRole="header">Avisos pelo WhatsApp</AppText>
        <AppText>{contact.name} recebe o resumo do dia, os avisos e seus pedidos de ajuda.</AppText>
        <Button label="Abrir" accessibilityLabel={`Avisos pelo WhatsApp para ${contact.name}`} variant="secondary" icon={MessageCircle} onPress={() => navigation.navigate('WhatsAppLink')} />
      </Card>
      <SharingList contact={contact} />
      <Button label="Remover contato" variant="danger" icon={Trash2} onPress={confirmRemove} />
    </>
  );
}

function RemovalPending() {
  return (
    <Card accessibilityLiveRegion="polite">
      <AppText bold>Remoção ainda não enviada</AppText>
      <AppText>
        O contato foi removido deste celular. Até a remoção chegar ao servidor pela internet, ele ainda pode receber avisos.
      </AppText>
    </Card>
  );
}
