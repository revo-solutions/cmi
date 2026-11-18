import { useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { articles } from '../../content';
import { ArticleBody } from './ArticleBody';

type Props = StaticScreenProps<{ slug: string }>;

export function ArticleScreen({ route }: Props) {
  const navigation = useNavigation();
  const article = articles.find((a) => a.slug === route.params.slug);

  if (!article) {
    return (
      <Screen title="Artigos" onBack={() => navigation.goBack()}>
        <AppText>Este artigo não está mais disponível.</AppText>
      </Screen>
    );
  }
  return (
    <Screen title={article.title} subtitle={article.theme} onBack={() => navigation.goBack()}>
      <ArticleBody>{article.body}</ArticleBody>
      <Button label="Voltar" variant="secondary" icon={ChevronLeft} onPress={() => navigation.goBack()} />
    </Screen>
  );
}
