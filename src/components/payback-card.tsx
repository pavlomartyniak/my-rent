import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

import { ThemedText } from './themed-text';
import { Card } from './ui/card';

type Props = {
  /** Чистий прибуток за весь час */
  profit: number;
  /** Вартість авто */
  price: number;
  /** Орієнтовний час до окупності, напр. «≈ 1 р. 4 міс» */
  eta?: string;
};

/** Наскільки авто вже окупилось: відсоток, смужка, повернуто / залишилось */
export function PaybackCard({ profit, price, eta }: Props) {
  const theme = useTheme();

  if (price <= 0) {
    return (
      <Card>
        <ThemedText type="default" style={styles.bold}>
          Окупність (ROI)
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Вкажіть вартість авто в редагуванні, щоб бачити, наскільки воно окупилось.
        </ThemedText>
      </Card>
    );
  }

  const percent = (profit / price) * 100;
  const done = profit >= price;
  const filled = Math.max(0, Math.min(100, percent));
  const returned = Math.max(0, profit);

  return (
    <Card>
      <View style={styles.head}>
        <ThemedText type="default" style={styles.bold}>
          Окупність (ROI)
        </ThemedText>
        <ThemedText type="default" style={styles.bold} themeColor={done ? 'positive' : profit < 0 ? 'negative' : 'accent'}>
          {percent < 0 ? '−' : ''}
          {Math.abs(Math.round(percent))}%
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${filled}%`, backgroundColor: done ? theme.positive : theme.accent }]} />
      </View>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Повернуто
        </ThemedText>
        <ThemedText type="smallBold">
          {formatMoney(returned)} з {formatMoney(price)}
        </ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          {done ? 'Вже в плюсі на' : 'Залишилось окупити'}
        </ThemedText>
        <ThemedText type="smallBold" themeColor={done ? 'positive' : 'text'}>
          {formatMoney(done ? profit - price : price - Math.max(0, profit))}
        </ThemedText>
      </View>
      {!done && eta && eta !== '—' ? (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Орієнтовно окупиться за
          </ThemedText>
          <ThemedText type="smallBold">{eta}</ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: 600 },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden', marginVertical: Spacing.one },
  fill: { height: 8, borderRadius: Radius.pill },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
