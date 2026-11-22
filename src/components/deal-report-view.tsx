import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CategoryPanel } from '@/components/category-panel';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { StatInfoSheet, type StatInfo } from '@/components/stat-info-sheet';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { RENT_CATEGORY } from '@/types';
import { Radius, Spacing, Type } from '@/constants/theme';
import type { DealReport } from '@/lib/deals';
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
 * натискний і відкриває пояснення простими словами. «Баланс платежів» не залежить від періоду, тому стоїть окремою смугою зверху.
 */
export function DealReportView({ id, data, p, startDate, endDate }: { id: string; data: DealReport; p: { key: string; label: string }; startDate: string; endDate: string }) {
  const theme = useTheme();
  const [info, setInfo] = useState<StatInfo | null>(null);
  const o = data.overview;
  const balance = o.rentBalance ?? 0;
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
      'Це гроші, які ви віддали власнику за те, що їздите на його авто. Ніби плата за прокат велосипеда: ви беретесь покататися й платите хазяїну.',
      `Тут лише ті записи, де ви обрали «${RENT_CATEGORY}». Бензин чи мийка сюди не потрапляють: вони окремо, у «Інших витратах».`,
    ],
    rows: [
      { label: `Сплачено власнику ${when}`, value: formatMoney(rent) },
      { label: 'Усі ваші витрати за цей час', value: formatMoney(t.expense) },
    ],
    example: 'Хочете, щоб тут було точно? Щоразу, коли платите власнику, додавайте запис «Витрата → Оренда авто».',
  };
  const otherInfo: StatInfo = {
    title: 'Інші витрати',
    value: formatMoney(other),
    tone: other > 0 ? 'negative' : undefined,
    explain: [
      'Це все, на що ви витрачаєте гроші, поки їздите, окрім плати власнику: бензин, мийка, штрафи, ремонт.',
      'Ці гроші ви витрачаєте самі, власник їх не отримує. Чим вони менші, тим більше лишається вам.',
    ],
    rows: otherRows.map((c) => ({ label: c.category, value: formatMoney(c.amount), tone: 'negative' as const })),
    example: otherRows.length ? 'Найбільша стаття: ' + otherRows[0]!.category.toLowerCase() + '. Якщо хочете більше заробляти, придивіться до неї першою.' : 'Інших витрат за цей час немає.',
  };
  const dayInfo: StatInfo = {
    title: 'Прибуток на добу',
    value: formatMoney(perDay),
    tone: perDay >= 0 ? 'positive' : 'negative',
    explain: [
      'Це скільки грошей ви в середньому лишаєте собі за один день, коли вже заплатили за все: за авто, бензин і решту.',
      'Рахуємо просто: беремо ваш прибуток і ділимо на кількість днів.',
    ],
    rows: [
      { label: 'Ваш прибуток', value: formatMoney(t.profit), tone: t.profit >= 0 ? 'positive' : 'negative' },
      { label: 'Днів оренди', value: `${days} ${plural(days, 'доба', 'доби', 'діб')}` },
      { label: 'Прибуток на добу', value: formatMoney(perDay), tone: perDay >= 0 ? 'positive' : 'negative' },
    ],
    example: perDay >= 0 ? `Тобто кожен день у вас в кишені залишається приблизно ${formatMoney(perDay)}.` : 'Мінус означає, що поки ви витрачаєте більше, ніж заробляєте. Таке буває на початку оренди.',
  };
  const balanceInfo: StatInfo = {
    title: 'Баланс платежів',
    value: balance === 0 ? 'Все сплачено' : formatMoney(Math.abs(balance)),
    tone: balance > 0 ? 'negative' : 'positive',
    explain: [
      'Власник чекає від вас плату за кожен день оренди. Тут ми порівнюємо дві речі: скільки ви вже мали заплатити до сьогодні і скільки справді заплатили.',
      balance > 0
        ? 'Ви заплатили менше, ніж мали. Це борг: власник чекає ще трохи грошей.'
        : balance < 0
          ? 'Ви заплатили більше, ніж треба на цей момент. Це переплата: гроші вже лежать у власника наперед, за майбутні дні.'
          : 'Ви заплатили рівно стільки, скільки треба на сьогодні. Усе гаразд.',
    ],
    rows: [
      { label: 'Мало бути сплачено до сьогодні', value: formatMoney(o.rentDue) },
      { label: 'Ви вже сплатили', value: formatMoney(o.rentPaid) },
      { label: balance > 0 ? 'Борг' : balance < 0 ? 'Переплата' : 'Різниця', value: formatMoney(Math.abs(balance)), tone: balance > 0 ? 'negative' : 'positive' },
    ],
    example: 'Цей показник завжди рахується за всю оренду, а не за вибраний місяць чи рік.',
  };

  return (
    <>
      {balance !== 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Баланс платежів: ${balance > 0 ? 'борг' : 'переплата'} ${formatMoney(Math.abs(balance))}. Що це?`} onPress={() => setInfo(balanceInfo)}>
          <View style={[styles.balance, { backgroundColor: balance > 0 ? theme.negativeSoft : theme.positiveSoft }]}>
            <View style={styles.flex}>
              <ThemedText type="smallBold" themeColor={balance > 0 ? 'negative' : 'positive'}>
                {balance > 0 ? 'Борг власнику' : 'Переплата власнику'} · {formatMoney(Math.abs(balance))}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {balance > 0 ? 'Ви заплатили менше, ніж мали. Торкніться, щоб дізнатись більше' : 'Ви заплатили наперед. Торкніться, щоб дізнатись більше'}
              </ThemedText>
            </View>
            <Icon name="help-circle-outline" size={22} color={balance > 0 ? 'negative' : 'positive'} />
          </View>
        </Pressable>
      ) : null}

      <SummaryCard title={`Прибуток · ${p.label}`} profit={t.profit} income={t.income} expense={t.expense} scope={{ period: p.key, label: p.label, dealId: id }} />

      <View style={styles.grid}>
        <Stat label="Сплачено власнику" value={formatMoney(rent)} onPress={() => setInfo(rentInfo)} />
        <Stat label="Інші витрати" value={formatMoney(other)} color={other > 0 ? 'negative' : undefined} onPress={() => setInfo(otherInfo)} />
        <Stat label="Прибуток на добу" value={formatMoney(perDay)} color={perDay >= 0 ? 'positive' : 'negative'} onPress={() => setInfo(dayInfo)} />
      </View>

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

function Stat({ label, value, note, color, onPress }: { label: string; value: string; note?: string; color?: 'positive' | 'negative'; onPress: () => void }) {
  return (
    <Card style={styles.stat} onPress={onPress} label={`${label}: ${value}. Що це?`}>
      <View style={styles.statHead}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {label}
        </ThemedText>
        <Icon name="help-circle-outline" size={16} color="textSecondary" />
      </View>
      <ThemedText type="default" style={styles.statValue} themeColor={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      {note ? (
        <ThemedText type="smallBold" themeColor={color}>
          {note}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: Spacing.one, padding: Spacing.three },
  statHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  flex: { flex: 1 },
  statValue: { ...Type.headline },
  balance: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
});
