import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useDisplayMode } from '../lib/displayMode';
import { colors, fonts, text, touch } from '../theme';
import { AppText } from './AppText';

type NumberFieldProps = {
  label: string;
  value: number;
  digits: number;
  onStep: (delta: number) => void;
  // A typed number, already a whole number; the caller decides whether it fits.
  onType: (value: number) => void;
};

// One part of a date or time: a large value that can be typed, between minus and plus buttons. Never the system's
// pickers (AGENTS.md, "Mobile"). The label sits beside it, or above once the text grows.
export function NumberField({ label, value, digits, onStep, onType }: NumberFieldProps) {
  const { textScale, stacked } = useDisplayMode();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = String(value).padStart(digits, '0');

  const commit = () => {
    if (draft !== null && /^\d+$/.test(draft)) {
      onType(Number(draft));
    }
    setDraft(null);
  };

  return (
    <View style={[styles.field, stacked && styles.stacked]}>
      <AppText bold style={!stacked && styles.inlineLabel}>{label}</AppText>
      <View style={[styles.row, stacked && styles.wide]}>
        <StepButton label={`${label}: diminuir`} icon="minus" onPress={() => onStep(-1)} />
        <TextInput
          accessibilityLabel={label}
          value={draft ?? shown}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          maxLength={digits}
          selectTextOnFocus
          style={[
            styles.value,
            { fontSize: text.title.fontSize * 1.2 * textScale, width: stacked ? undefined : (digits * 16 + 40) * textScale },
            stacked && styles.wideValue,
          ]}
        />
        <StepButton label={`${label}: aumentar`} icon="plus" onPress={() => onStep(1)} />
      </View>
    </View>
  );
}

function StepButton({ label, icon, onPress }: { label: string; icon: 'minus' | 'plus'; onPress: () => void }) {
  const Icon = icon === 'minus' ? Minus : Plus;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.step, { backgroundColor: pressed ? colors.orchid100 : colors.orchid50 }]}
    >
      <Icon size={28} strokeWidth={2.5} color={colors.orchid800} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  inlineLabel: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wide: {
    alignSelf: 'stretch',
  },
  step: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.orchid800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minHeight: touch.minimum,
    borderWidth: 2,
    borderColor: colors.outline,
    borderRadius: 14,
    backgroundColor: colors.white,
    color: colors.ink,
    fontFamily: fonts.bold,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  wideValue: {
    flex: 1,
  },
});
