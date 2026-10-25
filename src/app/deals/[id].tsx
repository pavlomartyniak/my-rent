import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { CarPhoto } from '@/components/car-photo';
import { ContractCard } from '@/components/contract-card';
import { ContactChips } from '@/components/contact-chips';
import { contactActions } from '@/lib/contact-actions';
import { TerminateDeal } from '@/components/terminate-deal';
import { HistoryList } from '@/components/history-list';
import { ReportStatus } from '@/components/report-status';
import { StatusBadge } from '@/components/status-badge';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import { useFleet } from '@/store/fleet';
import { formatDate } from '@/lib/date';
import { dealStage, type DealReport, type DealView } from '@/lib/deals';
import { formatMoney } from '@/lib/format';

/** Одна оренда: умови, баланс платежів власнику, прибуток і історія записів */
export default function DealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  return (
    <Screen>
      <Stack.Screen options={{ title: d.title }} />

      <CarPhoto uri={d.photoUri} style={styles.photo} iconSize={36} />

      <Card>
        <View style={styles.head}>
          <View style={styles.flex}>
            <ThemedText type="default" style={styles.bold}>
              {d.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {d.city}
            </ThemedText>
          </View>
          <StatusBadge status={dealStage(d)} />
        </View>
        <Row label="Оренда" value={`${formatDate(d.startDate)} – ${formatDate(d.endDate)}`} />
        <Row label="Ціна за добу" value={formatMoney(d.pricePerDay)} />
        <Row label="Власник" value={d.counterpart.name} />
        <ContactChips actions={contactActions({ chat: { dealId: d.id }, contract: d.contract ? () => router.push({ pathname: '/contracts/[id]', params: { id: d.id } }) : undefined })} />
        {stage === 'terminated' ? (
          <ThemedText type="small" themeColor="negative">
            Оренду розірвано достроково за згодою сторін (ініціатор: {d.terminatedBy === 'owner' ? 'власник' : 'ви'})
            {d.terminatedAt ? ` ${formatDate(d.terminatedAt.slice(0, 10))}` : ''}. Розрахунок з власником лишається за вами: сплачені суми видно нижче.
          </ThemedText>
        ) : null}
        {stage === 'upcoming' || stage === 'active' ? <TerminateDeal deal={d} as="renter" /> : null}
      </Card>

      <ContractCard deal={d} as="renter" />

      {stage === 'signing' ? null : (
      <View style={styles.actions}>
        <Button title="Заробіток" icon="add-circle-outline" variant="positive" style={styles.flex} onPress={() => add('income')} />
        <Button title="Витрата" icon="remove-circle-outline" variant="secondary" style={styles.flex} onPress={() => add('expense')} />
      </View>
      )}

      {!o ? (
        <ReportStatus loading={report.loading} error={report.error} onRetry={report.retry} />
      ) : (
        <>
          <SummaryCard title="Прибуток за весь час" profit={o.profit} income={o.income} expense={o.expense} note={o.elapsedDays > 0 ? `≈ ${formatMoney(o.avgProfitPerDay)} на добу` : undefined} />

          <Card>
            <ThemedText type="default" style={styles.bold}>
              Платежі за оренду
            </ThemedText>
            <Row label={`Минуло ${o.elapsedDays} з ${o.totalDays} діб`} value={`${formatMoney(o.rentDue)} до сплати`} />
            <Row label="Сплачено власнику" value={formatMoney(o.rentPaid)} />
            <Row
              label={o.rentBalance > 0 ? 'Борг перед власником' : o.rentBalance < 0 ? 'Переплата' : 'Розрахунок'}
              value={o.rentBalance === 0 ? 'Все сплачено' : formatMoney(Math.abs(o.rentBalance))}
              tone={o.rentBalance > 0 ? 'negative' : 'positive'}
            />
            <Row label="Інші витрати (паливо, мийка…)" value={formatMoney(o.otherExpenses)} />
            <Row label="За весь період за договором" value={formatMoney(o.plannedRent)} />
          </Card>

          <Button title="Детальна аналітика" icon="stats-chart-outline" variant="secondary" onPress={() => router.push({ pathname: '/deals/analytics', params: { id: d.id } })} />
        </>
      )}

      <SectionHeader title="Історія" />
      <HistoryList dealId={d.id} />

      {stage === 'terminated' || stage === 'finished' ? <Button title="Видалити оренду" icon="trash-outline" variant="danger" onPress={confirmDelete} /> : null}
    </Screen>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.value} themeColor={tone}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 16 / 7, borderRadius: Radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  value: { fontWeight: 600, textAlign: 'right' },
});
