import { ChevronLeft, CircleUserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDisplayMode } from '../lib/displayMode';
import { colors, touch } from '../theme';
import { AppText } from './AppText';
import { LogoSymbol } from './Logo';

type ScreenProps = {
  title: string;
  subtitle?: string;
  // A tab's screen shows the profile button; a pushed one shows "Voltar".
  onProfile?: () => void;
  onBack?: () => void;
  children: ReactNode;
};

// A screen's frame: the safe area, a header the system font can grow, and content that scrolls only vertically.
export function Screen({ title, subtitle, onProfile, onBack, children }: ScreenProps) {
  const { contrast } = useDisplayMode();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={onBack}
            style={({ pressed }) => [styles.back, { borderColor: contrast.border, backgroundColor: pressed ? colors.orchid50 : colors.white }]}
          >
            <ChevronLeft size={28} strokeWidth={2.5} color={colors.ink} />
            <AppText variant="button">Voltar</AppText>
          </Pressable>
        )}
        <View style={styles.header}>
          {onProfile && <LogoSymbol size={44} />}
          <View style={styles.titles}>
            {subtitle && <AppText variant="support">{subtitle}</AppText>}
            <AppText variant="screen" accessibilityRole="header">
              {title}
            </AppText>
          </View>
          {onProfile && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Perfil"
              onPress={onProfile}
              style={({ pressed }) => [styles.profile, { borderColor: contrast.border, backgroundColor: pressed ? colors.orchid50 : colors.white }]}
            >
              <CircleUserRound size={28} strokeWidth={2.5} color={colors.orchid800} />
            </Pressable>
          )}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: touch.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 18,
    borderWidth: 2,
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titles: {
    flex: 1,
  },
  profile: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
