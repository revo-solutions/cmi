import { useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { Check, Pause, Play, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { TimeField } from '../../components/TimeField';
import { formatTime, parseTime, type Time } from '../../lib/dateFields';
import { useRows } from '../../lib/db';
import { useDisplayMode } from '../../lib/displayMode';
import { reconcileReminders, reminderPermission } from '../../lib/reminders';
import { colors } from '../../theme';
import type { Medication } from './doses';
import { countDailyReminders, maxDailyReminders } from './reminderPlan';
import { deleteMedication, saveMedication, setPaused, useMedications } from './store';

type Props = StaticScreenProps<{ id?: string }>;

// Adding or editing a medication (canvas, "Editar remédio"). An edit waits for the medication to load, so the form
// starts from it.
export function MedicationFormScreen({ route }: Props) {
  const navigation = useNavigation();
  const id = route.params?.id ?? null;
  const medications = useMedications();
  const medication = medications?.find((m) => m.id === id);

  if (!medications || (id && !medication)) {
    return <Screen title="Editar remédio" onBack={() => navigation.goBack()}>{null}</Screen>;
  }

  return <MedicationForm medication={medication ?? null} medications={medications} />;
}

// One time open for editing at a time.
function MedicationForm({ medication, medications }: { medication: Medication | null; medications: Medication[] }) {
  const navigation = useNavigation();
  const id = medication?.id ?? null;
  const contact = useRows<{ name: string }>('SELECT name FROM contact LIMIT 1')?.[0];

  const [name, setName] = useState(medication?.name ?? '');
  const [dose, setDose] = useState(medication?.dose ?? '');
  const [times, setTimes] = useState<Time[]>(() => medication ? medication.times.map((time) => parseTime(time)!) : [{ hour: 8, minute: 0 }]);
  const [editing, setEditing] = useState<number | null>(medication ? null : 0);
  // Shared by default, with an opt-out per medication (docs/escopo.md); only matters once there is a contact.
  const [shared, setShared] = useState(medication?.sharedWithContact ?? true);
  const [error, setError] = useState('');

  const save = async () => {
    const formatted = times.map(formatTime);
    const others = countDailyReminders(medications.filter((m) => m.id !== id));
    const problem = !name.trim() ? 'Escreva o nome do remédio.'
      : formatted.length === 0 ? 'Adicione pelo menos um horário.'
      : new Set(formatted).size < formatted.length ? 'Há dois horários iguais. Remova um deles.'
      : others + formatted.length > maxDailyReminders ? `O celular guarda até ${maxDailyReminders} lembretes por dia. Remova algum horário.`
      : '';
    setError(problem);
    if (problem) {
      return;
    }

    await saveMedication(id, { name: name.trim(), dose: dose.trim() || null, times: formatted, sharedWithContact: Boolean(contact) && shared });
    await reconcileReminders();
    await reminderPermission(true);
    navigation.goBack();
  };

  const togglePause = async () => {
    if (medication) {
      await setPaused(medication.id, !medication.paused);
      await reconcileReminders();
    }
  };

  const remove = () => {
    Alert.alert('Excluir este remédio?', 'Os lembretes dele param. O histórico das doses continua guardado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void deleteMedication(id!).then(reconcileReminders).then(() => navigation.goBack());
        },
      },
    ]);
  };

  const addTime = () => {
    const last = times.at(-1);
    setTimes([...times, { hour: last ? (last.hour + 4) % 24 : 8, minute: last?.minute ?? 0 }]);
    setEditing(times.length);
  };

  return (
    <Screen title={id ? 'Editar remédio' : 'Novo remédio'} onBack={() => navigation.goBack()}>
      <TextField label="Nome do remédio" value={name} onChangeText={setName} autoCapitalize="sentences" />
      <TextField label="Dose e como tomar (opcional)" value={dose} onChangeText={setDose} placeholder="50 mg, 1 comprimido" />

      <View style={styles.section}>
        <AppText variant="title" accessibilityRole="header">Horários</AppText>
        {times.map((time, index) => (
          <TimeCard
            key={index}
            time={time}
            editing={editing === index}
            onEdit={() => setEditing(index)}
            onChange={(next) => setTimes(times.map((t, i) => (i === index ? next : t)))}
            onRemove={() => {
              setTimes(times.filter((_, i) => i !== index));
              setEditing(null);
            }}
          />
        ))}
        <Button label="Adicionar horário" variant="secondary" icon={Plus} onPress={addTime} />
      </View>

      {contact && (
        <Card>
          <AppText>
            {shared
              ? `${contact.name} acompanha este remédio pelo WhatsApp: o resumo do dia e um aviso quando não recebermos a confirmação.`
              : `Só você vê este remédio. ${contact.name} não recebe nada sobre ele.`}
          </AppText>
          <Chip label={`Não compartilhar este remédio com ${contact.name}`} selected={!shared} onPress={() => setShared(!shared)} />
        </Card>
      )}

      {error !== '' && (
        <AppText bold color={colors.red700} accessibilityRole="alert">{error}</AppText>
      )}

      <Button label="Salvar" icon={Check} onPress={() => void save()} />

      {medication && (
        <View style={styles.more}>
          <Button
            label={medication.paused ? 'Retomar lembretes' : 'Pausar lembretes'}
            variant="secondary"
            icon={medication.paused ? Play : Pause}
            onPress={() => void togglePause()}
          />
          <Button label="Excluir remédio" variant="danger" icon={Trash2} onPress={remove} />
        </View>
      )}
    </Screen>
  );
}

type TimeCardProps = {
  time: Time;
  editing: boolean;
  onEdit: () => void;
  onChange: (time: Time) => void;
  onRemove: () => void;
};

function TimeCard({ time, editing, onEdit, onChange, onRemove }: TimeCardProps) {
  const { stacked } = useDisplayMode();

  if (!editing) {
    return (
      <Card style={!stacked && styles.closed}>
        <AppText variant="screen">{formatTime(time)}</AppText>
        <Button label="Mudar" variant="secondary" accessibilityLabel={`Mudar o horário das ${formatTime(time)}`} onPress={onEdit} />
      </Card>
    );
  }

  return (
    <Card>
      <AppText variant="screen">{formatTime(time)}</AppText>
      <TimeField value={time} onChange={onChange} />
      <Button label="Remover este horário" variant="secondary" onPress={onRemove} />
    </Card>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  more: {
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
