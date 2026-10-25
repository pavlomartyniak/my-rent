import { StyleSheet, View } from 'react-native';

import { ChatButton } from './chat-button';
import { ThemedText } from './themed-text';

/** Заголовок головного екрана: назва ліворуч, кнопка повідомлень праворуч */
export function ScreenTitle({ children }: { children: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
        {children}
      </ThemedText>
      <ChatButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
});
