import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

import { ThemedText } from './themed-text';

export type DonutSlice = { key: string; amount: number; color: string };

const SIZE = 210;
const STROKE = 30;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Кільцева діаграма: сегмент кожної категорії пропорційний її сумі, усередині загальна сума. Між сегментами
 * лишається вузька щілина, щоб сусідні кольори не зливались.
 */
export function DonutChart({ slices, label = 'усього' }: { slices: DonutSlice[]; label?: string }) {
  const theme = useTheme();
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  let offset = 0;

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${label}: ${formatMoney(total)}`}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Початок відліку зверху, а не справа: так читається природніше */}
        <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={theme.backgroundSelected} strokeWidth={STROKE} fill="none" />
          {total > 0
            ? slices.map((s) => {
                const length = (s.amount / total) * CIRCUMFERENCE;
                const gap = slices.length > 1 ? Math.min(3, length * 0.3) : 0;
                const circle = (
                  <Circle
                    key={s.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke={s.color}
                    strokeWidth={STROKE}
                    fill="none"
                    strokeDasharray={`${Math.max(0, length - gap)} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return circle;
              })
            : null}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <ThemedText type="subtitle" style={styles.total} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {formatMoney(total)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: SIZE - STROKE * 2 - Spacing.three, gap: 2 },
  total: { fontWeight: 700, textAlign: 'center' },
});
