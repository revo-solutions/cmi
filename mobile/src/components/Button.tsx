import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, touch } from '../theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'take' | 'sos' | 'secondary' | 'takeSecondary' | 'danger';

const variants: Record<Variant, { background: string; pressed: string; text: string; border?: string; minHeight: number }> = {
  primary: { background: colors.orchid800, pressed: colors.orchid900, text: colors.white, minHeight: touch.main },
  take: { background: colors.leaf800, pressed: colors.leaf900, text: colors.white, minHeight: 72 },
  sos: { background: colors.red700, pressed: colors.orchid900, text: colors.white, minHeight: touch.main },
  secondary: { background: colors.white, pressed: colors.orchid50, text: colors.orchid800, border: colors.orchid800, minHeight: touch.minimum },
  takeSecondary: { background: colors.white, pressed: colors.leaf50, text: colors.leaf800, border: colors.leaf800, minHeight: touch.minimum },
  danger: { background: colors.white, pressed: colors.red50, text: colors.red700, border: colors.red700, minHeight: touch.minimum },
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  // When the word alone doesn't say what it acts on: "Não tomei o remédio das 08:00, Losartana".
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
};

// Icons always sit beside a word (docs/marca/README.md).
export function Button({ label, onPress, variant = 'primary', icon: Icon, accessibilityLabel, accessibilityHint, disabled }: ButtonProps) {
  const style = variants[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: style.minHeight,
          backgroundColor: pressed ? style.pressed : style.background,
          borderColor: style.border ?? 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {Icon && <Icon size={28} strokeWidth={2.5} color={style.text} />}
        <AppText variant="button" color={style.text} style={styles.label}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    textAlign: 'center',
    flexShrink: 1,
  },
});
