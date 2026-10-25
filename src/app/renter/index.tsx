import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ActiveDealCard } from '@/components/active-deal-card';
import { Hint } from '@/components/hint';
import { ReportStatus } from '@/components/report-status';
import { ScreenTitle } from '@/components/screen-title';
import { TerminationBanner } from '@/components/termination-banner';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { usePendingOffers } from '@/hooks/use-pending-requests';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { dealStage, type DealView, type RenterSummary } from '@/lib/deals';
import { todayISO } from '@/lib/date';
import { useFleet } from '@/store/fleet';

/** Головна орендаря: авто, які він зараз орендує, з прибутком, платежами й швидкими діями */
export default function RenterHomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { invalidate } = useFleet();
  const offers = usePendingOffers();
  const deals = useReport<DealView[]>('/deals', { refetchOnFocus: true });
  // Прибуток за поточний місяць і показники за весь час по кожній оренді
  const report = useReport<RenterSummary>(`/reports/renter/summary?period=${todayISO().slice(0, 7)}`, { refetchOnFocus: true });

  const current = (deals.data ?? []).filter((d) => dealStage(d) !== 'finished' && dealStage(d) !== 'terminated');
  const hasPast = (deals.data?.length ?? 0) > current.length;

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={false} onRefresh={invalidate} />}>
      <ScreenTitle>Мої авто</ScreenTitle>

      <TerminationBanner onPress={() => router.navigate('/renter/requests')} />

      {offers > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate({ pathname: '/renter/requests', params: { tab: 'wanted' } })}
          style={({ pressed }) => pressed && { opacity: 0.85 }}>
          <View style={[styles.alert, { backgroundColor: theme.accent }]}>
            <View style={styles.alertCount}>
              <ThemedText style={[styles.alertCountText, { color: theme.accent }]}>{offers}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={styles.alertTitle}>
                {offers === 1 ? 'Власник запропонував авто' : 'Власники запропонували авто'}
              </ThemedText>
              <ThemedText type="small" style={styles.alertText}>
                Перегляньте пропозиції на вашу заявку й оберіть найкращу
              </ThemedText>
            </View>
            <Icon name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : null}

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
          <Hint id="renter-home">Тут усе, що стосується авто, які ви орендуєте: запишіть заробіток чи витрату одним дотиком, а нижче видно, скільки ви заробили й чи є борг перед власником.</Hint>
          <View style={{ gap: Spacing.three }}>
            {current.map((d) => {
              const row = report.data?.deals.find((x) => x.dealId === d.id);
              return <ActiveDealCard key={d.id} deal={d} month={row?.period} overview={row?.overview} />;
            })}
          </View>
          <Button title="Знайти ще авто" icon="search" variant="secondary" onPress={() => router.navigate('/renter/search')} />
        </>
      )}

      {hasPast ? <Button title="Усі оренди й архів" icon="albums-outline" variant="secondary" onPress={() => router.push('/rentals/archive')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  alert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  alertCount: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  alertCountText: { fontSize: 20, lineHeight: 24, fontWeight: 800 },
  alertTitle: { color: '#FFFFFF', fontWeight: 700 },
  alertText: { color: '#FFFFFF', opacity: 0.9 },
});
