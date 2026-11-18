import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { NumberField } from '@/components/ui/number-field';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/date';
import type { DealView } from '@/lib/deals';
import { formatMoney } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useFleet } from '@/store/fleet';

/**
 * Відповідь на запитання про платіж. Орендар підтверджує, що сплатив, власник — що отримав. Відповідь одразу
 * створює запис в обліку цього користувача; другу сторону застосунок не питає за нього.
 */
export default function PaymentScreen() {
  const { id, n } = useLocalSearchParams<{ id: string; n: string }>();
  const router = useRouter();
  const { role, invalidate } = useFleet();
  // Оренду з платежами віддаємо обом сторонам: питання про платіж залежить лише від самого платежу
  const deal = useReport<DealView>(`/deals/${id}`, { useCache: false });
  const [part, setPart] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const pay = deal.data?.payments.find((p) => p.n === Number(n));
  const info =
    pay && deal.data && pay.available && !pay.cancelled && pay.remaining > 0
      ? { title: deal.data.title, counterpart: deal.data.counterpart.name, count: deal.data.payments.length, amount: pay.amount, remaining: pay.remaining, mine: pay.mine, dueDate: pay.dueDate, n: pay.n }
      : undefined;

  if (!info) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Платіж' }} />
        {!deal.data ? (
          <ReportStatus loading={deal.loading} error={deal.error} onRetry={deal.retry} />
        ) : (
          <EmptyState
            icon="checkmark-circle-outline"
            title={!pay || pay.cancelled ? 'Цього платежу немає' : !pay.available ? 'Підтвердження ще не відкрите' : 'Платіж уже закрито'}
            text={!pay || pay.cancelled ? undefined : !pay.available ? `Відкриється ${formatDate(pay.dueDate)}` : 'Вся сума підтверджена'}
          />
        )}
      </Screen>
    );
  }

  const renter = role === 'renter';
  const verb = renter ? 'сплатили' : 'отримали';

  async function call(path: string, body?: object) {
    setBusy(true);
    try {
      await api('POST', `/deals/${id}/payments/${n}/${path}`, body ?? {});
      invalidate();
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      Alert.alert('Не вдалося зберегти', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(false);
    }
  }

  const partAmount = Number(amount);
  const partError = part && !(partAmount > 0 && partAmount <= info.amount) ? `Вкажіть суму від 1 до ${formatMoney(info.amount)}` : undefined;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Платіж' }} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {info.title}
          {info.count > 1 ? ` · платіж ${info.n} з ${info.count}` : ''}
        </ThemedText>
        <ThemedText type="subtitle">{formatMoney(info.amount)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Строк: {formatDate(info.dueDate)} · {renter ? 'власник' : 'орендар'}: {info.counterpart}
        </ThemedText>
        {info.mine > 0 ? (
          <ThemedText type="smallBold" themeColor="positive">
            Ви вже підтвердили {formatMoney(info.mine)}
          </ThemedText>
        ) : null}
      </Card>

      <ThemedText type="title" style={styles.question} accessibilityRole="header">
        Ви {verb} {formatMoney(info.remaining)}?
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {renter ? 'Після відповіді сума потрапить у ваші витрати.' : 'Після відповіді сума потрапить у ваші доходи.'} Застосунок не проводить гроші, а лише фіксує ваші відповіді. Друга сторона підтверджує свою частину окремо.
      </ThemedText>

      <Button title={`Так, ${verb} ${formatMoney(info.remaining)}`} icon="checkmark" variant="primary" loading={busy} onPress={() => void call('confirm', info.mine > 0 ? { amount: info.amount } : {})} />

      {part ? (
        <View style={{ gap: Spacing.two }}>
          <NumberField label={`Скільки ${verb} разом за цей платіж, ₴`} value={amount} onChangeValue={setAmount} maxDigits={9} placeholder={String(Math.round(info.amount / 2))} error={partError} />
          <Button title={amount && !partError ? `Підтвердити ${formatMoney(partAmount)}` : 'Вкажіть суму'} icon="checkmark" loading={busy} disabled={!!partError || !amount} onPress={() => void call('confirm', { amount: partAmount })} />
        </View>
      ) : (
        <Button title={`${renter ? 'Сплатив(ла)' : 'Отримав(ла)'} лише частину`} icon="remove-circle-outline" variant="soft" disabled={busy} onPress={() => setPart(true)} />
      )}

      <Button title={renter ? 'Ще не сплатив(ла)' : 'Ще не отримав(ла)'} variant="tertiary" disabled={busy} onPress={() => void call('later')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: { marginTop: Spacing.two },
});
