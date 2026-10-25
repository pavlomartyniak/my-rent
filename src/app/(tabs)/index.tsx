import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AttentionList } from '@/components/attention-list';
import { CarCard } from '@/components/car-card';
import { CurrentRentals } from '@/components/current-rentals';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ScreenTitle } from '@/components/screen-title';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented } from '@/components/ui/segmented';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { monthKey, monthTitle, todayISO } from '@/lib/date';
import type { SummaryReport } from '@/lib/reports';
import { useFleet } from '@/store/fleet';

const SORTS = ['За прибутком', 'Як додано'] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { cars, canAddCar } = useFleet();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('За прибутком');

  const month = monthKey(todayISO());
  // Підсумок місяця й прибуток по кожному авто рахує сервер
  const { data: report, loading, error, retry } = useReport<SummaryReport>(`/reports/summary?period=${month}`);
  const rows = cars.map((car) => ({ car, profit: report?.cars.find((c) => c.carId === car.id)?.period.profit }));
  if (sort === 'За прибутком') rows.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));

  const addCar = () => router.push(canAddCar ? '/car/new' : '/paywall');

  if (cars.length === 0) {
    return (
      <Screen tabs>
        <ScreenTitle>Мої авто</ScreenTitle>
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
      <ScreenTitle>Мої авто</ScreenTitle>

      <AttentionList role="owner" />

      {report ? (
        <SummaryCard title={`Прибуток · ${monthTitle(month)}`} profit={report.totals.profit} income={report.totals.income} expense={report.totals.expense} />
      ) : (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      )}

      <Button title="Додати дохід або витрату" icon="add" onPress={() => router.push('/transaction/new')} />

      <CurrentRentals />

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

