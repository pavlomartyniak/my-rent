import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { PaybackCard } from '@/components/payback-card';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { CarPhoto } from '@/components/car-photo';
import { PhotoGallery } from '@/components/photo-gallery';
import { PaymentsCard } from '@/components/payments-card';
import { OwnerRentalCard } from '@/components/owner-rental-card';
import { ReleasePrompt } from '@/components/release-prompt';
import { ArchivedDeals } from '@/components/archived-deals';
import { DeleteCar } from '@/components/delete-car';
import type { DealView } from '@/lib/deals';
import { HistoryList } from '@/components/history-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InfoGrid } from '@/components/ui/info-rows';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import type { CarReport } from '@/lib/reports';
import { formatKm, formatMoney, formatMonths } from '@/lib/format';
import { useFleet } from '@/store/fleet';

export default function CarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { cars, reload } = useFleet();
  const car = cars.find((c) => c.id === id);
  // Показники за весь час рахує сервер
  const { data: report, loading, error, retry } = useReport<CarReport>(car ? `/reports/cars/${car.id}` : null);
  // Поточна оренда цього авто через застосунок (орендар, дати); {none: true} — її нема
  const { data: rental } = useReport<DealView | { none: true }>(car ? `/deals/car/${car.id}` : null, { refetchOnFocus: true });
  const deal = rental && 'id' in rental ? rental : undefined;

  if (!car) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Авто не знайдено" />
      </Screen>
    );
  }

  const photos = car.photos?.length ? car.photos : car.photoUri ? [car.photoUri] : [];
  const listed = !!car.listing?.published && car.status === 'Вільне';

  async function unpublish() {
    try {
      await api('DELETE', `/cars/${car!.id}/listing`);
      reload();
    } catch (e) {
      Alert.alert('Не вдалося зняти оголошення', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    }
  }

  const add = (type: 'income' | 'expense') => router.push({ pathname: '/transaction/new', params: { carId: car.id, type } });

  const aboutItems = [
    { label: 'Рік', value: String(car.year) },
    { label: 'Статус', value: car.status },
    car.driver ? { label: 'Водій', value: car.driver } : null,
    car.fuel ? { label: 'Паливо', value: car.fuel } : null,
    car.mileage ? { label: 'Пробіг', value: formatKm(car.mileage) } : null,
    { label: 'В оренді з', value: formatDate(car.rentStart) },
    { label: 'Вартість', value: formatMoney(car.price) },
    deal || car.listing?.pricePerDay ? { label: 'Ціна оренди', value: `${formatMoney(deal?.pricePerDay ?? car.listing!.pricePerDay)}/доба` } : null,
    car.vin ? { label: 'VIN', value: car.vin, wide: true } : null,
  ].filter((i): i is { label: string; value: string; wide?: boolean } => !!i);

  const [statusBg, statusFg] = {
    'В оренді': [theme.positiveSoft, theme.positive],
    Вільне: [theme.accentSoft, theme.accent],
    'На сервісі': [theme.warningSoft, theme.warning],
    Заброньоване: [theme.warningSoft, theme.warning],
  }[car.status] ?? [theme.backgroundSelected, theme.textSecondary];
  const subtitle = [String(car.year), car.fuel, car.mileage ? formatKm(car.mileage) : ''].filter(Boolean).join(' · ');

  return (
    // Фото йде під прозорий хедер на всю ширину, тож системні відступи й бічні поля Screen скасовуємо
    <Screen contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
          headerBackVisible: false,
          headerLeft: () => <HeroButton icon="chevron-back" label="Назад" onPress={() => router.back()} />,
          headerRight: () => <HeroButton icon="create-outline" label="Редагувати" onPress={() => router.push({ pathname: '/car/edit', params: { id: car.id } })} />,
        }}
      />

      <View style={styles.hero}>
        {photos.length > 0 ? (
          // Фото гортаються пальцем, тап відкриває їх на весь екран; змінити їх можна в редагуванні (олівець угорі)
          <PhotoGallery photos={photos} bleed />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Додати фото" onPress={() => router.push({ pathname: '/car/edit', params: { id: car.id } })}>
            <CarPhoto style={styles.noPhoto} iconSize={44} placeholder="Додати фото" />
          </Pressable>
        )}
      </View>

      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle" style={[styles.carTitle, styles.flex]} numberOfLines={2}>
            {car.brand} {car.model}
          </ThemedText>
          <View style={[styles.status, { backgroundColor: statusBg }]}>
            <ThemedText type="small" style={[styles.statusText, { color: statusFg }]}>
              {car.status}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="default" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>

      {report ? (
        <SummaryCard title="Прибуток за весь час" profit={report.overview.profit} income={report.overview.income} expense={report.overview.expense}>
          <PaybackCard
            bare
            profit={report.overview.profit}
            price={car.price}
            eta={report.overview.paybackMonths ? `≈ ${formatMonths(report.overview.paybackMonths)}` : undefined}
          />
          <Button
            title="Аналітика й окупність"
            icon="stats-chart"
            variant="soft"
            style={styles.analytics}
            onPress={() => router.push({ pathname: '/car/analytics', params: { id: car.id } })}
          />
        </SummaryCard>
      ) : (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      )}

      <View style={styles.buttons}>
        <Button title="Дохід" icon="add" variant="positiveSolid" style={styles.flex} onPress={() => add('income')} />
        <Button title="Витрата" icon="remove" variant="dangerSolid" style={styles.flex} onPress={() => add('expense')} />
      </View>

      <ReleasePrompt carId={car.id} />

      {deal ? <OwnerRentalCard deal={deal} /> : null}

      {deal ? <PaymentsCard deal={deal} as="owner" /> : null}

      <SectionHeader title="Історія" />
      <HistoryList carId={car.id} />

      <ArchivedDeals carId={car.id} />

      <SectionHeader title="Про авто" />
      <InfoGrid items={aboutItems} />

      <SectionHeader title="Оголошення для орендарів" />
      <Card>
        {listed ? (
          <>
            <ThemedText type="default" style={styles.bold}>
              Опубліковано · {car.listing!.city}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(car.listing!.pricePerDay)} за добу. Орендарі бачать це авто в пошуку й можуть надсилати запити.
            </ThemedText>
            <View style={styles.buttons}>
              <Button title="Редагувати" variant="secondary" style={styles.flex} onPress={() => router.push({ pathname: '/car/listing', params: { id: car.id } })} />
              <Button title="Зняти" variant="danger" style={styles.flex} onPress={() => void unpublish()} />
            </View>
          </>
        ) : car.status === 'Вільне' ? (
          <>
            <ThemedText type="default" style={styles.bold}>
              Авто ще не опубліковане
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Орендарі його не бачать у пошуку. Опублікуйте авто, щоб воно з’явилось і на нього можна було надсилати запити на оренду.
            </ThemedText>
            <Button title="Опублікувати для орендарів" icon="megaphone-outline" onPress={() => router.push({ pathname: '/car/listing', params: { id: car.id } })} />
          </>
        ) : (
          <View style={styles.note}>
            <Icon name="information-circle-outline" size={20} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              Оголошення доступне лише для авто зі статусом «Вільне». Змініть статус у редагуванні авто.
            </ThemedText>
          </View>
        )}
      </Card>

      <DeleteCar carId={car.id} name={`${car.brand} ${car.model}`} />
    </Screen>
  );
}

/** Кругла кнопка поверх фото: біла напівпрозора, щоб читалась на будь-якому знімку */
function HeroButton({ icon, label, onPress }: { icon: 'chevron-back' | 'create-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={styles.heroButton}>
      <Icon name={icon} size={22} color="#222222" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Фото на всю ширину екрана: скасовуємо бічні поля Screen
  hero: { marginHorizontal: -20 },
  noPhoto: { width: '100%', aspectRatio: 1.2 },
  // Лист із назвою заходить на фото закругленим верхом (мінус проміжок між блоками й сам захід)
  sheet: { marginHorizontal: -20, marginTop: -48, paddingHorizontal: 20, paddingTop: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  status: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.pill },
  statusText: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
  heroButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  analytics: { marginTop: Spacing.two },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  bold: { fontWeight: 600 },
  carTitle: { fontSize: 28, lineHeight: 34 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
