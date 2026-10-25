import { useRouter } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { DealCard } from '@/components/deal-card';
import { Hint } from '@/components/hint';
import { ReportStatus } from '@/components/report-status';
import { ScreenTitle } from '@/components/screen-title';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import type { DealView, RenterSummary } from '@/lib/deals';
import { useFleet } from '@/store/fleet';

/** Авто, які я взяв в оренду: сюди додається оренда, коли власник прийняв запит або я прийняв пропозицію */
export default function MyRentalsScreen() {
  const router = useRouter();
  const { invalidate } = useFleet();
  const deals = useReport<DealView[]>('/deals', { refetchOnFocus: true });
  // Прибуток кожної оренди за весь час приходить із загального звіту
  const report = useReport<RenterSummary>('/reports/renter/summary', { refetchOnFocus: true });

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={false} onRefresh={invalidate} />}>
      <ScreenTitle>Моя оренда</ScreenTitle>

      {!deals.data ? (
        <ReportStatus loading={deals.loading} error={deals.error} onRetry={deals.retry} />
      ) : deals.data.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="Оренди ще немає"
          text="Тут з’явиться авто, коли власник прийме ваш запит або ви оберете його пропозицію. Тоді ви зможете вести облік: скільки платите за авто і скільки на ньому заробляєте."
          action="Знайти авто"
          onAction={() => router.navigate('/renter')}
        />
      ) : (
        <>
          <Hint id="my-rentals">Відкрийте оренду, щоб записувати заробіток і витрати: прибуток і баланс платежів власнику порахуються самі.</Hint>
          <View style={{ gap: Spacing.three }}>
            {deals.data.map((d) => (
              <DealCard key={d.id} deal={d} overview={report.data?.deals.find((x) => x.dealId === d.id)?.overview} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
