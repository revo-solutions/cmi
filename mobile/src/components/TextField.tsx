import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useDisplayMode } from '../lib/displayMode';
import { colors, fonts, text, touch } from '../theme';
import { AppText } from './AppText';

type TextFieldProps = Omit<TextInputProps, 'style'> & { label: string };

export function TextField({ label, ...props }: TextFieldProps) {
  const { textScale } = useDisplayMode();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <AppText bold>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.graphite}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            fontSize: text.body.fontSize * textScale,
            borderColor: focused ? colors.orchid800 : colors.outline,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  input: {
    minHeight: touch.minimum,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
});
