import { useNavigation } from '@react-navigation/native';
import { Check, Phone, RotateCw, UserPlus, WifiOff, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { NoticeStatus } from '../../api/generated/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { colors } from '../../theme';
import { callUrl } from '../contact/contact';
import { ContactActions } from '../contact/ContactActions';
import { useContact } from '../contact/store';
import {
  helpView, isSettled, pollLimitMs, pollMs, refreshHelpRequest, requestHelp, useHelpRequest, type HelpRequest,
  type HelpView,
} from './sos';

// Opening it asks for help over WhatsApp (Premium; the server answers NotSent otherwise). The free SOS, a call or an
// SMS from the phone's own plan, is always there and never waits for the server (docs/escopo.md, "Botão SOS").
export function SosScreen() {
  const navigation = useNavigation();
  const contact = useContact();
  const [requestId, setRequestId] = useState<string | null>(null);
  const request = useHelpRequest(requestId);
  const [error, setError] = useState('');
  const asked = useRef(false);

  const ask = (again: boolean) => {
    requestHelp(again)
      .then(setRequestId)
      .catch((reason: unknown) => console.warn('Não foi possível guardar o pedido de ajuda.', reason));
  };

  useEffect(() => {
    if (contact && !asked.current) {
      asked.current = true;
      ask(false);
    }
  }, [contact]);

  const callEmergency = () => {
    setError('');
    Linking.openURL(callUrl('192')).catch(() => setError('Este celular não conseguiu abrir a ligação. Disque 192.'));
  };

  const whatsApp = request && request.status !== NoticeStatus.NotSent;

  return (
    <Screen title="Pedir ajuda" onBack={() => navigation.goBack()}>
      {contact && request && <HelpStatus request={request} name={contact.name} onRetry={() => ask(true)} />}
      {contact && !whatsApp && (
        <AppText>Ligue para {contact.name} ou mande um SMS com o pedido de ajuda já escrito.</AppText>
      )}
      {contact && <ContactActions contact={contact} help />}
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

const tones = {
  good: { background: colors.leaf50, color: colors.leaf800 },
  wait: { background: colors.amber50, color: colors.amber800 },
  bad: { background: colors.red50, color: colors.red700 },
};

type Content = { icon?: LucideIcon; tone: keyof typeof tones; title: string; text: string };

function HelpStatus({ request, name, onRetry }: { request: HelpRequest; name: string; onRetry: () => void }) {
  const [now, setNow] = useState(Date.now);
  const settled = isSettled(request.status);

  // Asks the server until nothing will change, then leaves it to the outgoing queue's triggers.
  useEffect(() => {
    if (settled) {
      return;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - Date.parse(request.requestedAt) < pollLimitMs) {
        void refreshHelpRequest(request.id).catch(() => undefined);
      }
    }, pollMs);
    return () => clearInterval(timer);
  }, [request.id, request.requestedAt, settled]);

  const time = request.requestedAt.slice(11, 16);
  const view = helpView(request, now);
  if (view === 'notSent') {
    return null;
  }
  const contents: Record<Exclude<HelpView, 'notSent'>, Content> = {
    sending: { tone: 'wait', title: 'Enviando seu pedido de ajuda', text: `Estamos avisando ${name} pelo WhatsApp.` },
    slow: { tone: 'wait', title: 'O envio está demorando', text: `Se precisar, ligue para ${name} enquanto isso.` },
    offline: {
      icon: WifiOff, tone: 'wait', title: 'Sem internet agora',
      text: 'Seu pedido está guardado e sai pelo WhatsApp assim que a conexão voltar. Enquanto isso, ligue.',
    },
    sent: { icon: Check, tone: 'good', title: 'Pedido de ajuda enviado', text: `Enviamos seu pedido das ${time} para ${name} pelo WhatsApp.` },
    delivered: { icon: Check, tone: 'good', title: 'Pedido de ajuda enviado', text: `Sua mensagem chegou ao WhatsApp de ${name}.` },
    read: { icon: Check, tone: 'good', title: 'Pedido de ajuda enviado', text: `${name} leu sua mensagem no WhatsApp.` },
    failed: { icon: X, tone: 'bad', title: 'Não conseguimos enviar', text: `Ligue para ${name} ou tente de novo.` },
  };
  const content = contents[view];
  const tone = tones[content.tone];
  const Icon = content.icon;

  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {Icon && (
        <View style={[styles.badge, { backgroundColor: tone.background }]}>
          <Icon size={56} strokeWidth={2.5} color={tone.color} />
        </View>
      )}
      <AppText variant="title" accessibilityRole="header" style={styles.center}>{content.title}</AppText>
      <AppText style={styles.center}>{content.text}</AppText>
      {view === 'failed' && <Button label="Tentar de novo" variant="secondary" icon={RotateCw} onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  badge: {
    width: 112,
    height: 112,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
