import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/date';
import type { DealView } from '@/lib/deals';
import { useFleet } from '@/store/fleet';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';

/**
 * Оренда закінчилась за датою, а авто досі «В оренді»: питаємо власника, чи звільнити його.
 * Без `carId` показує всі такі авто (головна), з `carId` — лише одне (екран авто).
 */
export function ReleasePrompt({ carId }: { carId?: string }) {
  const theme = useTheme();
  const { invalidate, reload } = useFleet();
  const { data, retry } = useReport<DealView[]>('/deals/awaiting-release', { refetchOnFocus: true });
  const [busy, setBusy] = useState<string | null>(null);

  async function answer(deal: DealView, action: 'release' | 'keep') {
    setBusy(deal.id);
    try {
      await api('POST', `/deals/${deal.id}/${action}`);
      // Авто змінило статус, тож оновлюємо автопарк, а підказка зникає
      if (action === 'release') reload();
      invalidate();
      retry();
    } catch (e) {
      Alert.alert('Не вдалося виконати дію', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
      retry();
    } finally {
      setBusy(null);
    }
  }

  const items = (data ?? []).filter((d) => !carId || d.carId === carId);
  if (items.length === 0) return null;

  return (
    <View style={styles.list}>
      {items.map((d) => (
        <View key={d.id} style={[styles.box, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
          <View style={styles.head}>
            <CarPhoto uri={d.photoUri} style={styles.thumb} iconSize={20} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" themeColor="warning">
                Оренда закінчилась {formatDate(d.endDate)}
              </ThemedText>
              <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                {d.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Авто досі має статус «В оренді». Звільнити його?
              </ThemedText>
            </View>
          </View>
          <View style={styles.row}>
            <Button title="Звільнити авто" icon="checkmark" variant="positive" style={styles.flex} disabled={busy === d.id} onPress={() => void answer(d, 'release')} />
            <Button title="Оренда триває" variant="secondary" style={styles.flex} disabled={busy === d.id} onPress={() => void answer(d, 'keep')} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  box: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 52, height: 52, borderRadius: Radius.sm },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  row: { flexDirection: 'row', gap: Spacing.two },
});
