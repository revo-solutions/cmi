import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { isValidDate, toIsoDate, type DateDraft } from '../../lib/dateFields';
import { reconcileReminders } from '../../lib/reminders';
import { useSession } from '../../lib/session';
import { colors } from '../../theme';
import { localDate } from '../medications/doses';
import { saveProfile, useProfile, type Profile } from './store';

// The server's ProfileModelValidator limit.
const maxNameLength = 100;

// Empty until the person types it: a guessed birthday would be celebrated, and told to the family, on the wrong day.
function toDraft(date: string | null): DateDraft {
  if (!date) {
    return { day: null, month: null, year: null };
  }
  const [year, month, day] = date.split('-').map(Number);
  return { day, month, year };
}

// Name and birth date, the first step of setup and an edit from Perfil.
export function AboutForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const profile = useProfile();
  return profile ? <Form profile={profile} submitLabel={submitLabel} onSaved={onSaved} /> : null;
}

function Form({ profile, submitLabel, onSaved }: { profile: Profile; submitLabel: string; onSaved: () => void }) {
  const suggestedName = useSession()?.suggestedName;
  const today = localDate(new Date());
  const thisYear = Number(today.slice(0, 4));
  const [name, setName] = useState(profile.name ?? suggestedName ?? '');
  const [birth, setBirth] = useState(toDraft(profile.birthDate));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const birthDate = isValidDate(birth) ? toIsoDate(birth) : null;
    const problem = !name.trim() ? 'Escreva seu nome.'
      : !birthDate ? 'Preencha o dia, o mês e o ano em que você nasceu.'
      : birthDate > today ? 'A data de nascimento não pode ser depois de hoje.'
      : '';
    setError(problem);
    if (problem || saving) {
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ name: name.trim(), birthDate });
      await reconcileReminders();
      onSaved();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TextField
        label="Seu nome" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name"
        maxLength={maxNameLength}
      />
      <AppText variant="support">É assim que o app e o seu familiar vão chamar você.</AppText>

      <AppText variant="title" accessibilityRole="header">Data de nascimento</AppText>
      <DateField value={birth} onChange={setBirth} years={{ min: 1900, max: thisYear, start: thisYear - 70 }} />
      <AppText variant="support">No seu aniversário, o app manda os parabéns.</AppText>

      {error !== '' && (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.orchid900}>{error}</AppText>
      )}
      <Button label={submitLabel} onPress={() => void save()} disabled={saving} />
    </>
  );
}

export function AboutScreen() {
  const navigation = useNavigation();
  return (
    <Screen title="Sobre você" onBack={() => navigation.goBack()}>
      <AboutForm submitLabel="Salvar" onSaved={() => navigation.goBack()} />
    </Screen>
  );
}
