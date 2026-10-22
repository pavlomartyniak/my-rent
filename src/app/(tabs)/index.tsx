import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CarCard } from '@/components/car-card';
import { Hint } from '@/components/hint';
import { dueLabel } from '@/components/reminder-row';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented } from '@/components/ui/segmented';
import { Spacing } from '@/constants/theme';
import { daysUntil, monthKey, monthTitle, todayISO } from '@/lib/date';
import { filterByPeriod, totals } from '@/lib/finance';
import { useFleet } from '@/store/fleet';

const SORTS = ['За прибутком', 'Як додано'] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { cars, transactions, reminders, canAddCar } = useFleet();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('За прибутком');

  const month = monthKey(todayISO());
  const monthTxs = filterByPeriod(transactions, month);
  const sum = totals(monthTxs);

  // Показуємо лише одне найближче нагадування, і тільки якщо воно терміново
  const next = reminders.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextDays = next ? daysUntil(next.date) : Infinity;
  const nextCar = next ? cars.find((c) => c.id === next.carId) : undefined;

  const rows = cars.map((car) => ({ car, profit: totals(monthTxs.filter((t) => t.carId === car.id)).profit }));
  if (sort === 'За прибутком') rows.sort((a, b) => b.profit - a.profit);

  const addCar = () => router.push(canAddCar ? '/car/new' : '/paywall');

  if (cars.length === 0) {
    return (
      <Screen tabs>
        <ThemedText type="subtitle">Мої авто</ThemedText>
        <EmptyState
          icon="car-sport-outline"
          title="Додайте перше авто"
          text="Записуйте доходи й витрати — застосунок сам покаже прибуток."
          action="Додати авто"
          onAction={addCar}
        />
      </Screen>
    );
  }

  return (
    <Screen tabs>
      <ThemedText type="subtitle">Мої авто</ThemedText>

      <Hint id="home">Тапніть на авто, щоб побачити його історію й додати дохід чи витрату. Кнопка вгорі додає запис для будь-якого авто.</Hint>

      <SummaryCard title={`Прибуток · ${monthTitle(month)}`} profit={sum.profit} income={sum.income} expense={sum.expense} />

      <Button title="Додати дохід або витрату" icon="add" onPress={() => router.push('/transaction/new')} />

      {next && nextDays <= 7 ? (
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/reminders')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <Icon name="alert-circle" size={24} color={nextDays < 0 ? 'negative' : 'warning'} />
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={{ fontWeight: 600 }}>
                {next.kind} · {nextCar ? `${nextCar.brand} ${nextCar.model}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor={nextDays < 0 ? 'negative' : 'textSecondary'}>
                {dueLabel(nextDays)}
              </ThemedText>
            </View>
            <Icon name="chevron-forward" size={18} color="textSecondary" />
          </Card>
        </Pressable>
      ) : null}

      <SectionHeader title="Авто" action="+ Додати" onAction={addCar} />
      {cars.length > 1 ? <Segmented options={SORTS} value={sort} onChange={setSort} /> : null}
      <View style={{ gap: Spacing.two }}>
        {rows.map(({ car, profit }) => (
          <CarCard key={car.id} car={car} profit={profit} />
        ))}
      </View>

    </Screen>
  );
}
