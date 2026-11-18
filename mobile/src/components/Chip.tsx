import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { colors, maxFontScale, touch } from '../theme';
import { AppText } from './AppText';

type ChipProps = { label: string; selected: boolean; onPress: () => void; radio?: boolean };

// One choice of a multiple-choice question, such as a health condition, or of a single-choice one with radio.
export function Chip({ label, selected, onPress, radio }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'checkbox'}
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
