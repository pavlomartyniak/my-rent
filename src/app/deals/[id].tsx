import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { CarPhoto } from '@/components/car-photo';
import { PaymentsCard } from '@/components/payments-card';
import { HeroButton } from '@/components/hero-button';
import { RenterDealCard } from '@/components/renter-deal-card';
import { HistoryList } from '@/components/history-list';
import { ReportStatus } from '@/components/report-status';
import { StatusBadge } from '@/components/status-badge';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { InfoGrid } from '@/components/ui/info-rows';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useFleet } from '@/store/fleet';
import { dealStage, type DealReport, type DealView } from '@/lib/deals';
import { formatMoney, splitTitle } from '@/lib/format';

/** Одна оренда: умови, баланс платежів власнику, прибуток і історія записів */
export default function DealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { invalidate } = useFleet();
  const deal = useReport<DealView>(`/deals/${id}`);
  const report = useReport<DealReport>(`/reports/renter/deals/${id}`);

  if (!deal.data) {
    return (
      <Screen>
        {deal.error === 'Оренду не знайдено' ? <EmptyState icon="alert-circle-outline" title="Оренду не знайдено" /> : <ReportStatus loading={deal.loading} error={deal.error} onRetry={deal.retry} />}
      </Screen>
    );
  }

  const d = deal.data;
  const o = report.data?.overview;
  const stage = dealStage(d);
  const confirmDelete = () =>
    Alert.alert('Видалити оренду?', 'Оренду, усі її записи про заробіток і витрати та аналітику по ній буде видалено. Цю дію не можна скасувати.', [
      { text: 'Залишити', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', `/deals/${d.id}`);
            invalidate();
            router.back();
          } catch (e) {
            Alert.alert('Не вдалося видалити', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
          }
        },
      },
    ]);

  const add = (type: 'income' | 'expense') => router.push({ pathname: '/transaction/new', params: { dealId: d.id, type } });

  const { name, year } = splitTitle(d.title);
  const subtitle = [year, d.city].filter(Boolean);
  const balance = o?.rentBalance ?? 0;
  const debt = balance > 0;

  return (
    // Фото йде під прозорий хедер на всю ширину, тож системні відступи й бічні поля Screen скасовуємо
    <Screen contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 0 }}>
      <Stack.Screen options={{ title: '', headerTransparent: true, headerBackVisible: false, headerLeft: () => <HeroButton icon="chevron-back" label="Назад" onPress={() => router.back()} /> }} />

      <View style={styles.hero}>
        <CarPhoto uri={d.photoUri} style={styles.photo} iconSize={44} />
      </View>

      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle" style={[styles.carTitle, styles.flex]} numberOfLines={2}>
            {name}
          </ThemedText>
          <StatusBadge status={stage} dot />
        </View>
        <View style={styles.sub}>
          {year ? (
            <ThemedText type="default" themeColor="textSecondary">
              {year}
            </ThemedText>
          ) : null}
          {subtitle.length > 1 ? (
            <ThemedText type="default" themeColor="textSecondary">
              ·
            </ThemedText>
          ) : null}
          {d.city ? <Icon name="location-outline" size={16} color="textSecondary" /> : null}
          {d.city ? (
            <ThemedText type="default" themeColor="textSecondary">
              {d.city}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {stage === 'signing' ? null : (
        <View style={styles.actions}>
          <Button title="Заробіток" icon="add" variant="positiveSolid" style={styles.flex} onPress={() => add('income')} />
          <Button title="Витрата" icon="remove" variant="dangerSolid" style={styles.flex} onPress={() => add('expense')} />
        </View>
      )}

      {o ? (
          <SummaryCard title="Прибуток за весь час" profit={o.profit} income={o.income} expense={o.expense} caption={o.elapsedDays > 0 ? `≈ ${formatMoney(o.avgProfitPerDay)} на добу` : undefined}>
            <Button
              title="Детальна аналітика"
              icon="stats-chart"
              variant="soft"
              style={styles.analytics}
              onPress={() => router.push({ pathname: '/deals/analytics', params: { id: d.id } })}
            />
          </SummaryCard>
      ) : (
        <ReportStatus loading={report.loading} error={report.error} onRetry={report.retry} />
      )}

      <RenterDealCard deal={d} overview={o} />

      {o ? (
          <Card style={styles.rentCard}>
            <ThemedText type="default" style={styles.cardTitle}>
              Платежі за оренду
            </ThemedText>
            <View style={[styles.due, { backgroundColor: debt ? theme.warningSoft : theme.accentSoft }]}>
              <View>
                <ThemedText type="smallBold" themeColor={debt ? 'warning' : 'accent'}>
                  {debt ? 'До сплати зараз' : 'Нараховано за оренду'}
                </ThemedText>
                <ThemedText style={styles.dueValue} themeColor={debt ? 'warning' : 'accent'}>
                  {formatMoney(debt ? balance : o.rentDue)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                за {o.elapsedDays} з {o.totalDays} діб
              </ThemedText>
            </View>
            <InfoGrid
              items={[
                { label: 'Сплачено власнику', value: formatMoney(o.rentPaid) },
                { label: debt ? 'Борг перед власником' : balance < 0 ? 'Оплачено наперед' : 'Розрахунок', value: balance === 0 ? 'Все сплачено' : formatMoney(Math.abs(balance)) },
                { label: 'Інші витрати', value: formatMoney(o.otherExpenses), note: 'паливо, мийка…' },
                { label: 'За весь період за договором', value: formatMoney(o.plannedRent) },
              ]}
            />
          </Card>
      ) : null}

      <PaymentsCard deal={d} as="renter" />

      <SectionHeader title="Історія" />
      <HistoryList dealId={d.id} />

      {stage === 'terminated' || stage === 'finished' ? <Button title="Видалити оренду" icon="trash-outline" variant="danger" onPress={confirmDelete} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Фото на всю ширину екрана: скасовуємо бічні поля Screen
  hero: { marginHorizontal: -20 },
  photo: { width: '100%', aspectRatio: 1.2, borderRadius: 0 },
  // Лист із назвою заходить на фото закругленим верхом (мінус проміжок між блоками й сам захід)
  sheet: { marginHorizontal: -20, marginTop: -48, paddingHorizontal: 20, paddingTop: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carTitle: { fontSize: 28, lineHeight: 34 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  analytics: { marginTop: Spacing.two },
  rentCard: { gap: Spacing.three },
  cardTitle: { fontWeight: 700, fontSize: 18 },
  due: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, borderRadius: Radius.md, padding: Spacing.three },
  dueValue: { fontSize: 28, lineHeight: 34, fontWeight: 700 },
});
