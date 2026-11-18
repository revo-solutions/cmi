import { useNavigation } from '@react-navigation/native';
import { EyeOff, FileText, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { useRows } from '../../lib/db';
import { colors, maxFontScale } from '../../theme';
import { useMedications } from './store';

export function MedicationsScreen() {
  const navigation = useNavigation();
  const medications = useMedications()?.filter((m) => !m.deleted);
  const hasContact = useRows<{ id: string }>('SELECT id FROM contact LIMIT 1')?.length === 1;

  return (
    <Screen title="Remédios" onProfile={() => navigation.navigate('Profile')}>
      <Button label="Adicionar remédio" icon={Plus} onPress={() => navigation.navigate('MedicationForm', {})} />
      {medications && medications.length > 0 && (
        <Button label="Relatório para a consulta" variant="secondary" icon={FileText} onPress={() => navigation.navigate('Report')} />
      )}

      {medications?.length === 0 && (
        <Card>
          <AppText>Nenhum remédio cadastrado ainda.</AppText>
        </Card>
      )}

      {medications?.map((medication) => {
        const times = medication.times.join(' · ');
        const onlyYou = hasContact && !medication.sharedWithContact;
        return (
          <Pressable
            key={medication.id}
            accessibilityRole="button"
            accessibilityLabel={`${medication.name}${medication.dose ? `, ${medication.dose}` : ''}, ${times}${medication.paused ? ', lembretes pausados' : ''}${onlyYou ? ', só para você' : ''}`}
            accessibilityHint="Abre para editar"
            onPress={() => navigation.navigate('MedicationForm', { id: medication.id })}
          >
            <Card>
              <AppText variant="title">{medication.name}</AppText>
              {medication.dose && <AppText variant="support">{medication.dose}</AppText>}
              <AppText bold>{times}</AppText>
              {medication.paused && <StatusChip status="paused" />}
              {onlyYou && (
                <View style={styles.onlyYou}>
                  <EyeOff size={20} strokeWidth={2.5} color={colors.graphite} />
                  <AppText variant="support" bold maxFontSizeMultiplier={maxFontScale.chip}>Só para você</AppText>
                </View>
              )}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Medications left out of the contact's notices, so the person finds them again (docs/escopo.md, opt-out).
  onlyYou: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
