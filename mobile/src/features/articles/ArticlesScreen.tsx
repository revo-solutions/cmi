import { useNavigation } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { articles } from '../../content';
import { colors } from '../../theme';
import { useProfile } from '../profile/store';
import { articleSections } from './articles';

export function ArticlesScreen() {
  const navigation = useNavigation();
  const profile = useProfile();
  const sections = articleSections(articles, profile?.conditions ?? []);

  return (
    <Screen title="Artigos" onProfile={() => navigation.navigate('Profile')}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <AppText variant="title" accessibilityRole="header">{section.title}</AppText>
          {section.articles.map((article) => (
            <Pressable
              key={article.slug}
              accessibilityRole="button"
              accessibilityLabel={`${article.title}, ${article.theme}`}
              accessibilityHint="Abre o artigo"
              onPress={() => navigation.navigate('Article', { slug: article.slug })}
            >
              {({ pressed }) => (
                <Card style={[styles.card, pressed && styles.pressed]}>
                  <View style={styles.text}>
                    <AppText bold>{article.title}</AppText>
                    <AppText variant="support">{article.theme}</AppText>
                  </View>
                  <ChevronRight size={28} strokeWidth={2.5} color={colors.orchid800} />
                </Card>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    backgroundColor: colors.orchid50,
  },
  text: {
    flex: 1,
    gap: 4,
  },
});
