import { StyleSheet, View } from 'react-native';

import { Radius, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/**
 * Зміна у відсотках пігулкою: зелена, коли стало краще, червона, коли гірше, сіра без змін. Коли порівнювати нема з чим (у минулому періоді даних немає), показує прочерк.
 * `lowerIsBetter` — для витрат: зменшення там добре.
 */
export function DeltaChip({ change, lowerIsBetter }: { change: number | null; lowerIsBetter?: boolean }) {
  const theme = useTheme();
  if (change === null) return <ThemedText type="smallBold" themeColor="textSecondary">–</ThemedText>;
  const rounded = Math.round(change);
  const good = lowerIsBetter ? rounded < 0 : rounded > 0;
  const bad = lowerIsBetter ? rounded > 0 : rounded < 0;
  const [bg, fg] = !good && !bad ? [theme.backgroundSelected, theme.textSecondary] : good ? [theme.positiveSoft, theme.positive] : [theme.negativeSoft, theme.negative];

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <ThemedText type="smallBold" style={[styles.text, { color: fg }]}>
        {`${rounded > 0 ? '▲ ' : rounded < 0 ? '▼ ' : '● '}${Math.abs(rounded)}%`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  text: { ...Type.caption },
});
