import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDisplayMode } from '../lib/displayMode';
import { touch } from '../theme';

// Side by side at normal sizes, stacked once the text grows past stackedFontScale, so screens never scroll sideways.
export function Row({ children }: { children: ReactNode }) {
  const { stacked } = useDisplayMode();

  return <View style={[styles.row, stacked && styles.stacked]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: touch.gap,
  },
  stacked: {
    flexDirection: 'column',
  },
});
