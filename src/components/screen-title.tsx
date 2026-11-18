import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

/** Заголовок головного екрана: назва ліворуч, кнопка повідомлень праворуч */
export function ScreenTitle({ children, actions }: { children: string; /** Додаткові кнопки перед кнопкою повідомлень, напр. експорт */ actions?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <ThemedText type="display" style={styles.title} numberOfLines={1} accessibilityRole="header">
        {children}
      </ThemedText>
      <View style={styles.actions}>
        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
