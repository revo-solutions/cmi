import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { colors, maxFontScale, touch } from '../theme';
import { AppText } from './AppText';

// One choice of a multiple-choice question, such as a health condition.
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.orchid100 : pressed ? colors.orchid50 : colors.white,
          borderColor: selected ? colors.orchid800 : colors.outline,
        },
      ]}
    >
      {selected && <Check size={24} strokeWidth={2.5} color={colors.orchid800} />}
      <AppText bold={selected} maxFontSizeMultiplier={maxFontScale.chip} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touch.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    flexShrink: 1,
  },
});
