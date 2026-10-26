import { useRouter } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { ActiveDealCard } from '@/components/active-deal-card';
import { AttentionList } from '@/components/attention-list';
import { ReportStatus } from '@/components/report-status';
import { ScreenTitle } from '@/components/screen-title';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { dealStage, type DealView, type RenterSummary } from '@/lib/deals';
import { todayISO } from '@/lib/date';
import { useFleet } from '@/store/fleet';

/** Головна орендаря: авто, які він зараз орендує, з прибутком, платежами й швидкими діями */
export default function RenterHomeScreen() {
  const router = useRouter();
  const { invalidate } = useFleet();
  const deals = useReport<DealView[]>('/deals', { refetchOnFocus: true });
  // Прибуток за поточний місяць і показники за весь час по кожній оренді
  const report = useReport<RenterSummary>(`/reports/renter/summary?period=${todayISO().slice(0, 7)}`, { refetchOnFocus: true });

  const current = (deals.data ?? []).filter((d) => dealStage(d) !== 'finished' && dealStage(d) !== 'terminated');
  const hasPast = (deals.data?.length ?? 0) > current.length;

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={false} onRefresh={invalidate} />}>
      <ScreenTitle>Мої авто</ScreenTitle>

      <AttentionList role="renter" />

      {!deals.data ? (
        <ReportStatus loading={deals.loading} error={deals.error} onRetry={deals.retry} />
      ) : current.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="Оренди ще немає"
          text="Знайдіть вільне авто й надішліть запит. Коли власник його прийме, авто з’явиться тут, і ви зможете вести облік: скільки платите й скільки заробляєте."
          action="Знайти авто"
          onAction={() => router.navigate('/renter/search')}
        />
      ) : (
        <>
          <View style={{ gap: Spacing.three }}>
            {current.map((d) => {
              const row = report.data?.deals.find((x) => x.dealId === d.id);
              return <ActiveDealCard key={d.id} deal={d} month={row?.period} overview={row?.overview} />;
            })}
          </View>
          <Button title="Знайти ще авто" icon="search" variant="soft" onPress={() => router.navigate('/renter/search')} />
        </>
      )}

      {hasPast ? <Button title="Усі оренди й архів" icon="albums-outline" variant="soft" onPress={() => router.push('/rentals/archive')} /> : null}
    </Screen>
  );
}

