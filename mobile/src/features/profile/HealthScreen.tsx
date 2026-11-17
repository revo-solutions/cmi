import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { YesNo } from '../../components/YesNo';
import { useDisplayMode } from '../../lib/displayMode';
import { colors, touch } from '../../theme';
import { healthConditions, otherCondition, toggleCondition } from './health';
import { saveProfile, useProfile, type Profile } from './store';

// The server's ProfileModelValidator limit.
const maxOtherLength = 200;

type HealthFormProps = { submitLabel: string; onSaved: () => void; onSkip?: () => void };

// The health questionnaire, on one screen: the setup step, and an edit from Perfil.
export function HealthForm(props: HealthFormProps) {
  const profile = useProfile();
  return profile ? <Form profile={profile} {...props} /> : null;
}

function Form({ profile, submitLabel, onSaved, onSkip }: HealthFormProps & { profile: Profile }) {
  const { largeText, setLargeText } = useDisplayMode();
  const [conditions, setConditions] = useState(profile.conditions);
  const [other, setOther] = useState(profile.otherCondition ?? '');
  const [livesAlone, setLivesAlone] = useState(profile.livesAlone);
  const [fellLastYear, setFellLastYear] = useState(profile.fellLastYear);
  const [visionDifficulty, setVisionDifficulty] = useState(profile.visionDifficulty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const hasOther = conditions.includes(otherCondition);

  const save = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveProfile({
        conditions, otherCondition: hasOther ? other.trim() || null : null, livesAlone, fellLastYear, visionDifficulty,
      });
      onSaved();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {onSkip && (
        <Card>
          <AppText>As respostas ajudam a mostrar artigos que combinam com você. Se preferir, responda depois.</AppText>
          <Button label="Pular" variant="secondary" onPress={onSkip} disabled={saving} />
        </Card>
      )}

      <View style={styles.section}>
        <AppText variant="title" accessibilityRole="header">Você tem algum destes problemas de saúde?</AppText>
        <AppText variant="support">Marque todos que tiver.</AppText>
        <View style={styles.chips}>
          {healthConditions.map(({ code, label }) => (
            <Chip
              key={code} label={label} selected={conditions.includes(code)}
              onPress={() => setConditions(toggleCondition(conditions, code))}
            />
          ))}
        </View>
        {hasOther && <TextField label="Qual outro problema?" value={other} onChangeText={setOther} maxLength={maxOtherLength} />}
      </View>

      <View style={styles.section}>
        <YesNo question="Você mora só?" value={livesAlone} onChange={setLivesAlone} />
        <YesNo question="Você caiu alguma vez nos últimos 12 meses?" value={fellLastYear} onChange={setFellLastYear} />
        <YesNo question="Você tem dificuldade para enxergar?" value={visionDifficulty} onChange={setVisionDifficulty} />
      </View>

      {visionDifficulty && (
        <Card>
          <YesNo question="Letras grandes e mais contraste" value={largeText} onChange={(on) => setLargeText(on ?? false)} />
          <AppText variant="support">Vale só para este celular. Você pode mudar no Perfil.</AppText>
        </Card>
      )}

      {error !== '' && (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.orchid900}>{error}</AppText>
      )}
      <Button label={submitLabel} onPress={() => void save()} disabled={saving} />
    </>
  );
}

export function HealthScreen() {
  const navigation = useNavigation();
  return (
    <Screen title="Sua saúde" onBack={() => navigation.goBack()}>
      <HealthForm submitLabel="Salvar" onSaved={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: touch.gap,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
