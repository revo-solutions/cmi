import { Pressable, StyleSheet, View } from 'react-native';

import { useDisplayMode } from '../lib/displayMode';
import { colors, touch } from '../theme';
import { AppText } from './AppText';

const options = [
  { value: true, label: 'Sim' },
  { value: false, label: 'Não' },
];

// A yes-or-no question; null is not answered yet. Tapping the chosen answer again clears it.
export function YesNo({ question, value, onChange }: { question: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  const { stacked } = useDisplayMode();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={question} style={styles.group}>
      <AppText bold>{question}</AppText>
      <View style={[styles.options, stacked && styles.stacked]}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(selected ? null : option.value)}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: selected ? colors.orchid800 : pressed ? colors.orchid50 : colors.white },
              ]}
            >
              <AppText variant="button" color={selected ? colors.white : colors.orchid800}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  options: {
    flexDirection: 'row',
    gap: touch.gap,
  },
  stacked: {
    flexDirection: 'column',
  },
  option: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: touch.minimum,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.orchid800,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
