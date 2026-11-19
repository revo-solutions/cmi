import { useNavigation } from '@react-navigation/native';
import { Check, History, Plus, TriangleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { useDisplayMode } from '../../lib/displayMode';
import { takeDose } from '../../lib/reminders';
import { colors, text } from '../../theme';
import { nextDose, type Dose } from '../medications/doses';
import { formatClock, formatDay } from '../medications/format';
import { useToday } from '../medications/useToday';
import { useProfile } from '../profile/store';
import { greeting } from './greeting';
import { HealthCard } from './HealthCard';
import { ReminderPermissionCard } from './ReminderPermissionCard';
import { SexCard } from './SexCard';
import { SyncStatusCard } from './SyncStatusCard';

export function TodayScreen() {
  const navigation = useNavigation();
  const { now, date, medications, doses } = useToday();
  const profile = useProfile();
  const next = doses ? nextDose(doses) : null;
  const hasMedications = medications?.some((m) => !m.deleted);

  return (
    <Screen title="Hoje" subtitle={formatDay(date)} onProfile={() => navigation.navigate('Profile')}>
      {profile && <AppText variant="title">{greeting(now, profile.name)}</AppText>}
      <ReminderPermissionCard />
      <SyncStatusCard />
      <SexCard />

      {doses && !hasMedications && (
        <Card>
          <AppText>Cadastre seus remédios para receber os lembretes na hora certa.</AppText>
          <Button label="Cadastrar remédio" icon={Plus} onPress={() => navigation.navigate('MedicationForm', {})} />
        </Card>
      )}

      {doses && hasMedications && (
        <>
          {next ? <NextDose dose={next} /> : (
            <Card>
              <AppText>Nenhum remédio pendente agora.</AppText>
            </Card>
          )}

          {doses.length > 0 && (
            <View style={styles.section}>
              <AppText variant="title" accessibilityRole="header">Seus horários de hoje</AppText>
              <Card style={styles.list}>
                {doses.map((dose, index) => (
                  <DoseRow key={`${dose.medication.id} ${dose.time}`} dose={dose} last={index === doses.length - 1} />
                ))}
              </Card>
            </View>
          )}
        </>
      )}

      <Button label="Ver histórico" variant="secondary" icon={History} onPress={() => navigation.navigate('History', {})} />
      <HealthCard />
      <Button label="SOS · Pedir ajuda" variant="sos" icon={TriangleAlert} onPress={() => navigation.navigate('Sos')} />
    </Screen>
  );
}

function NextDose({ dose }: { dose: Dose }) {
  const { medication, date, time, state } = dose;

  return (
    <Card>
      <View style={styles.nextHeader}>
        <AppText bold color={colors.orchid800}>Próximo</AppText>
        <StatusChip status={state} />
      </View>
      <AppText variant="screen" scale={40 / text.screen.fontSize}>{time}</AppText>
      <AppText variant="title">{medication.name}</AppText>
      {medication.dose && <AppText variant="support">{medication.dose}</AppText>}
      <Button
        label="Tomei"
        variant="take"
        icon={Check}
        accessibilityLabel={`Tomei o remédio das ${time}, ${medication.name}`}
        onPress={() => void takeDose(medication.id, date, time)}
      />
    </Card>
  );
}

// One dose of a day, on Hoje and in the history, which adds its action below.
export function DoseRow({ dose, last, action }: { dose: Dose; last: boolean; action?: ReactNode }) {
  const { stacked, contrast } = useDisplayMode();
  const label = dose.state === 'taken' && dose.takenAt ? `Tomado às ${formatClock(dose.takenAt)}` : undefined;

  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: contrast.borderWidth, borderBottomColor: contrast.border },
        dose.state === 'paused' && styles.paused,
      ]}
    >
      <View style={[styles.rowMain, stacked && styles.rowStacked]}>
        <AppText variant="title" style={!stacked && styles.time}>{dose.time}</AppText>
        <View style={styles.rowText}>
          <AppText>{dose.medication.dose ? `${dose.medication.name} ${dose.medication.dose}` : dose.medication.name}</AppText>
          <StatusChip status={dose.state} label={label} />
          {action}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  list: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  nextHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  paused: {
    backgroundColor: colors.surface,
  },
  rowMain: {
    flexDirection: 'row',
    gap: 14,
  },
  rowStacked: {
    flexDirection: 'column',
    gap: 2,
  },
  time: {
    minWidth: 64,
  },
  rowText: {
    flex: 1,
    gap: 8,
  },
});
