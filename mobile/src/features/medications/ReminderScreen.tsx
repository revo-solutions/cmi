import { useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { Check, Pill } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { snoozeDose, takeDose } from '../../lib/reminders';
import { colors, text } from '../../theme';
import { formatClock } from './format';
import { useDoseRecords, useMedications } from './store';

type Props = StaticScreenProps<{ medicationId: string; date: string; time: string }>;

// Opened by a tap on the reminder: the time in large type and "Tomei" as the main action (canvas, "Hora do remédio").
export function ReminderScreen({ route }: Props) {
  const navigation = useNavigation();
  const { medicationId, date, time } = route.params;
  const medication = useMedications()?.find((m) => m.id === medicationId);
  const record = useDoseRecords(date)?.find((r) => r.medicationId === medicationId && r.scheduledTime === time);

  const leave = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'));

  return (
    <Screen title="Hora do remédio" onBack={leave}>
      <AppText variant="screen" scale={72 / text.screen.fontSize} style={styles.time}>{time}</AppText>

      {medication && (
        <Card style={styles.medication}>
          <View style={styles.icon}>
            <Pill size={34} strokeWidth={2.5} color={colors.leaf800} />
          </View>
          <View style={styles.medicationText}>
            <AppText variant="title">{medication.name}</AppText>
            {medication.dose && <AppText variant="support">{medication.dose}</AppText>}
          </View>
        </Card>
      )}

      {record?.takenAt ? (
        <StatusChip status="taken" label={`Tomado às ${formatClock(record.takenAt)}`} />
      ) : (
        <>
          <Button
            label="Tomei"
            variant="take"
            icon={Check}
            onPress={() => void takeDose(medicationId, date, time).then(leave)}
          />
          <Button label="Lembrar depois" variant="secondary" onPress={() => void snoozeDose({ medicationId, date, time }).then(leave)} />
          <AppText variant="support" style={styles.center}>Tocou sem querer? Corrija no histórico.</AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  time: {
    textAlign: 'center',
  },
  medication: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: colors.leaf50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medicationText: {
    flex: 1,
    gap: 2,
  },
  center: {
    textAlign: 'center',
  },
});
