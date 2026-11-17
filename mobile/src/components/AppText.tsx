import { Text, type TextProps } from 'react-native';

import { useDisplayMode } from '../lib/displayMode';
import { colors, fonts, text } from '../theme';

type Variant = keyof typeof text;

const boldVariants: Variant[] = ['screen', 'title', 'button'];

type AppTextProps = TextProps & {
  variant?: Variant;
  bold?: boolean;
  color?: string;
};

// Every text in the app: a variant from the type scale, grown by the system font and by the app's large-text mode.
// Supporting text turns to ink in that mode.
export function AppText({ variant = 'body', bold, color, style, ...props }: AppTextProps) {
  const { textScale, contrast } = useDisplayMode();
  const { fontSize, lineHeight } = text[variant];

  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: bold ?? boldVariants.includes(variant) ? fonts.bold : fonts.regular,
          fontSize: fontSize * textScale,
          lineHeight: lineHeight * textScale,
          color: color ?? (variant === 'support' ? contrast.supportText : colors.ink),
        },
        style,
      ]}
    />
  );
}
