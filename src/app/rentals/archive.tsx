import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';

import { DealCard } from '@/components/deal-card';
import { ReportStatus } from '@/components/report-status';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import type { DealView, RenterSummary } from '@/lib/deals';

/** Усі мої оренди: діючі, завершені й розірвані */
export default function AllRentalsScreen() {
  const router = useRouter();
  const deals = useReport<DealView[]>('/deals', { refetchOnFocus: true });
  // Прибуток кожної оренди за весь час приходить із загального звіту
  const report = useReport<RenterSummary>('/reports/renter/summary', { refetchOnFocus: true });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Усі оренди', headerBackTitle: 'Назад' }} />

      {!deals.data ? (
        <ReportStatus loading={deals.loading} error={deals.error} onRetry={deals.retry} />
      ) : deals.data.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="Оренди ще немає"
          text="Тут з’явиться авто, коли власник прийме ваш запит або ви оберете його пропозицію. Тоді ви зможете вести облік: скільки платите за авто і скільки на ньому заробляєте."
          action="Знайти авто"
          onAction={() => router.navigate('/renter/search')}
        />
      ) : (
        <>
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
