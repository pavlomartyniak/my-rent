import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CarCard } from '@/components/car-card';
import { Hint } from '@/components/hint';
import { dueLabel } from '@/components/reminder-row';
import { ReportStatus } from '@/components/report-status';
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
import { useReport } from '@/hooks/use-report';
import { daysUntil, monthKey, monthTitle, todayISO } from '@/lib/date';
import type { RentalView } from '@/lib/rentals';
import type { SummaryReport } from '@/lib/reports';
import { useFleet } from '@/store/fleet';

const SORTS = ['За прибутком', 'Як додано'] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { cars, reminders, canAddCar } = useFleet();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('За прибутком');

  const month = monthKey(todayISO());
  // Підсумок місяця й прибуток по кожному авто рахує сервер
  const { data: report, loading, error, retry } = useReport<SummaryReport>(`/reports/summary?period=${month}`);
  // Нові запити орендарів на мої авто
  const { data: incoming } = useReport<RentalView[]>('/rentals/incoming?status=pending', { refetchOnFocus: true });
  const newRequests = incoming?.length ?? 0;

  // Показуємо лише одне найближче нагадування, і тільки якщо воно терміново
  const next = reminders.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextDays = next ? daysUntil(next.date) : Infinity;
  const nextCar = next ? cars.find((c) => c.id === next.carId) : undefined;

  const rows = cars.map((car) => ({ car, profit: report?.cars.find((c) => c.carId === car.id)?.period.profit }));
  if (sort === 'За прибутком') rows.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));

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

      {report ? (
        <SummaryCard title={`Прибуток · ${monthTitle(month)}`} profit={report.totals.profit} income={report.totals.income} expense={report.totals.expense} />
      ) : (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      )}

      <Button title="Додати дохід або витрату" icon="add" onPress={() => router.push('/transaction/new')} />

      {newRequests > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/requests')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <Icon name="mail-unread" size={24} color="accent" />
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={{ fontWeight: 600 }}>
                Нові запити на оренду: {newRequests}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Орендарі чекають вашої відповіді
              </ThemedText>
            </View>
            <Icon name="chevron-forward" size={18} color="textSecondary" />
          </Card>
        </Pressable>
      ) : null}

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
