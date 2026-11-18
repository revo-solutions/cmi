import { useNavigation } from '@react-navigation/native';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { FileText, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Row } from '../../components/Row';
import { Screen } from '../../components/Screen';
import { colors } from '../../theme';
import { addDays, localDate } from '../medications/doses';
import { medicationLabel } from '../medications/format';
import { useDoseRecordsSince, useMedications, usePeriods } from '../medications/store';
import { useNow } from '../medications/useToday';
import { useProfile } from '../profile/store';
import { buildReport, percent, periodDays, type PeriodDays } from './report';
import { medicationListHtml, regularityHtml } from './reportHtml';

// Built on the phone from SQLite and shared through the system's menu, so it works offline (docs/escopo.md,
// "Relatório para a consulta"). The regularity PDF is Premium; phase 6 puts it behind the entitlement.
export function ReportScreen() {
  const navigation = useNavigation();
  const now = useNow();
  const today = localDate(now);
  const medications = useMedications();
  const periods = usePeriods();
  const records = useDoseRecordsSince(addDays(today, 1 - Math.max(...periodDays)));
  const profile = useProfile();
  const [days, setDays] = useState<PeriodDays>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const current = medications?.filter((medication) => !medication.deleted);
  const report = useMemo(
    () => medications && periods && records && buildReport(days, medications, periods, records, now),
    [days, medications, periods, records, now],
  );

  const share = async (html: string, title: string) => {
    setBusy(true);
    setError('');
    try {
      const { uri } = await printToFileAsync({ html });
      await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
    } catch {
      setError('Não foi possível gerar o PDF. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const name = profile?.name ?? null;

  return (
    <Screen title="Relatório para a consulta" onBack={() => navigation.goBack()}>
      <View style={styles.section}>
        <AppText variant="title" accessibilityRole="header">Remédios em uso</AppText>
        <Card>
          {current?.length === 0 && <AppText>Nenhum remédio cadastrado.</AppText>}
          {current?.map((medication) => (
            <View key={medication.id} style={styles.item}>
              <AppText bold>{medicationLabel(medication.name, medication.dose)}</AppText>
              <AppText variant="support">
                {medication.times.join(' · ')}{medication.paused ? ' · lembretes pausados' : ''}
              </AppText>
            </View>
          ))}
          {current && current.length > 0 && (
            <Button
              label="Compartilhar a lista"
              variant="secondary"
              icon={Share2}
              disabled={busy}
              onPress={() => void share(medicationListHtml(current, name, today), 'Remédios em uso')}
            />
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <AppText variant="title" accessibilityRole="header">Suas doses registradas</AppText>
        <View accessibilityRole="radiogroup">
          <Row>
            {periodDays.map((option) => (
              <Chip key={option} label={`${option} dias`} radio selected={days === option} onPress={() => setDays(option)} />
            ))}
          </Row>
        </View>
        <Card accessibilityLiveRegion="polite">
          {report && (report.expected > 0 ? (
            <AppText>
              Você registrou {percent(report.taken, report.expected)}% das doses nos últimos {days} dias
              ({report.taken} de {report.expected}).
            </AppText>
          ) : <AppText>Ainda não há doses previstas nos últimos {days} dias.</AppText>)}
          {report && current && report.medications.length > 0 && (
            <Button
              label="Gerar relatório em PDF"
              icon={FileText}
              disabled={busy}
              accessibilityHint="Monta o relatório com a grade de doses e abre o menu para compartilhar"
              onPress={() => void share(regularityHtml(report, current, name), 'Relatório de regularidade')}
            />
          )}
        </Card>
      </View>

      {busy && <AppText accessibilityLiveRegion="polite">Preparando o PDF…</AppText>}
      {error !== '' && <AppText accessibilityRole="alert" color={colors.red700}>{error}</AppText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  item: {
    gap: 2,
    paddingBottom: 8,
  },
});
