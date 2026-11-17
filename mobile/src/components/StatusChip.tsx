import { CircleCheck, CircleHelp, Clock3 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, maxFontScale } from '../theme';
import { AppText } from './AppText';

export type DoseStatus = 'pending' | 'taken' | 'unconfirmed';

const statuses = {
  pending: { word: 'Pendente', icon: Clock3, text: colors.orchid800, background: colors.orchid50 },
  taken: { word: 'Registrado', icon: CircleCheck, text: colors.leaf800, background: colors.leaf50 },
  unconfirmed: { word: 'Sem confirmação', icon: CircleHelp, text: colors.amber800, background: colors.amber50 },
};

// A dose's state always carries an icon and a word, never color alone. The label can say more ("Registrado às 8:05").
export function StatusChip({ status, label }: { status: DoseStatus; label?: string }) {
  const { word, icon: Icon, text, background } = statuses[status];

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: {
    flexShrink: 1,
  },
});
