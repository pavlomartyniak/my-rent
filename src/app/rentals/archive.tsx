import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';

import { DealCard } from '@/components/deal-card';
import { ReportStatus } from '@/components/report-status';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { dealStage, type DealView, type RenterSummary } from '@/lib/deals';

/** Архів оренд: лише завершені й розірвані; чинні оренди — на «Головній» */
export default function AllRentalsScreen() {
  const router = useRouter();
  const deals = useReport<DealView[]>('/deals', { refetchOnFocus: true });
  // Прибуток кожної оренди за весь час приходить із загального звіту
  const report = useReport<RenterSummary>('/reports/renter/summary', { refetchOnFocus: true });

  const past = (deals.data ?? []).filter((d) => dealStage(d) === 'finished' || dealStage(d) === 'terminated');

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Архів оренд', headerBackTitle: 'Назад' }} />

      {!deals.data ? (
        <ReportStatus loading={deals.loading} error={deals.error} onRetry={deals.retry} />
      ) : past.length === 0 ? (
        <EmptyState
          icon="archive-outline"
          title="Архів порожній"
          text="Тут з’являться завершені й розірвані оренди з їхнім обліком. Чинні оренди — на «Головній»."
          action="На головну"
          onAction={() => router.navigate('/renter')}
        />
      ) : (
        <>
          <View style={{ gap: Spacing.three }}>
            {past.map((d) => (
              <DealCard key={d.id} deal={d} overview={report.data?.deals.find((x) => x.dealId === d.id)?.overview} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
