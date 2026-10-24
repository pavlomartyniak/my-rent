import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Hint } from '@/components/hint';
import { PaybackCard } from '@/components/payback-card';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { CarPhoto } from '@/components/car-photo';
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
import type { CarReport } from '@/lib/reports';
import { formatKm, formatMoney, formatMonths } from '@/lib/format';
import { useFleet } from '@/store/fleet';

export default function CarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { cars } = useFleet();
  const car = cars.find((c) => c.id === id);
  // Показники за весь час рахує сервер
  const { data: report, loading, error, retry } = useReport<CarReport>(car ? `/reports/cars/${car.id}` : null);

  if (!car) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Авто не знайдено" />
      </Screen>
    );
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={car.photoUri ? 'Змінити фото' : 'Додати фото'}
        onPress={() => router.push({ pathname: '/car/edit', params: { id: car.id } })}>
        <CarPhoto uri={car.photoUri} style={styles.photo} iconSize={44} placeholder="Додати фото" />
      </Pressable>

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

      <Hint id="car">Окупність (ROI) — це прибуток, поділений на вартість авто. Тапніть на запис в історії, щоб змінити або видалити його.</Hint>

      <SectionHeader title="Історія" />
      <HistoryList carId={car.id} />

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
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  infoValue: { flexShrink: 1, fontWeight: 600 },
});
