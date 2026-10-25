import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { PaybackCard } from '@/components/payback-card';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { CarPhoto } from '@/components/car-photo';
import { PhotoGallery } from '@/components/photo-gallery';
import { ContractCard } from '@/components/contract-card';
import { ContactChips } from '@/components/contact-chips';
import { contactActions } from '@/lib/contact-actions';
import { ReleasePrompt } from '@/components/release-prompt';
import { ArchivedDeals } from '@/components/archived-deals';
import { DeleteCar } from '@/components/delete-car';
import { TerminateDeal } from '@/components/terminate-deal';
import type { DealView } from '@/lib/deals';
import { HistoryList } from '@/components/history-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import type { CarReport } from '@/lib/reports';
import { formatKm, formatMoney, formatMonths } from '@/lib/format';
import { useFleet } from '@/store/fleet';

export default function CarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: `${car.brand} ${car.model}`,
          headerRight: () => (
            <IconButton icon="create-outline" label="Редагувати" size={36} onPress={() => router.push({ pathname: '/car/edit', params: { id: car.id } })} />
          ),
        }}
      />

      {photos.length > 0 ? (
        // Фото гортаються пальцем, тап відкриває їх на весь екран; змінити їх можна в редагуванні (олівець угорі)
        <PhotoGallery photos={photos} />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Додати фото" onPress={() => router.push({ pathname: '/car/edit', params: { id: car.id } })}>
          <CarPhoto style={styles.photo} iconSize={44} placeholder="Додати фото" />
        </Pressable>
      )}

      {report ? (
        <>
          <SummaryCard title="Прибуток за весь час" profit={report.overview.profit} income={report.overview.income} expense={report.overview.expense} />
          <PaybackCard
            profit={report.overview.profit}
            price={car.price}
            eta={report.overview.paybackMonths ? `≈ ${formatMonths(report.overview.paybackMonths)}` : undefined}
          />
        </>
      ) : (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      )}

      <ReleasePrompt carId={car.id} />

      {deal ? (
        <Card>
          <View style={styles.rentHead}>
            <ThemedText type="default" style={[styles.bold, styles.flex]}>
              {deal.status === 'awaiting' ? 'Домовленість: чекаємо підписання договору' : 'Зараз в оренді'}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {deal.counterpart.name} · {formatDate(deal.startDate)} – {formatDate(deal.endDate)} · {formatMoney(deal.pricePerDay)} за добу
          </ThemedText>
          <ContactChips actions={contactActions({ chat: { dealId: deal.id }, phone: deal.counterpart.phone, contract: deal.contract ? () => router.push({ pathname: '/contracts/[id]', params: { id: deal.id } }) : undefined })} />
          <ContractCard deal={deal} as="owner" />
          {deal.status === 'awaiting' ? null : <TerminateDeal deal={deal} as="owner" />}
        </Card>
      ) : null}

      <View style={styles.buttons}>
        <Button title="Дохід" icon="add" variant="positive" style={styles.flex} onPress={() => add('income')} />
        <Button title="Витрата" icon="remove" variant="danger" style={styles.flex} onPress={() => add('expense')} />
      </View>

      <Button
        title="Аналітика й окупність"
        icon="stats-chart"
        variant="secondary"
        onPress={() => router.push({ pathname: '/car/analytics', params: { id: car.id } })}
      />

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
            <ThemedText type="small" themeColor="textSecondary">
              Опублікуйте авто, щоб орендарі могли знайти його й надіслати запит на оренду.
            </ThemedText>
            <Button title="Опублікувати для орендарів" icon="megaphone-outline" onPress={() => router.push({ pathname: '/car/listing', params: { id: car.id } })} />
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Оголошення доступне лише для авто зі статусом «Вільне». Змініть статус у редагуванні авто.
          </ThemedText>
        )}
      </Card>

      <SectionHeader title="Історія" />
      <HistoryList carId={car.id} />

      <ArchivedDeals carId={car.id} />

      <SectionHeader title="Про авто" />
      <Card>
        <InfoRow label="Рік" value={String(car.year)} />
        <InfoRow label="Статус" value={car.status} />
        {car.driver ? <InfoRow label="Водій" value={car.driver} /> : null}
        {car.mileage ? <InfoRow label="Пробіг" value={formatKm(car.mileage)} /> : null}
        {car.vin ? <InfoRow label="VIN" value={car.vin} /> : null}
        <InfoRow label="В оренді з" value={formatDate(car.rentStart)} />
        <InfoRow label="Вартість" value={formatMoney(car.price)} />
      </Card>

      <DeleteCar carId={car.id} name={`${car.brand} ${car.model}`} />
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.infoValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  rentHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bold: { fontWeight: 700 },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  infoValue: { flexShrink: 1, fontWeight: 600 },
});
