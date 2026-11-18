import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';
import { AppText } from './AppText';

export function FieldHint({ text }: { text: string }) {
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.hint}>
      <AppText variant="support" color={colors.white}>{text}</AppText>
      <View style={styles.arrow} />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: colors.orchid900,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 4,
  },
  arrow: {
    position: 'absolute',
    left: 19,
    bottom: -4,
    width: 10,
    height: 10,
    backgroundColor: colors.orchid900,
    transform: [{ rotate: '45deg' }],
  },
});
