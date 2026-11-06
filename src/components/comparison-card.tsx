import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import type { SummaryReport } from '@/lib/reports';

import { DeltaChip } from './delta-chip';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';

type Props = {
  title: string;
  /** Підпис попереднього періоду, напр. «Вересень 2026» */
  previousLabel: string;
  report: Pick<SummaryReport, 'totals' | 'change'>;
};

function Row({ label, value, delta, lowerIsBetter }: { label: string; value: string; delta: number | null; lowerIsBetter?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="default" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={styles.value}>
        {value}
      </ThemedText>
      <View style={styles.delta}>
        <DeltaChip change={delta} lowerIsBetter={lowerIsBetter} />
      </View>
    </View>
  );
}

/** Прибуток, доходи, витрати й маржа відносно попереднього періоду */
export function ComparisonCard({ title, previousLabel, report }: Props) {
  const { totals: current, change } = report;
  const m = current.margin;
  const theme = useTheme();
  const marginShift = change.marginPoints === null ? null : Math.round(change.marginPoints);

  return (
    <Card style={styles.card}>
      <View>
        <ThemedText type="default" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {previousLabel}
        </ThemedText>
      </View>

      <Row label="Прибуток" value={formatMoney(current.profit)} delta={change.profit} />
      <Row label="Доходи" value={formatMoney(current.income)} delta={change.income} />
      <Row label="Витрати" value={formatMoney(current.expense)} delta={change.expense} lowerIsBetter />

      <View style={styles.margin}>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.label}>
            Маржа
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            яка частина доходу стає прибутком
          </ThemedText>
        </View>
        <View style={styles.marginRight}>
          <ThemedText type="default" style={styles.value} themeColor={m !== null && m < 0 ? 'negative' : 'text'}>
            {m === null ? '—' : `${Math.round(m)}%`}
          </ThemedText>
          {marginShift !== null && marginShift !== 0 ? (
            <ThemedText type="small" themeColor={marginShift > 0 ? 'positive' : 'negative'}>
              {marginShift > 0 ? '+' : '−'}
              {Math.abs(marginShift)} п.п.
            </ThemedText>
          ) : null}
        </View>
      </View>
      {m !== null ? (
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.fill, { backgroundColor: m < 0 ? theme.negative : theme.positive, width: `${Math.max(0, Math.min(100, m))}%` }]} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  title: { fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.3)' },
  label: { flex: 1, fontWeight: 600 },
  value: { fontWeight: 700 },
  delta: { minWidth: 82, alignItems: 'flex-end' },
  margin: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden', marginTop: -Spacing.one },
  fill: { height: 6, borderRadius: Radius.pill },
  marginRight: { alignItems: 'flex-end' },
});
