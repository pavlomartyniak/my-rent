import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CarPhoto } from '@/components/car-photo';
import { Hint } from '@/components/hint';
import { PeriodSwitcher, usePeriod } from '@/components/period-switcher';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { filterByPeriod, monthlySeries, totals } from '@/lib/finance';
import { formatMoney } from '@/lib/format';
import { useFleet } from '@/store/fleet';

export default function ReportScreen() {
  const router = useRouter();
  const { cars, transactions } = useFleet();
  const p = usePeriod();

  const scoped = filterByPeriod(transactions, p.key);
  const sum = totals(scoped);
  const series = monthlySeries(transactions, p.months);
  const perCar = cars
    .map((car) => ({ car, profit: totals(scoped.filter((t) => t.carId === car.id)).profit }))
    .sort((a, b) => b.profit - a.profit);

  return (
    <Screen tabs>
      <ThemedText type="subtitle">Звіт</ThemedText>

      <Hint id="report">Тут підсумок по всіх авто. Тапніть на авто в списку нижче, щоб побачити його окрему аналітику: окупність, витрати за категоріями, найкращі місяці.</Hint>

      <PeriodSwitcher state={p} />

      <SummaryCard title={`Прибуток · ${p.label}`} profit={sum.profit} income={sum.income} expense={sum.expense} />

      <Card>
        <BarChart data={series} />
      </Card>

      <SectionHeader title="Аналітика по авто" />
      <Card style={styles.list}>
        {perCar.map(({ car, profit }, i) => (
          <Pressable
            key={car.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/car/analytics', params: { id: car.id } })}>
            <View style={[styles.row, i > 0 && styles.rowBorder]}>
              <CarPhoto uri={car.photoUri} style={styles.thumb} iconSize={22} />
              <View style={styles.flex}>
                <ThemedText type="default" style={styles.bold}>
                  {car.brand} {car.model}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {car.year}
                </ThemedText>
              </View>
              <ThemedText type="default" style={styles.bold} themeColor={profit >= 0 ? 'positive' : 'negative'}>
                {formatMoney(profit)}
              </ThemedText>
              <Icon name="chevron-forward" size={18} color="textSecondary" />
            </View>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.3)' },
  thumb: { width: 44, height: 44, borderRadius: Radius.sm },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
});
