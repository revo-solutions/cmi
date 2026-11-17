import { CircleCheck, Clock3 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getLatestReminderTest,
  onReminderTestChange,
  recoverPendingReminderResponse,
  scheduleReminderTest,
  testDelayMinutes,
  type ReminderTest,
} from '../../lib/reminders';

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const recordSourceText = {
  'background-task': 'Salvo pela tarefa em segundo plano.',
  'background-event': 'Salvo com o app em segundo plano.',
  'inactive-event': 'Salvo enquanto o app iniciava ou estava inativo.',
  'active-event': 'Salvo com o app em primeiro plano.',
  startup: 'Salvo ao recuperar a última ação.',
};

const colors = {
  surface: '#F8F5F7',
  white: '#FFFFFF',
  ink: '#1F1A1E',
  graphite: '#4A4248',
  divider: '#E6DFE4',
  orchid50: '#FBF3F8',
  orchid800: '#7E3369',
  orchid900: '#4E1F41',
  leaf50: '#F2F8EE',
  leaf200: '#CDE5C0',
  leaf900: '#1E4214',
};

export function ReminderTestScreen({ useBrandFont }: { useBrandFont: boolean }) {
  const [latest, setLatest] = useState<ReminderTest | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState('');
  const { fontScale } = useWindowDimensions();

  useEffect(() => {
    let mounted = true;

    async function refresh(recover: boolean) {
      try {
        if (recover) {
          await recoverPendingReminderResponse();
        }
        const saved = await getLatestReminderTest();
        if (mounted) {
          setLatest(saved);
        }
      } catch (cause) {
        console.warn('Não foi possível ler o teste de lembrete.', cause);
        if (mounted) {
          setError('Não foi possível consultar o último teste. Feche e abra o app para tentar de novo.');
        }
      }
    }

    const unsubscribe = onReminderTestChange(() => void refresh(false));
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh(true);
      }
    });

    void refresh(true);
    return () => {
      mounted = false;
      unsubscribe();
      appState.remove();
    };
  }, []);

  async function schedule() {
    setError('');
    setScheduling(true);
    try {
      const result = await scheduleReminderTest();
      if (result === 'notifications-disabled') {
        setError('Permita as notificações da Central Melhor Idade nos ajustes do celular e tente de novo.');
      } else if (result === 'exact-alarm-disabled') {
        setError('Permita alarmes e lembretes nos ajustes do celular e tente de novo.');
      } else {
        setLatest(await getLatestReminderTest());
      }
    } catch (cause) {
      console.warn('Não foi possível agendar o lembrete de teste.', cause);
      setError('Não foi possível agendar o lembrete. Tente de novo.');
    } finally {
      setScheduling(false);
    }
  }

  const regular = useBrandFont && styles.brandRegular;
  const bold = useBrandFont ? styles.brandBold : styles.systemBold;
  const recorded = latest != null && latest.takenAt != null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.page}>
          <Image
            accessible
            accessibilityLabel="Central Melhor Idade"
            accessibilityRole="image"
            source={require('../../../assets/cmi-logo.png')}
            resizeMode="contain"
            style={styles.logo}
          />

          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, bold]}>Teste de lembrete</Text>
            <Text style={[styles.body, regular]}>
              Agende um lembrete para daqui a {testDelayMinutes} minuto. Depois, feche o app e bloqueie o celular.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: scheduling, busy: scheduling }}
            disabled={scheduling}
            onPress={schedule}
            style={({ pressed }) => [styles.button, (pressed || scheduling) && styles.buttonPressed]}
          >
            <Text style={[styles.buttonLabel, bold]}>{scheduling ? 'Agendando…' : 'Agendar lembrete'}</Text>
          </Pressable>

          {error !== '' && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.error, regular]}>{error}</Text>
          )}

          <View style={[styles.card, recorded && styles.recordedCard]} accessibilityLiveRegion="polite">
            <Text accessibilityRole="header" style={[styles.cardTitle, bold]}>Último teste</Text>
            {latest == null ? (
              <Text style={[styles.body, regular]}>Nenhum lembrete agendado.</Text>
            ) : latest.takenAt == null ? (
              <>
                <View style={[styles.resultRow, fontScale > 1.3 && styles.stackedResult]}>
                  <Clock3 color={colors.orchid800} size={28} strokeWidth={2.5} accessible={false} />
                  <Text style={[styles.result, bold]}>
                    {latest.revision > 0 ? 'Lembrete adiado' : 'Lembrete agendado'}
                  </Text>
                </View>
                <Text style={[styles.body, regular]}>Horário do lembrete: {time.format(latest.scheduledAt)}</Text>
              </>
            ) : (
              <>
                <View style={[styles.resultRow, fontScale > 1.3 && styles.stackedResult]}>
                  <CircleCheck color={colors.leaf900} size={28} strokeWidth={2.5} accessible={false} />
                  <Text style={[styles.result, styles.recordedText, bold]}>Tomei registrado</Text>
                </View>
                <Text style={[styles.body, regular]}>Horário do registro: {time.format(latest.takenAt)}</Text>
                {latest.source && <Text style={[styles.support, regular]}>{recordSourceText[latest.source]}</Text>}
              </>
            )}
          </View>

          <View style={styles.guide}>
            <Text accessibilityRole="header" style={[styles.cardTitle, bold]}>Na notificação</Text>
            <Text style={[styles.body, regular]}>
              Toque em <Text style={bold}>Tomei</Text> e reabra o app para conferir o registro.
            </Text>
            <Text style={[styles.body, regular]}>
              Para testar <Text style={bold}>Lembrar depois</Text>, adie e espere mais {testDelayMinutes} minuto.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  container: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  page: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 22 },
  logo: { width: 184, height: 52 },
  header: { gap: 8 },
  title: { color: colors.orchid800, fontSize: 30, lineHeight: 36 },
  body: { color: colors.graphite, fontSize: 18, lineHeight: 26 },
  support: { color: colors.graphite, fontSize: 16, lineHeight: 22 },
  button: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: colors.orchid800,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonPressed: { backgroundColor: colors.orchid900 },
  buttonLabel: { color: colors.white, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  error: { color: colors.orchid900, backgroundColor: colors.orchid50, padding: 16, borderRadius: 12, fontSize: 18, lineHeight: 26 },
  card: { backgroundColor: colors.white, borderColor: colors.divider, borderWidth: 1, borderRadius: 20, padding: 20, gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 22, lineHeight: 28 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stackedResult: { flexDirection: 'column', alignItems: 'flex-start' },
  result: { color: colors.orchid800, fontSize: 22, lineHeight: 28, flexShrink: 1 },
  recordedCard: { backgroundColor: colors.leaf50, borderColor: colors.leaf200 },
  recordedText: { color: colors.leaf900 },
  guide: { borderTopWidth: 1, borderColor: colors.divider, paddingTop: 18, gap: 8 },
  brandRegular: { fontFamily: 'AtkinsonHyperlegibleNext_400Regular' },
  brandBold: { fontFamily: 'AtkinsonHyperlegibleNext_700Bold' },
  systemBold: { fontWeight: '700' },
});
