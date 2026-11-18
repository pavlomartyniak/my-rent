import { useRouter } from 'expo-router';
import { Alert, RefreshControl, View } from 'react-native';

import { ActiveDealCard } from '@/components/active-deal-card';
import { AttentionList } from '@/components/attention-list';
import { ReportStatus } from '@/components/report-status';
import { ScreenTitle } from '@/components/screen-title';
import { SummaryCard } from '@/components/summary-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { dealStage, type DealView, type RenterSummary } from '@/lib/deals';
import { splitTitle } from '@/lib/format';
import { monthTitle, todayISO } from '@/lib/date';
import { useFleet } from '@/store/fleet';

/** Головна орендаря: авто, які він зараз орендує, з прибутком, платежами й швидкими діями */
export default function RenterHomeScreen() {
  const router = useRouter();
  const { invalidate } = useFleet();
  const month = todayISO().slice(0, 7);
  const deals = useReport<DealView[]>('/deals', { refetchOnFocus: true });
  // Прибуток за поточний місяць і показники за весь час по кожній оренді
  const report = useReport<RenterSummary>(`/reports/renter/summary?period=${month}`, { refetchOnFocus: true });

  const current = (deals.data ?? []).filter((d) => dealStage(d) !== 'finished' && dealStage(d) !== 'terminated');
  // Запис орендаря прив'язаний до оренди: одну оренду відкриваємо одразу, з кількох просимо обрати
  const addRecord = () => {
    const open = (dealId: string) => router.push({ pathname: '/transaction/new', params: { dealId } });
    if (current.length === 1) return open(current[0].id);
    Alert.alert('До якої оренди запис?', undefined, [...current.map((d) => ({ text: splitTitle(d.title).name, onPress: () => open(d.id) })), { text: 'Скасувати', style: 'cancel' as const }]);
  };
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
          {report.data ? (
            <SummaryCard
              title={`Прибуток · ${monthTitle(month)}`}
              profit={report.data.totals.profit}
              income={report.data.totals.income}
              expense={report.data.totals.expense}
              scope={{ period: month, label: monthTitle(month) }}
            />
          ) : (
            <ReportStatus loading={report.loading} error={report.error} onRetry={report.retry} />
          )}
          <Button title="Додати дохід або витрату" icon="add" onPress={addRecord} />
          <View style={{ gap: Spacing.three }}>
            {current.map((d) => (
              <ActiveDealCard key={d.id} deal={d} />
            ))}
          </View>
          <Button title="Знайти ще авто" icon="search" variant="soft" onPress={() => router.navigate('/renter/search')} />
        </>
      )}

      {hasPast ? <Button title="Архів оренд" icon="albums-outline" variant="soft" onPress={() => router.push('/rentals/archive')} /> : null}
    </Screen>
  );
}

