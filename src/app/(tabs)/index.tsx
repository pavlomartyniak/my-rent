import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { AttentionList } from '@/components/attention-list';
import { CarCard } from '@/components/car-card';
import { CarStatusFilter } from '@/components/car-status-filter';
import { EarningsWidget } from '@/components/earnings-widget';
import { ScreenTitle } from '@/components/screen-title';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SummarySkeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { monthKey, todayISO } from '@/lib/date';
import type { DealView } from '@/lib/deals';
import { plural } from '@/lib/format';
import type { SummaryReport } from '@/lib/reports';
import { useFleet } from '@/store/fleet';

const SORTS = ['За прибутком', 'Як додано'] as const;
type Sort = (typeof SORTS)[number];

/** Фільтр за станом авто: підпис → статус авто */
const FILTERS: Record<string, string | null> = { Усі: null, 'В оренді': 'В оренді', Вільні: 'Вільне', 'На сервісі': 'На сервісі', Заброньовані: 'Заброньоване' };

/**
 * «Авто»: що потребує уваги → одна цифра місяця (веде в «Доходи») → мій автопарк.
 * Оренди живуть у вкладці «Оренди», гроші — у «Доходах»; тут лише вхід у них.
 */
export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { cars, reminders, invalidate } = useFleet();
  const [sort, setSort] = useState<Sort>('За прибутком');
  const [filter, setFilter] = useState('Усі');
  const { data: rentals } = useReport<DealView[]>('/deals/current', { refetchOnFocus: true });

  const month = monthKey(todayISO());
  // Підсумок місяця й прибуток по кожному авто рахує сервер
  const { data: report, loading } = useReport<SummaryReport>(`/reports/summary?period=${month}`);
  const rows = cars.map((car) => ({ car, profit: report?.cars.find((c) => c.carId === car.id)?.period.profit }));
  if (sort === 'За прибутком') rows.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));

  const options = Object.entries(FILTERS)
    .map(([label, status]) => ({ label, count: status ? cars.filter((c) => c.status === status).length : cars.length }))
    .filter((o) => o.label === 'Усі' || o.count > 0);
  // Вибраний стан, у якому не лишилось авто, скидається на «Усі»
  const active = options.some((o) => o.label === filter) ? filter : 'Усі';
  const shown = rows.filter(({ car }) => !FILTERS[active] || car.status === FILTERS[active]);
  const pending = reminders.filter((r) => !r.done).length;

  const addCar = () => router.push('/car/new');

  if (cars.length === 0) {
    return (
      <Screen tabs refreshControl={<RefreshControl refreshing={false} onRefresh={invalidate} />}>
        <ScreenTitle>Мої авто</ScreenTitle>
        <EmptyState
          icon="car-sport-outline"
          title="Додайте перше авто"
          text="Опублікуйте авто, щоб приймати запити на оренду, а застосунок сам рахуватиме прибуток."
          action="Додати авто"
          onAction={addCar}
        />
      </Screen>
    );
  }

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={false} onRefresh={invalidate} />}>
      <ScreenTitle>Мої авто</ScreenTitle>

      <AttentionList role="owner" />

      {report ? (
        <EarningsWidget title="Цього місяця" profit={report.totals.profit} change={report.previousPeriod ? report.change.profit : undefined} href="/analytics" />
      ) : loading ? (
        <SummarySkeleton />
      ) : null}

      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Button title="Дохід" icon="add" variant="positive" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'income' } })} />
        <Button title="Витрата" icon="remove" variant="danger" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'expense' } })} />
      </View>

      <Card style={{ paddingVertical: Spacing.one }}>
        <ListRow
          title="Нагадування"
          subtitle={pending > 0 ? `${pending} ${plural(pending, 'активне', 'активні', 'активних')}: ТО, страховка` : 'ТО, страховка, інші терміни'}
          leading={<Icon name="notifications-outline" size={22} color={theme.text} />}
          onPress={() => router.push('/reminders')}
        />
      </Card>

      <View>
        <SectionHeader title="Автопарк" action="Додати авто" onAction={addCar} />
      </View>

      {cars.length > 1 ? <CarStatusFilter options={options} value={active} onChange={setFilter} sorts={SORTS} sort={sort} onSort={(v) => setSort(v as Sort)} /> : null}

      <View style={{ gap: Spacing.three }}>
        {shown.map(({ car }) => (
          <CarCard key={car.id} car={car} pricePerDay={rentals?.find((d) => d.carId === car.id)?.pricePerDay} />
        ))}
      </View>
    </Screen>
  );
}
