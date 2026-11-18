import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ReportStatus } from '@/components/report-status';
import { EarningsWidget } from '@/components/earnings-widget';
import { ThemedText } from '@/components/themed-text';
import { CarPhoto } from '@/components/car-photo';
import { PhotoGallery } from '@/components/photo-gallery';
import { HeroButton } from '@/components/hero-button';
import { PhotoViewer } from '@/components/photo-viewer';
import { PaymentsCard } from '@/components/payments-card';
import { OwnerRentalCard } from '@/components/owner-rental-card';
import { ReleasePrompt } from '@/components/release-prompt';
import { ArchivedDeals } from '@/components/archived-deals';
import { DeleteCar } from '@/components/delete-car';
import { InsuranceCard } from '@/components/insurance-card';
import type { DealView } from '@/lib/deals';
import { HistoryList } from '@/components/history-list';
import { Button } from '@/components/ui/button';
import { InfoGrid } from '@/components/ui/info-rows';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing, Type } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import type { CarReport } from '@/lib/reports';
import { formatKm, formatMoney } from '@/lib/format';
import { useFleet } from '@/store/fleet';

export default function CarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [viewer, setViewer] = useState(false);
  const { cars } = useFleet();
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

  const add = (type: 'income' | 'expense') => router.push({ pathname: '/transaction/new', params: { carId: car.id, type } });

  type Tile = { label: string; value: string; wide?: boolean; right?: React.ReactNode };
  const aboutItems = ([
    car.plate ? { label: 'Держномер', value: car.plate } : null,
    car.color ? { label: 'Колір', value: car.color } : null,
    { label: 'Рік', value: String(car.year) },
    { label: 'Статус', value: car.status },
    car.driver ? { label: 'Водій', value: car.driver } : null,
    car.fuel ? { label: 'Паливо', value: car.fuel } : null,
    car.mileage ? { label: 'Пробіг', value: formatKm(car.mileage) } : null,
    { label: 'В оренді з', value: formatDate(car.rentStart) },
    { label: 'Вартість', value: formatMoney(car.price) },
    deal || car.listing?.pricePerDay ? { label: 'Ціна оренди', value: `${formatMoney(deal?.pricePerDay ?? car.listing!.pricePerDay)}/доба` } : null,
    car.vin ? { label: 'VIN', value: car.vin, wide: true, right: <CopyButton text={car.vin} /> } : null,
  ] as (Tile | null)[]).filter((i): i is Tile => !!i);

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
          headerRight: () => (
            <View style={styles.headerRight}>
              <HeroButton icon="create-outline" label="Редагувати" onPress={() => router.push({ pathname: '/car/edit', params: { id: car.id } })} />
              {photos.length > 0 ? <HeroButton icon="expand-outline" label="Фото на весь екран" onPress={() => setViewer(true)} /> : null}
            </View>
          ),
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
        <EarningsWidget
          title="Прибуток за весь час"
          profit={report.overview.profit}
          href={{ pathname: '/analytics', params: { carId: car.id } }}
        />
      ) : (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      )}

      <View style={styles.buttons}>
        <Button title="Дохід" icon="add" variant="positive" style={styles.flex} onPress={() => add('income')} />
        <Button title="Витрата" icon="remove" variant="danger" style={styles.flex} onPress={() => add('expense')} />
      </View>

      <ReleasePrompt carId={car.id} />

      {deal ? <OwnerRentalCard deal={deal} /> : null}

      {deal ? <PaymentsCard deal={deal} as="owner" /> : null}

      <SectionHeader title="Страховий поліс" />
      <InsuranceCard carId={car.id} />

      <SectionHeader title="Про авто" />
      <InfoGrid items={aboutItems} />

      <SectionHeader title="Історія" />
      <HistoryList carId={car.id} />

      <ArchivedDeals carId={car.id} />

      <DeleteCar carId={car.id} name={`${car.brand} ${car.model}`} rented={car.status === 'В оренді' || car.status === 'Заброньоване'} />
      {viewer ? <PhotoViewer photos={photos} startIndex={0} onClose={() => setViewer(false)} /> : null}
    </Screen>
  );
}

/** Копіює текст у буфер і на мить показує галочку */
function CopyButton({ text }: { text: string }) {
  const theme = useTheme();
  const [done, setDone] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Копіювати"
      hitSlop={6}
      onPress={async () => {
        await Clipboard.setStringAsync(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      style={[styles.copy, { backgroundColor: theme.backgroundSelected }]}>
      <Icon name={done ? 'checkmark' : 'copy-outline'} size={18} color={done ? 'positive' : 'text'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', gap: Spacing.two },
  copy: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  // Фото на всю ширину екрана: скасовуємо бічні поля Screen
  hero: { marginHorizontal: -20 },
  noPhoto: { width: '100%', aspectRatio: 1.2 },
  // Лист із назвою заходить на фото закругленим верхом (мінус проміжок між блоками й сам захід)
  sheet: { marginHorizontal: -20, marginTop: -48, paddingHorizontal: 20, paddingTop: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  status: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.pill },
  statusText: { ...Type.caption, fontWeight: 600 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  bold: { fontWeight: 600 },
  carTitle: { ...Type.display },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
