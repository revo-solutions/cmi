import { useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Row } from '../../components/Row';
import { Screen } from '../../components/Screen';
import { takeDose, undoDose } from '../../lib/reminders';
import { DoseRow } from '../today/TodayScreen';
import { addDays, localDate, type Dose } from './doses';
import { formatDay } from './format';
import { useDoses, useNow } from './useToday';

type Props = StaticScreenProps<{ date?: string }>;

// The doses of a day, read with the schedule they had, with "Não tomei" to correct an accidental tap and "Tomei" for
// one forgotten (canvas, "Histórico do dia").
export function HistoryScreen({ route }: Props) {
  const navigation = useNavigation();
  const now = useNow();
  const today = localDate(now);
  const [date, setDate] = useState(route.params?.date ?? today);
  const { doses } = useDoses(date, now);

  return (
    <Screen title="Histórico" onBack={() => navigation.goBack()}>
      <View style={styles.day}>
        <AppText variant="title" accessibilityRole="header">{date === today ? `Hoje, ${formatDay(date).toLowerCase()}` : formatDay(date)}</AppText>
        <Row>
          <View style={styles.dayButton}>
            <Button label="Dia anterior" variant="secondary" icon={ChevronLeft} onPress={() => setDate(addDays(date, -1))} />
          </View>
          <View style={styles.dayButton}>
            <Button label="Próximo dia" variant="secondary" icon={ChevronRight} disabled={date >= today} onPress={() => setDate(addDays(date, 1))} />
          </View>
        </Row>
      </View>

      {doses?.length === 0 && (
        <Card>
          <AppText>Nenhum remédio neste dia.</AppText>
        </Card>
      )}

      {doses && doses.length > 0 && (
        <Card style={styles.list}>
          {doses.map((dose, index) => (
            <DoseRow key={`${dose.medication.id} ${dose.time}`} dose={dose} last={index === doses.length - 1} action={<DoseAction dose={dose} />} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

function DoseAction({ dose }: { dose: Dose }) {
  const { medication, date, time, state } = dose;
  const about = `das ${time}, ${medication.name}`;

  if (state === 'taken') {
    return (
      <Button
        label="Não tomei"
        variant="secondary"
        icon={X}
        accessibilityLabel={`Não tomei o remédio ${about}`}
        onPress={() => void undoDose(medication.id, date, time)}
      />
    );
  }

  if (state === 'pending' || state === 'unconfirmed') {
    return (
      <Button
        label="Tomei"
        variant="takeSecondary"
        icon={Check}
        accessibilityLabel={`Tomei o remédio ${about}`}
        onPress={() => void takeDose(medication.id, date, time)}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  day: {
    gap: 10,
  },
  dayButton: {
    flexGrow: 1,
    minWidth: 150,
  },
  list: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
});
