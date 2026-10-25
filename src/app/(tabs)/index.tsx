import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AttentionList } from '@/components/attention-list';
import { CarCard } from '@/components/car-card';
import { CarStatusFilter } from '@/components/car-status-filter';
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

/** Фільтр за станом авто: підпис → статус авто */
const FILTERS: Record<string, string | null> = { Усі: null, 'В оренді': 'В оренді', Вільні: 'Вільне', 'На сервісі': 'На сервісі', Заброньовані: 'Заброньоване' };

export default function HomeScreen() {
  const router = useRouter();
  const { cars, canAddCar } = useFleet();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('За прибутком');
  const [filter, setFilter] = useState('Усі');

  const month = monthKey(todayISO());
  // Підсумок місяця й прибуток по кожному авто рахує сервер
  const { data: report, loading, error, retry } = useReport<SummaryReport>(`/reports/summary?period=${month}`);
  const rows = cars.map((car) => ({ car, profit: report?.cars.find((c) => c.carId === car.id)?.period.profit }));
  if (sort === 'За прибутком') rows.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));

  const options = Object.entries(FILTERS)
    .map(([label, status]) => ({ label, count: status ? cars.filter((c) => c.status === status).length : cars.length }))
    .filter((o) => o.label === 'Усі' || o.count > 0);
  // Вибраний стан, у якому не лишилось авто, скидається на «Усі»
  const active = options.some((o) => o.label === filter) ? filter : 'Усі';
  const shown = rows.filter(({ car }) => !FILTERS[active] || car.status === FILTERS[active]);

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
      {cars.length > 1 ? <CarStatusFilter options={options} value={active} onChange={setFilter} /> : null}
      <View style={{ gap: Spacing.two }}>
        {shown.map(({ car, profit }) => (
          <CarCard key={car.id} car={car} profit={profit} />
        ))}
      </View>

    </Screen>
  );
}

