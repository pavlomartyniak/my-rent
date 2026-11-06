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
  /** Без власної картки: блок вкладається в іншу картку (прибуток авто) */
  bare?: boolean;
};

/** Наскільки авто вже окупилось: відсоток, смужка, повернуто / залишилось */
export function PaybackCard({ profit, price, eta, bare }: Props) {
  const theme = useTheme();

  if (price <= 0) {
    const hint = (
      <>
        <ThemedText type="default" style={styles.bold}>
          Окупність (ROI)
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Вкажіть вартість авто в редагуванні, щоб бачити, наскільки воно окупилось.
        </ThemedText>
      </>
    );
    return bare ? <View style={styles.bare}>{hint}</View> : <Card>{hint}</Card>;
  }

  const percent = (profit / price) * 100;
  const done = profit >= price;
  const filled = Math.max(0, Math.min(100, percent));
  const returned = Math.max(0, profit);
  const showEta = !done && eta && eta !== '—';

  const body = (
    <>
      <View style={styles.head}>
        <ThemedText type="default" style={styles.bold}>
          Окупність (ROI)
        </ThemedText>
        <ThemedText type="default" style={styles.percent} themeColor={done ? 'positive' : profit < 0 ? 'negative' : 'accent'}>
          {percent < 0 ? '−' : ''}
          {Math.abs(Math.round(percent))}%
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${filled}%`, backgroundColor: done ? theme.positive : theme.accent }]} />
      </View>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Повернуто {formatMoney(returned)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          з {formatMoney(price)}
        </ThemedText>
      </View>

      <View style={styles.tiles}>
        <View style={[styles.tile, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.tileLabel}>
            {done ? 'Вже в плюсі на' : 'Залишилось окупити'}
          </ThemedText>
          <ThemedText type="default" style={styles.bold} themeColor={done ? 'positive' : 'text'} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(done ? profit - price : price - Math.max(0, profit))}
          </ThemedText>
        </View>
        {showEta ? (
          <View style={[styles.tile, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.tileLabel}>
              Окупиться орієнтовно за
            </ThemedText>
            <ThemedText type="default" style={styles.bold} numberOfLines={1} adjustsFontSizeToFit>
              {eta}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </>
  );

  return bare ? <View style={styles.bare}>{body}</View> : <Card>{body}</Card>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: 700 },
  percent: { fontWeight: 700, fontSize: 20 },
  bare: { gap: Spacing.two, marginTop: Spacing.three },
  tiles: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  tile: { flex: 1, borderRadius: Radius.md, padding: Spacing.three, gap: 2 },
  tileLabel: { fontSize: 12, lineHeight: 16 },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden', marginVertical: Spacing.one },
  fill: { height: 8, borderRadius: Radius.pill },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
