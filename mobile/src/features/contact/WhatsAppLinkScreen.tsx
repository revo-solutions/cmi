import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Check, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ApiError, ApiUnavailableError } from '../../api/client';
import { contactLink, type ContactLinkModel } from '../../api/generated/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { withSession } from '../../lib/session';
import { requestSync } from '../../lib/sync';
import { colors } from '../../theme';
import { useProfile } from '../profile/store';
import { linkMessage, whatsAppLinkUrl } from './contact';
import { useContact, type Contact } from './store';

const appNumber = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER?.trim() ?? '';

type LinkState = ContactLinkModel | 'loading' | 'unsynced' | 'offline' | 'failed';

// The contact links up by sending a prefilled message from their own phone (canvas, "Avisos pelo WhatsApp"). The
// state is read again whenever the screen comes back, since it changes on the contact's phone.
export function WhatsAppLinkScreen() {
  const navigation = useNavigation();
  const contact = useContact();
  const [link, setLink] = useState<LinkState>('loading');

  const load = useCallback(() => {
    withSession(contactLink)
      .then(setLink)
      .catch((error: unknown) => {
        // 404: the contact is still in the outgoing queue.
        if (error instanceof ApiError && error.status === 404) {
          void requestSync(true);
          setLink('unsynced');
        } else {
          setLink(error instanceof ApiUnavailableError ? 'offline' : 'failed');
        }
      });
  }, []);

  useFocusEffect(load);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && load());
    return () => subscription.remove();
  }, [load]);

  return (
    <Screen title="Avisos pelo WhatsApp" onBack={() => navigation.goBack()}>
      {contact && typeof link === 'object' && <LinkDetails contact={contact} link={link} />}
      {contact && typeof link === 'string' && link !== 'loading' && (
        <Card accessibilityLiveRegion="polite">
          <AppText>
            {link === 'unsynced' ? 'O contato ainda está sendo enviado para o servidor. Confira sua internet.'
              : link === 'offline' ? 'Sem conexão. Confira sua internet.'
              : 'Não foi possível consultar os avisos agora.'}
          </AppText>
          <Button label="Tentar de novo" variant="secondary" onPress={() => { setLink('loading'); load(); }} />
        </Card>
      )}
      {link === 'loading' && <AppText accessibilityLiveRegion="polite">Carregando…</AppText>}
    </Screen>
  );
}

function LinkDetails({ contact, link }: { contact: Contact; link: ContactLinkModel }) {
  const profile = useProfile();
  const message = linkMessage(profile?.name ?? null, link.code);
  const url = whatsAppLinkUrl(appNumber, message);
  const [error, setError] = useState('');

  if (link.linked && !link.stopped) {
    return (
      <>
        <Card style={styles.linked} accessibilityLiveRegion="polite">
          <View style={styles.title}>
            <Check size={30} strokeWidth={2.5} color={colors.leaf800} />
            <AppText variant="title" color={colors.leaf800} style={styles.titleText}>{contact.name} recebe os avisos</AppText>
          </View>
          <AppText>Pelo WhatsApp que enviou a mensagem com o código.</AppText>
        </Card>
        <Card>
          <AppText variant="title" accessibilityRole="header">O que {contact.name} recebe</AppText>
          {[
            'Um resumo por dia, às 20h',
            'Um aviso quando não recebermos a confirmação de um remédio',
            'Um aviso se o seu celular ficar muito tempo sem sinal',
            'Seus pedidos de ajuda pelo SOS',
            'Um lembrete no dia do seu aniversário',
          ].map((item) => <AppText key={item}>• {item}</AppText>)}
          <AppText variant="support">
            Só entram os remédios que você compartilhou. {contact.name} pode responder PARAR a qualquer momento.
          </AppText>
        </Card>
      </>
    );
  }

  const invite = () => {
    setError('');
    Share.share({
      message: `Oi, ${contact.name}! Toque neste link e envie a mensagem que aparecer para receber meus avisos pelo WhatsApp: ${url}`,
    }).catch(() => setError('Não foi possível abrir o compartilhamento.'));
  };

  return (
    <>
      {link.stopped ? (
        <Card style={styles.stopped} accessibilityLiveRegion="polite">
          <AppText variant="title">{contact.name} pediu para parar</AppText>
          <AppText>
            {contact.name} respondeu PARAR no WhatsApp e não recebe mais avisos. Para voltar, basta mandar a mensagem
            com o código de novo.
          </AppText>
        </Card>
      ) : (
        <AppText>
          Para receber os avisos, {contact.name} manda uma mensagem para o nosso número uma vez, do celular de{' '}
          {contact.name}.
        </AppText>
      )}

      {appNumber === '' ? (
        <Card>
          <AppText accessibilityRole="alert">O número do WhatsApp do app não está configurado neste aplicativo.</AppText>
        </Card>
      ) : (
        <>
          <Card style={styles.qr}>
            <AppText variant="title" accessibilityRole="header" style={styles.stretch}>Se {contact.name} está com você</AppText>
            <View accessible accessibilityRole="image" accessibilityLabel={`Código QR do convite para ${contact.name}`}>
              <QRCode value={url} size={216} quietZone={8} />
            </View>
            <AppText>
              Com a câmera do celular de {contact.name}, aponte para o código. O WhatsApp abre com a mensagem pronta, é só
              tocar em Enviar.
            </AppText>
          </Card>
          <Card>
            <AppText variant="title" accessibilityRole="header">Se {contact.name} está longe</AppText>
            <Button
              label={link.stopped ? 'Mandar o convite de novo' : `Mandar o convite para ${contact.name}`}
              icon={Share2}
              onPress={invite}
            />
            <AppText variant="support">Você escolhe por onde mandar: WhatsApp, SMS ou outro app.</AppText>
            {error !== '' && <AppText accessibilityRole="alert" color={colors.red700}>{error}</AppText>}
          </Card>
          <Card style={styles.message}>
            <AppText variant="support" bold>A mensagem que {contact.name} vai enviar</AppText>
            <AppText>{message}</AppText>
          </Card>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  linked: {
    backgroundColor: colors.leaf50,
    borderColor: colors.leaf800,
    borderWidth: 2,
  },
  stopped: {
    backgroundColor: colors.amber50,
    borderColor: colors.amber800,
    borderWidth: 2,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleText: {
    flexShrink: 1,
  },
  qr: {
    alignItems: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
  },
  message: {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
});
