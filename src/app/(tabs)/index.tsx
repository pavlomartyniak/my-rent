import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CarCard } from '@/components/car-card';
import { Hint } from '@/components/hint';
import { TerminationBanner } from '@/components/termination-banner';
import { dueLabel } from '@/components/reminder-row';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ScreenTitle } from '@/components/screen-title';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, monthKey, monthTitle, todayISO } from '@/lib/date';
import type { RentalView } from '@/lib/rentals';
import type { SummaryReport } from '@/lib/reports';
import { useFleet } from '@/store/fleet';

const SORTS = ['За прибутком', 'Як додано'] as const;

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { cars, reminders, canAddCar } = useFleet();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('За прибутком');

  const month = monthKey(todayISO());
  // Підсумок місяця й прибуток по кожному авто рахує сервер
  const { data: report, loading, error, retry } = useReport<SummaryReport>(`/reports/summary?period=${month}`);
  // Нові запити орендарів на мої авто
  const { data: incoming } = useReport<RentalView[]>('/rentals/incoming?status=pending', { refetchOnFocus: true });
  const newRequests = incoming?.length ?? 0;

  // Показуємо лише одне найближче нагадування, і тільки якщо воно терміново
  const next = reminders.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextDays = next ? daysUntil(next.date) : Infinity;
  const nextCar = next ? cars.find((c) => c.id === next.carId) : undefined;

  const rows = cars.map((car) => ({ car, profit: report?.cars.find((c) => c.carId === car.id)?.period.profit }));
  if (sort === 'За прибутком') rows.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));

  const addCar = () => router.push(canAddCar ? '/car/new' : '/paywall');

  if (cars.length === 0) {
    return (
      <Screen tabs>
        <ScreenTitle>Мої авто</ScreenTitle>
        <EmptyState
          icon="car-sport-outline"
          title="Додайте перше авто"
          text="Записуйте доходи й витрати — застосунок сам покаже прибуток."
          action="Додати авто"
          onAction={addCar}
        />
      </Screen>
    );
  }

  return (
    <Screen tabs>
      <ScreenTitle>Мої авто</ScreenTitle>

      <TerminationBanner onPress={() => router.navigate('/requests')} />

      {newRequests > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/requests')} style={({ pressed }) => pressed && { opacity: 0.85 }}>
          <View style={[styles.alert, { backgroundColor: theme.accent }]}>
            <View style={styles.alertCount}>
              <ThemedText style={[styles.alertCountText, { color: theme.accent }]}>{newRequests}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={styles.alertTitle}>
                {newRequests === 1 ? 'Новий запит на оренду' : 'Нові запити на оренду'}
              </ThemedText>
              <ThemedText type="small" style={styles.alertText}>
                Орендар чекає вашої відповіді. Натисніть, щоб відповісти
              </ThemedText>
            </View>
            <Icon name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : null}

      <Hint id="home">Тапніть на авто, щоб побачити його історію й додати дохід чи витрату. Кнопка вгорі додає запис для будь-якого авто.</Hint>

      {report ? (
        <SummaryCard title={`Прибуток · ${monthTitle(month)}`} profit={report.totals.profit} income={report.totals.income} expense={report.totals.expense} />
      ) : (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      )}

      <Button title="Додати дохід або витрату" icon="add" onPress={() => router.push('/transaction/new')} />

      {next && nextDays <= 7 ? (
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/reminders')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <Icon name="alert-circle" size={24} color={nextDays < 0 ? 'negative' : 'warning'} />
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={{ fontWeight: 600 }}>
                {next.kind} · {nextCar ? `${nextCar.brand} ${nextCar.model}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor={nextDays < 0 ? 'negative' : 'textSecondary'}>
                {dueLabel(nextDays)}
              </ThemedText>
            </View>
            <Icon name="chevron-forward" size={18} color="textSecondary" />
          </Card>
        </Pressable>
      ) : null}

      <SectionHeader title="Авто" action="+ Додати" onAction={addCar} />
      {cars.length > 1 ? <Segmented options={SORTS} value={sort} onChange={setSort} /> : null}
      <View style={{ gap: Spacing.two }}>
        {rows.map(({ car, profit }) => (
          <CarCard key={car.id} car={car} profit={profit} />
        ))}
      </View>

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
