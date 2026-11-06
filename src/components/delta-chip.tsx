import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/**
 * Зміна у відсотках пігулкою: зелена, коли стало краще, червона, коли гірше, сіра без змін чи без даних.
 * `lowerIsBetter` — для витрат: зменшення там добре.
 */
export function DeltaChip({ change, lowerIsBetter }: { change: number | null; lowerIsBetter?: boolean }) {
  const theme = useTheme();
  const rounded = change === null ? 0 : Math.round(change);
  const good = lowerIsBetter ? rounded < 0 : rounded > 0;
  const bad = lowerIsBetter ? rounded > 0 : rounded < 0;
  const [bg, fg] = change === null || (!good && !bad) ? [theme.backgroundSelected, theme.textSecondary] : good ? [theme.positiveSoft, theme.positive] : [theme.negativeSoft, theme.negative];

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <ThemedText type="smallBold" style={[styles.text, { color: fg }]}>
        {change === null ? 'немає даних' : `${rounded > 0 ? '▲ +' : rounded < 0 ? '▼ −' : '● '}${Math.abs(rounded)}%`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  text: { fontSize: 12, lineHeight: 18 },
});
