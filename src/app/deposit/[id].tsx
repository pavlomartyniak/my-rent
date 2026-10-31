import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import type { DealView } from '@/lib/deals';
import { formatMoney } from '@/lib/format';
import { useFleet } from '@/store/fleet';

const NOTES: { icon: IconName; text: string }[] = [
  { icon: 'refresh-circle-outline', text: 'Застава повертається після оренди: протягом 3 діб після повернення авто, за вирахуванням збитків, штрафів чи боргу за договором.' },
  { icon: 'receipt-outline', text: 'Це не оплата оренди, тому в обліку й звітах вона не рахується.' },
  { icon: 'chatbubbles-outline', text: 'Повернення й утримання ви узгоджуєте між собою, зручно прямо в чаті.' },
];

/**
 * Відповідь на запитання про заставу. Орендар підтверджує, що вніс, власник — що отримав. Це лише відмітка для обох:
 * застосунок гроші не проводить і в облік заставу не записує.
 */
export default function DepositScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { role, invalidate } = useFleet();
  const deal = useReport<DealView>(`/deals/${id}`, { useCache: false });
  const [busy, setBusy] = useState(false);
  // Після відповіді показуємо підсумок на цьому ж екрані, а не одразу закриваємо його
  const [answered, setAnswered] = useState<DealView | null>(null);

  const renter = role === 'renter';
  const dep = (answered ?? deal.data)?.deposit ?? null;

  if (!deal.data || !dep) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Застава' }} />
        {!deal.data ? <ReportStatus loading={deal.loading} error={deal.error} onRetry={deal.retry} /> : <ThemedText type="default">У цієї оренди немає застави.</ThemedText>}
      </Screen>
    );
  }

  const counterpart = (answered ?? deal.data).counterpart.name;
  const otherRole = renter ? 'Власник' : 'Орендар';

  async function call(path: 'confirm' | 'later') {
    setBusy(true);
    try {
      const res = await api<DealView>('POST', `/deals/${id}/deposit/${path}`, {});
      invalidate();
      if (path === 'later') router.back();
      else setAnswered(res);
    } catch (e) {
      Alert.alert('Не вдалося зберегти', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(false);
    }
  }

  // Підсумок після відповіді: що зафіксовано й чого ще чекаємо від другої сторони
  if (answered) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Застава', headerBackVisible: false }} />
        <View style={styles.done}>
          <View style={[styles.badge, styles.badgeBig, { backgroundColor: theme.positiveSoft }]}>
            <Icon name="checkmark-circle" size={48} color="positive" />
          </View>
          <ThemedText type="subtitle" style={styles.center}>
            Застава зафіксована
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            {renter ? 'Ви підтвердили, що внесли' : 'Ви підтвердили, що отримали'} {formatMoney(dep.amount)}.{' '}
            {dep.other ? `${otherRole} теж підтвердив: усе збігається.` : `Чекаємо підтвердження від ${counterpart}.`}
          </ThemedText>
        </View>
        <Button title="Готово" icon="checkmark" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Застава' }} />

      <Card style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <Icon name="shield-checkmark" size={30} color="accent" />
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {deal.data.title} · {renter ? 'власник' : 'орендар'}: {counterpart}
        </ThemedText>
        <ThemedText type="subtitle" style={styles.center}>
          {formatMoney(dep.amount)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Вноситься разом із першою оплатою
        </ThemedText>
      </Card>

      <ThemedText type="default" style={styles.question}>
        {renter ? 'Ви внесли' : 'Ви отримали'} заставу {formatMoney(dep.amount)}?
      </ThemedText>

      <View style={styles.state}>
        <Row done={dep.mine} text={dep.mine ? 'Ви вже підтвердили' : 'Ви ще не підтвердили'} />
        <Row done={dep.other} text={dep.other ? `${otherRole} підтвердив` : `${otherRole} ще не підтвердив`} />
      </View>

      <Button title={renter ? 'Так, вніс заставу' : 'Так, отримав заставу'} icon="checkmark" disabled={busy || dep.mine} onPress={() => void call('confirm')} />
      <Button title="Ще ні" variant="soft" disabled={busy} onPress={() => void call('later')} />

      <Card style={styles.notes}>
        {NOTES.map((n) => (
          <View key={n.icon} style={styles.note}>
            <Icon name={n.icon} size={22} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {n.text}
            </ThemedText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Row({ done, text }: { done: boolean; text: string }) {
  return (
    <View style={styles.row}>
      <Icon name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done ? 'positive' : 'textSecondary'} />
      <ThemedText type="small" themeColor={done ? 'positive' : 'textSecondary'} style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  badge: { width: 60, height: 60, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeBig: { width: 88, height: 88 },
  center: { textAlign: 'center' },
  question: { fontWeight: 700, fontSize: 20, lineHeight: 26 },
  state: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  notes: { gap: Spacing.three },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  flex: { flex: 1 },
  done: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
});
