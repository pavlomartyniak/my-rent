import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/date';
import { dealStage, type DealView } from '@/lib/deals';
import { formatMoney } from '@/lib/format';
import { Spacing } from '@/constants/theme';
import { useFleet } from '@/store/fleet';

import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { SectionHeader } from './ui/section-header';

/** Власник: завершені й розірвані оренди цього авто. Видалення прибирає запис лише зі списку власника. */
export function ArchivedDeals({ carId }: { carId: string }) {
  const { invalidate } = useFleet();
  const { data, retry } = useReport<DealView[]>(`/deals/car/${carId}/archive`, { refetchOnFocus: true });
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(d: DealView) {
    setBusy(d.id);
    try {
      await api('DELETE', `/deals/${d.id}`);
      invalidate();
      retry();
    } catch (e) {
      Alert.alert('Не вдалося видалити', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(null);
    }
  }

  if (!data?.length) return null;

  return (
    <>
      <SectionHeader title="Попередні оренди" />
      <View style={styles.list}>
        {data.map((d) => (
          <Card key={d.id}>
            <View style={styles.head}>
              <View style={styles.flex}>
                <ThemedText type="default" style={styles.bold}>
                  {d.counterpart.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(d.startDate)} – {formatDate(d.endDate)} · {formatMoney(d.pricePerDay)} за добу
                </ThemedText>
              </View>
              <StatusBadge status={dealStage(d)} />
            </View>
            <Button
              title="Видалити з архіву"
              icon="trash-outline"
              variant="secondary"
              disabled={busy === d.id}
              onPress={() =>
                Alert.alert('Видалити оренду з архіву?', 'Вона зникне лише з вашого списку. У орендаря її облік лишається.', [
                  { text: 'Залишити', style: 'cancel' },
                  { text: 'Видалити', style: 'destructive', onPress: () => void remove(d) },
                ])
              }
            />
          </Card>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
});
