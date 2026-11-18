import { Minus, Plus } from 'lucide-react-native';
import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useDisplayMode } from '../lib/displayMode';
import { colors, fonts, text, touch } from '../theme';
import { AppText } from './AppText';
import { FieldHint } from './FieldHint';

type NumberFieldProps = {
  label: string;
  // Null shows an empty box, waiting to be filled in.
  value: number | null;
  digits: number;
  onStep: (delta: number) => void;
  onType: (value: number) => string | void;
  onClear?: () => void;
  hint?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  onNext?: () => void;
};

// One part of a date or time: a large value that can be typed, between minus and plus buttons. Never the system's
// pickers (AGENTS.md, "Mobile"). The label sits beside it, or above once the text grows.
export function NumberField({ label, value, digits, onStep, onType, onClear, hint, ref, onNext }: NumberFieldProps) {
  const { textScale, stacked } = useDisplayMode();
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string>();
  const shown = value === null ? '' : String(value).padStart(digits, '0');
  const displayed = draft ?? shown;
  const emptyHint = displayed === '' ? hint : undefined;

  const commit = () => {
    if (draft === null) {
      return !error;
    }

    let problem: string | void = undefined;
    if (draft === '') {
      onClear?.();
    } else if (/^\d+$/.test(draft)) {
      problem = onType(Number(draft));
    }
    setError(problem || undefined);
    if (problem) {
      return false;
    }
    setDraft(null);
    return true;
  };

  const step = (delta: number) => {
    setDraft(null);
    setError(undefined);
    onStep(delta);
  };

  return (
    <View style={styles.group}>
      {focused && emptyHint && <FieldHint text={emptyHint} />}
      <View style={[styles.field, stacked && styles.stacked]}>
        <AppText bold style={!stacked && styles.inlineLabel}>{label}</AppText>
        <View style={[styles.row, stacked && styles.wide]}>
          <StepButton label={`${label}: diminuir`} icon="minus" onPress={() => step(-1)} />
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            accessibilityHint={error ?? emptyHint}
            value={displayed}
            onChangeText={setDraft}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit();
            }}
            onSubmitEditing={() => {
              if (commit()) {
                onNext?.();
              }
            }}
            keyboardType="number-pad"
            returnKeyType={onNext ? 'next' : hint ? 'done' : undefined}
            submitBehavior={onNext ? 'submit' : undefined}
            maxLength={digits}
            selectTextOnFocus
            style={[
              styles.value,
              { fontSize: text.title.fontSize * 1.2 * textScale, width: stacked ? undefined : (digits * 16 + 40) * textScale },
              focused && styles.focused,
              error && styles.invalid,
              stacked && styles.wideValue,
            ]}
          />
          <StepButton label={`${label}: aumentar`} icon="plus" onPress={() => step(1)} />
        </View>
      </View>
      {error && <AppText accessibilityLiveRegion="polite" variant="support" color={colors.orchid900}>{error}</AppText>}
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
  group: {
    gap: 6,
  },
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
  focused: {
    borderColor: colors.orchid800,
  },
  invalid: {
    borderColor: colors.red700,
  },
});
