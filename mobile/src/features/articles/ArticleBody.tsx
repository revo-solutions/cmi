import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { parseMarkdown, type Inline } from './markdown';

function Text({ parts }: { parts: Inline[] }) {
  return (
    <AppText>
      {parts.map((part, index) => (part.bold ? <AppText key={index} bold>{part.text}</AppText> : part.text))}
    </AppText>
  );
}

// Drawn with the app's own text, so an article grows with the system font and the large-text mode.
export function ArticleBody({ children }: { children: string }) {
  return (
    <View style={styles.body}>
      {parseMarkdown(children).map((block, index) => {
        if (block.type === 'heading') {
          return (
            <AppText key={index} variant="title" accessibilityRole="header" style={styles.heading}>
              {block.text.map((part) => part.text).join('')}
            </AppText>
          );
        }
        if (block.type === 'paragraph') {
          return <Text key={index} parts={block.text} />;
        }
        return (
          <View key={index} style={styles.list}>
            {block.items.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.item}>
                <AppText bold>{block.ordered ? `${itemIndex + 1}.` : '•'}</AppText>
                <View style={styles.itemText}>
                  <Text parts={item} />
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
  },
  heading: {
    marginTop: 8,
  },
  list: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    gap: 10,
  },
  itemText: {
    flex: 1,
  },
});
