import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { PaymentPlanPicker } from '@/components/payment-plan-picker';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import { fromISODate, toISODate } from '@/lib/date';
import { formatMoney, plural } from '@/lib/format';
import { effectivePlan, type ChoosablePlan } from '@/lib/payment-plan';
import type { MarketCar } from '@/lib/rentals';
import { useFleet } from '@/store/fleet';

const addDays = (iso: string, n: number) => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

/** Запит на оренду: дати й повідомлення власнику */
export default function RentalRequestScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const router = useRouter();
  const { invalidate } = useFleet();
  const { data: car, loading, error, retry } = useReport<MarketCar>(`/market/cars/${carId}`);

  const today = toISODate(new Date());
  const [start, setStart] = useState(addDays(today, 1));
  const [end, setEnd] = useState(addDays(today, 4));
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<ChoosablePlan>('weekly');
  const [sending, setSending] = useState(false);

  if (!car) {
    return (
      <Screen>
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      </Screen>
    );
  }

  // Орієнтовний розрахунок для підказки; остаточну суму показує сервер після відправки
  const days = Math.max(1, Math.round((fromISODate(end).getTime() - fromISODate(start).getTime()) / 86_400_000));

  function changeStart(value: string) {
    setStart(value);
    if (end < value) setEnd(value);
  }

  async function send() {
    if (sending || !car) return;
    setSending(true);
    try {
      const res = await api<{ chatId: string | null }>('POST', '/rentals', { carId: car.id, startDate: start, endDate: end, message: message.trim(), paymentPlan: effectivePlan(days, plan) });
      invalidate();
      router.dismissAll();
      router.navigate('/renter/requests');
      // Запит уже лежить у чаті з власником: відкриваємо його, щоб можна було одразу домовитись
      if (res.chatId) router.push({ pathname: '/chats/[id]', params: { id: res.chatId } });
      else Alert.alert('Запит надіслано', 'Власник отримає його й відповість. Відповідь з’явиться у «Моїх запитах».');
    } catch (e) {
      Alert.alert('Не вдалося надіслати', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <Card>
        <ThemedText type="default" style={styles.bold}>
          {car.brand} {car.model} · {car.year}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {car.city} · {formatMoney(car.pricePerDay)} за добу
        </ThemedText>
      </Card>

      <DateField label="Початок оренди" value={start} onChange={changeStart} minimumDate={new Date()} />
      <DateField label="Завершення оренди" value={end} onChange={setEnd} minimumDate={fromISODate(start)} />

      <View style={styles.summary}>
        <ThemedText type="small" themeColor="textSecondary">
          {days} {plural(days, 'доба', 'доби', 'діб')} × {formatMoney(car.pricePerDay)}
        </ThemedText>
        <ThemedText type="default" style={styles.bold}>
          ≈ {formatMoney(days * car.pricePerDay)}
        </ThemedText>
      </View>

      {car.deposit > 0 ? (
        <View style={styles.summary}>
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            Застава, разом із першою оплатою (повертається після оренди)
          </ThemedText>
          <ThemedText type="default" style={styles.bold}>
            {formatMoney(car.deposit)}
          </ThemedText>
        </View>
      ) : null}

      <PaymentPlanPicker days={days} value={plan} onChange={setPlan} />

      <Field
        label="Повідомлення власнику (необов’язково)"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={500}
        placeholder="Для чого потрібне авто, чи є водійське посвідчення…"
        style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }}
      />

      <Button title={sending ? 'Надсилаємо…' : 'Надіслати запит'} icon="paper-plane-outline" disabled={sending} onPress={send} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: 700 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
});
