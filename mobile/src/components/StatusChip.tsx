import { CircleCheck, CircleHelp, Clock3, Pause } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { DoseState } from '../features/medications/doses';
import { colors, maxFontScale } from '../theme';
import { AppText } from './AppText';

const statuses = {
  pending: { word: 'Pendente', icon: Clock3, text: colors.orchid800, background: colors.orchid50, border: colors.orchid50 },
  taken: { word: 'Registrado', icon: CircleCheck, text: colors.leaf800, background: colors.leaf50, border: colors.leaf50 },
  unconfirmed: { word: 'Sem confirmação', icon: CircleHelp, text: colors.amber800, background: colors.amber50, border: colors.amber50 },
  // A pause is never shown as forgetting.
  paused: { word: 'Lembrete pausado', icon: Pause, text: colors.graphite, background: colors.white, border: colors.outline },
};

// A dose's state always carries an icon and a word, never color alone. The label can say more ("Tomado às 8:05").
export function StatusChip({ status, label }: { status: DoseState; label?: string }) {
  const { word, icon: Icon, text, background, border } = statuses[status];

  return (
    <View style={[styles.chip, { backgroundColor: background, borderColor: border }]}>
      <Icon size={20} strokeWidth={2.5} color={text} />
      <AppText variant="support" bold color={text} maxFontSizeMultiplier={maxFontScale.chip} style={styles.label}>
        {label ?? word}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: {
    flexShrink: 1,
  },
});
