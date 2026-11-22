import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CategoryPanel } from '@/components/category-panel';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { StatInfoSheet, type StatInfo } from '@/components/stat-info-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { RENT_CATEGORY } from '@/types';
import { Spacing } from '@/constants/theme';
import type { DealReport } from '@/lib/deals';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, plural } from '@/lib/format';
import { todayISO } from '@/lib/date';

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.round(new Date(`${iso}T00:00:00Z`).getTime() / DAY);

/** Скільки діб оренди припадає на вибраний період (до сьогодні): на них ділимо прибуток, щоб отримати «прибуток на добу» */
function periodDays(key: string, start: string, end: string, whole: number) {
  if (key === 'all') return Math.max(1, whole);
  const ps = key.length === 4 ? `${key}-01-01` : `${key}-01`;
  const pe = key.length === 4 ? `${key}-12-31` : new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const from = ps > start ? ps : start;
  const to = [pe, end, todayISO()].reduce((a, b) => (a < b ? a : b));
  return Math.max(1, dayNum(to) - dayNum(from));
}

/**
 * Звіт однієї оренди: частина розділу «Доходи» (фільтр «Оренда»). Усе за вибраний період в одній картці; кожен показник
 * натискний і відкриває пояснення простими словами.
 */
export function DealReportView({ id, data, p, startDate, endDate }: { id: string; data: DealReport; p: { key: string; label: string }; startDate: string; endDate: string }) {
  const theme = useTheme();
  const [info, setInfo] = useState<StatInfo | null>(null);
  const o = data.overview;
  const t = data.totals;
  const all = p.key === 'all';
  const rent = all ? o.rentPaid : (data.categories.find((c) => c.category === RENT_CATEGORY)?.amount ?? 0);
  const other = Math.max(0, t.expense - rent);
  const days = periodDays(p.key, startDate, endDate, o.elapsedDays);
  const perDay = t.profit / days;
  const when = all ? 'за весь час оренди' : `за вибраний період (${p.label})`;
  const otherRows = data.categories.filter((c) => c.category !== RENT_CATEGORY).slice(0, 5);

  const rentInfo: StatInfo = {
    title: 'Сплачено власнику',
    value: formatMoney(rent),
    explain: [
      'Скільки ви заплатили власнику за користування авто.',
      `Враховуються лише записи з категорією «${RENT_CATEGORY}». Паливо, мийка й інші витрати сюди не входять: вони в «Інших витратах».`,
    ],
    rows: [
      { label: `Сплачено власнику ${when}`, value: formatMoney(rent) },
      { label: 'Усі ваші витрати за цей час', value: formatMoney(t.expense) },
    ],
    example: `Щоб сума була точною, додавайте запис «Витрата → ${RENT_CATEGORY}» щоразу, коли платите власнику.`,
  };
  const otherInfo: StatInfo = {
    title: 'Інші витрати',
    value: formatMoney(other),
    tone: other > 0 ? 'negative' : undefined,
    explain: [
      'Усі ваші витрати на авто, крім плати власнику: паливо, мийка, штрафи, ремонт.',
      'Це гроші, які ви витрачаєте самі. Чим вони менші, тим більший ваш прибуток.',
    ],
    rows: otherRows.map((c) => ({ label: c.category, value: formatMoney(c.amount), tone: 'negative' as const })),
    example: otherRows.length ? `Найбільша стаття: ${otherRows[0]!.category.toLowerCase()}. Скорочувати витрати найкраще з неї.` : 'За цей час інших витрат немає.',
  };
  const dayInfo: StatInfo = {
    title: 'Прибуток на добу',
    value: formatMoney(perDay),
    tone: perDay >= 0 ? 'positive' : 'negative',
    explain: [
      'Скільки ви в середньому заробляєте за один день після всіх витрат.',
      'Це прибуток за період, поділений на кількість діб оренди в ньому.',
    ],
    rows: [
      { label: 'Прибуток', value: formatMoney(t.profit), tone: t.profit >= 0 ? 'positive' : 'negative' },
      { label: 'Діб оренди', value: `${days} ${plural(days, 'доба', 'доби', 'діб')}` },
      { label: 'Прибуток на добу', value: formatMoney(perDay), tone: perDay >= 0 ? 'positive' : 'negative' },
    ],
    example: perDay >= 0 ? `У середньому ви заробляєте ${formatMoney(perDay)} на добу.` : 'Мінус означає, що витрати поки більші за заробіток. На початку оренди так буває.',
  };

  return (
    <>
      <SummaryCard title={`Прибуток · ${p.label}`} profit={t.profit} income={t.income} expense={t.expense} scope={{ period: p.key, label: p.label, dealId: id }} />

      <Card style={styles.list}>
        <StatRow icon="key-outline" label="Сплачено власнику" value={formatMoney(rent)} onPress={() => setInfo(rentInfo)} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <StatRow icon="receipt-outline" label="Інші витрати" value={formatMoney(other)} color={other > 0 ? 'negative' : undefined} onPress={() => setInfo(otherInfo)} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <StatRow icon="trending-up-outline" label="Прибуток на добу" value={formatMoney(perDay)} color={perDay >= 0 ? 'positive' : 'negative'} onPress={() => setInfo(dayInfo)} />
      </Card>

      <Card>
        <BarChart key={p.key} data={data.series} scope={{ dealId: id }} titled />
      </Card>

      <Card>
        <CategoryPanel dealId={id} title="На що йдуть витрати" />
      </Card>

      <StatInfoSheet info={info} onClose={() => setInfo(null)} />
    </>
  );
}

/** Рядок показника: значок, назва, число й шеврон. Натискається: відкриває пояснення простими словами */
function StatRow({ icon, label, value, color, onPress }: { icon: IconName; label: string; value: string; color?: 'positive' | 'negative'; onPress: () => void }) {
  const theme = useTheme();
  const tint = color === 'negative' ? theme.negativeSoft : color === 'positive' ? theme.positiveSoft : theme.accentSoft;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Що це?`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.iconBox, { backgroundColor: tint }]}>
        <Icon name={icon} size={20} color={color ?? 'accent'} />
      </View>
      <ThemedText type="body" style={styles.rowLabel} numberOfLines={2}>
        {label}
      </ThemedText>
      <ThemedText type="headline" themeColor={color} style={styles.rowValue} numberOfLines={1}>
        {value}
      </ThemedText>
      <Icon name="chevron-forward" size={18} color="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three + 40 + Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 64, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1 },
  rowValue: { fontWeight: 700, textAlign: 'right' },
});
