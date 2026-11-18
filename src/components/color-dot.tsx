import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { colorHex } from '@/lib/car-info';

import { ThemedText } from './themed-text';

/** Колір авто: кружечок відповідного відтінку й назва (кружечка немає, якщо відтінок невідомий) */
export function ColorDot({ color }: { color?: string | null }) {
  const theme = useTheme();
  if (!color) return null;
  const hex = colorHex(color);
  return (
    <View style={styles.row}>
      {hex ? <View style={[styles.dot, { backgroundColor: hex, borderColor: theme.borderStrong }]} /> : null}
      <ThemedText type="small" themeColor="textSecondary">
        {color}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 5 }, dot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth } });
