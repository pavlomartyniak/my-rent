import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { useFleet } from '@/store/fleet';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';

/**
 * Прибрати завершений (скасований чи відхилений) запит або пропозицію зі свого списку.
 * Для другої сторони запис лишається; сам він видаляється через 30 днів.
 */
export function RemoveFinished({ path, what, onDone }: { path: string; what: string; onDone?: () => void }) {
  const { invalidate } = useFleet();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api('DELETE', path);
      invalidate();
      onDone?.();
    } catch (e) {
      Alert.alert('Не вдалося видалити', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: Spacing.one }}>
      <Button
        title="Видалити зі списку"
        icon="trash-outline"
        variant="secondary"
        disabled={busy}
        onPress={() =>
          Alert.alert(`Видалити ${what}?`, 'Він зникне лише з вашого списку, дію не можна скасувати.', [
            { text: 'Залишити', style: 'cancel' },
            { text: 'Видалити', style: 'destructive', onPress: () => void remove() },
          ])
        }
      />
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        Сам зникне через 30 днів
      </ThemedText>
    </View>
  );
}
