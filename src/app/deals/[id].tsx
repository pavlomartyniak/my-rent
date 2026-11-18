import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { CarPhoto } from '@/components/car-photo';
import { PaymentsCard } from '@/components/payments-card';
import { HeroBar } from '@/components/hero-bar';
import { HeroButton } from '@/components/hero-button';
import { ConditionCard } from '@/components/condition-card';
import { InsuranceCard } from '@/components/insurance-card';
import { RenterDealCard } from '@/components/renter-deal-card';
import { ReviewButton } from '@/components/review-button';
import { HistoryList } from '@/components/history-list';
import { ReportStatus } from '@/components/report-status';
import { StatusBadge } from '@/components/status-badge';
import { EarningsWidget } from '@/components/earnings-widget';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { InfoGrid } from '@/components/ui/info-rows';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useFleet } from '@/store/fleet';
import { dealStage, type DealReport, type DealView } from '@/lib/deals';
import { formatKm, splitTitle } from '@/lib/format';

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

  return (
    // Фото йде під прозорий хедер на всю ширину, тож системні відступи й бічні поля Screen скасовуємо
    <View style={styles.root}>
    <Screen contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 0 }}>
      <Stack.Screen options={{ headerShown: false }} />

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

      {o ? (
        <EarningsWidget title="Прибуток за весь час" profit={o.profit} href={{ pathname: '/renter/report', params: { dealId: d.id } }} />
      ) : (
        <ReportStatus loading={report.loading} error={report.error} onRetry={report.retry} />
      )}

      {stage === 'signing' ? null : (
        <View style={styles.actions}>
          <Button title="Заробіток" icon="add" variant="positive" style={styles.flex} onPress={() => add('income')} />
          <Button title="Витрата" icon="remove" variant="danger" style={styles.flex} onPress={() => add('expense')} />
        </View>
      )}


      <RenterDealCard deal={d} overview={o} />

      <PaymentsCard deal={d} as="renter" />

      <ConditionCard deal={d} as="renter" />

      {stage === 'finished' || stage === 'terminated' ? <ReviewButton dealId={d.id} /> : null}

      {d.carId && stage !== 'terminated' ? (
        <>
          <SectionHeader title="Страховий поліс" />
          <InsuranceCard carId={d.carId} />
        </>
      ) : null}

      {d.car ? (
        <>
          <SectionHeader title="Про авто" />
          <InfoGrid
            items={[
              d.car.plate ? { label: 'Держномер', value: d.car.plate } : null,
              d.car.color ? { label: 'Колір', value: d.car.color } : null,
              { label: 'Рік', value: String(d.car.year) },
              d.car.fuel ? { label: 'Паливо', value: d.car.fuel } : null,
              d.car.mileage ? { label: 'Пробіг при передачі', value: formatKm(d.car.mileage) } : null,
              d.car.vin ? { label: 'VIN', value: d.car.vin, wide: true } : null,
            ].filter((i): i is { label: string; value: string; wide?: boolean } => !!i)}
          />
        </>
      ) : null}

      <SectionHeader title="Історія" />
      <HistoryList dealId={d.id} />

      {stage === 'terminated' || stage === 'finished' ? <Button title="Видалити оренду" icon="trash-outline" variant="danger" onPress={confirmDelete} /> : null}
    </Screen>
    <HeroBar left={<HeroButton icon="chevron-back" label="Назад" onPress={() => router.back()} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Фото на всю ширину екрана: скасовуємо бічні поля Screen
  hero: { marginHorizontal: -20 },
  photo: { width: '100%', aspectRatio: 1.2, borderRadius: 0 },
  // Лист із назвою заходить на фото закругленим верхом (мінус проміжок між блоками й сам захід)
  sheet: { marginHorizontal: -20, marginTop: -48, paddingHorizontal: 20, paddingTop: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carTitle: { ...Type.display },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  analytics: { marginTop: Spacing.two },
  rentCard: { gap: Spacing.three },
  cardTitle: { ...Type.headline },
  due: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, borderRadius: Radius.md, padding: Spacing.three },
  dueValue: { ...Type.figure },
});
