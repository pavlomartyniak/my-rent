import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

import { DeltaChip } from './delta-chip';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

/** За який період і чиї записи відкривають плашки «Дохід» і «Витрати»: без `carId`/`dealId` — усі записи користувача */
export type SummaryScope = { period: string; label: string; carId?: string; dealId?: string };

type Props = {
  title: string;
  profit: number;
  income: number;
  expense: number;
  note?: string;
  /** Зміна прибутку проти попереднього періоду, %; без значення пігулки немає */
  change?: number | null;
  /** Маржа, %: під сумою пояснюємо, яка частина доходу стала прибутком */
  margin?: number | null;
  /** Короткий рядок під сумою, якщо маржі немає, напр. «≈ 35 408 ₴ на добу» */
  caption?: string;
  /** Якщо задано, плашки «Дохід» і «Витрати» натискаються й відкривають записи, з яких складається сума */
  scope?: SummaryScope;
  /** Те, що стоїть під плашками всередині картки, напр. кнопка експорту */
  children?: React.ReactNode;
};

/** Один із двох підсумків: іконка в білому квадраті, назва й сума */
function Chip({ label, value, tone, icon, onPress }: { label: string; value: number; tone: 'positive' | 'negative'; icon: 'arrow-down' | 'arrow-up'; onPress?: () => void }) {
  const theme = useTheme();
  // Стрілка під кутом: дохід ↙ (надходить), витрата ↗ (йде)
  const tilt: ViewStyle = { transform: [{ rotate: '45deg' }] };
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label}: ${formatMoney(value)}. Показати записи` : undefined}
      style={({ pressed }) => [styles.chip, { backgroundColor: tone === 'positive' ? theme.positiveSoft : theme.negativeSoft }, pressed && styles.pressed]}>
      <View style={[styles.iconBox, { backgroundColor: theme.backgroundElement }]}>
        <View style={tilt}>
          <Icon name={icon} size={14} color={tone} />
        </View>
      </View>
      <View style={styles.chipText}>
        <ThemedText type="small" themeColor={tone} style={styles.chipLabel}>
          {label}
        </ThemedText>
        <ThemedText type="smallBold" themeColor={tone} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(value)}
        </ThemedText>
      </View>
      {onPress ? <Icon name="chevron-forward" size={16} color={tone} /> : null}
    </Pressable>
  );
}

/** Головне число екрана: прибуток (з дельтою й поясненням маржі), а під ним доходи й витрати двома плашками */
export function SummaryCard({ title, profit, income, expense, note, change, margin, caption, scope, children }: Props) {
  const router = useRouter();
  const open = (type: 'income' | 'expense') => () => router.push({ pathname: '/transactions', params: { type, period: scope!.period, label: scope!.label, ...(scope!.carId ? { carId: scope!.carId } : {}), ...(scope!.dealId ? { dealId: scope!.dealId } : {}) } });
  const marginNote = margin === null || margin === undefined ? null : margin >= 100 ? 'Маржа 100% — уся сума доходу стала прибутком' : `Маржа ${Math.round(margin)}% — стільки доходу стає прибутком`;

  const line = marginNote ?? caption;

  return (
    <Card style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      <View style={styles.valueRow}>
        <ThemedText style={styles.value} themeColor={profit >= 0 ? 'positive' : 'negative'} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(profit)}
        </ThemedText>
        {change !== undefined ? (
          <View style={styles.delta}>
            <DeltaChip change={change} />
          </View>
        ) : null}
      </View>
      {line ? (
        <ThemedText type="small" themeColor="textSecondary">
          {line}
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <Chip label="Дохід" value={income} tone="positive" icon="arrow-down" onPress={scope ? open('income') : undefined} />
        <Chip label="Витрати" value={expense} tone="negative" icon="arrow-up" onPress={scope ? open('expense') : undefined} />
      </View>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one, paddingVertical: Spacing.four, paddingHorizontal: Spacing.four },
  delta: { alignSelf: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  value: { fontSize: 44, lineHeight: 52, fontWeight: 700, letterSpacing: -1, flexShrink: 1 },
  row: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10 },
  iconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipText: { flex: 1, gap: 0 },
  chipLabel: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.7 },
});
