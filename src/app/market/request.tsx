import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaymentPlanPicker } from '@/components/payment-plan-picker';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { InfoRow, InfoRows } from '@/components/ui/info-rows';
import { Segmented } from '@/components/ui/segmented';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
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
/** Мета використання авто: потрапляє в договір (п. 3.1) */
const PURPOSES = [
  { value: 'personal', label: 'Особисті потреби' },
  { value: 'passengers', label: 'Пасажири (таксі)' },
  { value: 'delivery', label: 'Доставка' },
] as const;

export default function RentalRequestScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { invalidate } = useFleet();
  const { data: car, loading, error, retry } = useReport<MarketCar>(`/market/cars/${carId}`);

  const today = toISODate(new Date());
  const [start, setStart] = useState(addDays(today, 1));
  const [end, setEnd] = useState(addDays(today, 4));
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<ChoosablePlan>('weekly');
  const [purposeLabel, setPurposeLabel] = useState<(typeof PURPOSES)[number]['label']>(PURPOSES[0].label);
  const purpose = PURPOSES.find((p) => p.label === purposeLabel)!.value;
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
  const total = days * car.pricePerDay;

  function changeStart(value: string) {
    setStart(value);
    if (end < value) setEnd(value);
  }

  async function send() {
    if (sending || !car) return;
    setSending(true);
    try {
      const res = await api<{ chatId: string | null }>('POST', '/rentals', { carId: car.id, startDate: start, endDate: end, message: message.trim(), paymentPlan: effectivePlan(start, end, plan), purpose });
      invalidate();
      router.dismissAll();
      router.navigate({ pathname: '/renter', params: { section: 'requests' } });
      // Запит уже лежить у чаті з власником: відкриваємо його, щоб можна було одразу домовитись
      if (res.chatId) router.push({ pathname: '/chats/[id]', params: { id: res.chatId } });
      else Alert.alert('Запит надіслано', 'Власник отримає його й відповість. Відповідь з’явиться у вкладці «Оренди».');
    } catch (e) {
      Alert.alert('Не вдалося надіслати', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.root}>
    <Screen contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
      <Card>
        <ThemedText type="headline">
          {car.brand} {car.model} · {car.year}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {car.city} · {formatMoney(car.pricePerDay)} за добу
        </ThemedText>
      </Card>

      <DateField label="Початок оренди" value={start} onChange={changeStart} minimumDate={new Date()} />
      <DateField label="Завершення оренди" value={end} onChange={setEnd} minimumDate={fromISODate(start)} />

      <Card>
        <ThemedText type="headline">Розрахунок</ThemedText>
        <InfoRows>
          <InfoRow label={`Оренда: ${days} ${plural(days, 'доба', 'доби', 'діб')} × ${formatMoney(car.pricePerDay)}`} value={formatMoney(total)} />
          {car.deposit > 0 ? <InfoRow label="Застава, повертається після оренди" value={formatMoney(car.deposit)} /> : <InfoRow label="Застава" value="Без застави" />}
          <InfoRow strong label="Разом" value={`≈ ${formatMoney(total + car.deposit)}`} />
        </InfoRows>
        <ThemedText type="caption" themeColor="textSecondary">
          Орієнтовна сума. Остаточну покаже договір після того, як власник прийме запит. Запит нічого не бронює й не списує.
        </ThemedText>
      </Card>

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold">Для чого авто</ThemedText>
        <Segmented options={PURPOSES.map((p) => p.label)} value={purposeLabel} onChange={setPurposeLabel} />
        <ThemedText type="small" themeColor="textSecondary">
          Мета потрапить у договір. Для перевезення пасажирів і доставки орендар сам відповідає за потрібні дозволи.
        </ThemedText>
      </View>

      <PaymentPlanPicker startDate={start} endDate={end} value={plan} onChange={setPlan} />

      <Field
        label="Повідомлення власнику (необов’язково)"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={500}
        placeholder="Для чого потрібне авто, чи є водійське посвідчення…"
        style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }}
      />

    </Screen>

      <View style={[styles.footer, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
        <Button title="Надіслати запит" icon="paper-plane-outline" loading={sending} onPress={send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
});
