import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useDisplayMode } from '../lib/displayMode';
import { colors } from '../theme';

export function Card({ children, style, ...props }: ViewProps & { children: ReactNode }) {
  const { contrast } = useDisplayMode();

  return (
    <View {...props} style={[styles.card, { borderColor: contrast.border, borderWidth: contrast.borderWidth }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
});
