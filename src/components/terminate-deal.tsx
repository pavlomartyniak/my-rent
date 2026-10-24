import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import type { DealView } from '@/lib/deals';
import { useFleet } from '@/store/fleet';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';

type Action = 'terminate' | 'terminate/withdraw' | 'terminate/accept' | 'terminate/decline';

/**
 * Дострокове розірвання за згодою сторін: одна пропонує, друга погоджується чи відхиляє.
 * Показує потрібні кнопки залежно від того, хто що вже зробив.
 */
export function TerminateDeal({ deal, as }: { deal: Pick<DealView, 'id' | 'terminationRequest' | 'counterpart'>; as: 'owner' | 'renter' }) {
  const theme = useTheme();
  const { invalidate, reload } = useFleet();
  const [busy, setBusy] = useState(false);
  const request = deal.terminationRequest;
  const other = as === 'owner' ? 'орендар' : 'власник';

  async function run(action: Action) {
    setBusy(true);
    try {
      await api('POST', `/deals/${deal.id}/${action}`, action === 'terminate' ? {} : undefined);
      invalidate();
      // Після згоди авто власника знову вільне, тож оновлюємо його авто
      if (as === 'owner' && action === 'terminate/accept') reload();
    } catch (e) {
      Alert.alert('Не вдалося виконати дію', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
      invalidate();
    } finally {
      setBusy(false);
    }
  }

  if (!request) {
    return (
      <Button
        title="Запропонувати розірвати оренду"
        icon="close-circle-outline"
        variant="danger"
        disabled={busy}
        onPress={() =>
          Alert.alert('Запропонувати розірвати оренду?', `Оренда завершиться, лише якщо ${other} погодиться. Поки відповіді немає, оренда діє як раніше.`, [
            { text: 'Не пропонувати', style: 'cancel' },
            { text: 'Запропонувати', style: 'destructive', onPress: () => void run('terminate') },
          ])
        }
      />
    );
  }

  if (request.mine) {
    return (
      <View style={[styles.box, { backgroundColor: theme.warningSoft }]}>
        <ThemedText type="smallBold" themeColor="warning">
          Ви запропонували розірвати оренду
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Чекаємо відповіді: {deal.counterpart.name}. Оренда діє, доки {other} не погодиться.
        </ThemedText>
        <Button title="Скасувати пропозицію" variant="secondary" disabled={busy} onPress={() => void run('terminate/withdraw')} />
      </View>
    );
  }

  return (
    <View style={[styles.box, { backgroundColor: theme.warningSoft }]}>
      <ThemedText type="smallBold" themeColor="warning">
        {deal.counterpart.name} пропонує розірвати оренду
      </ThemedText>
      {request.note ? (
        <ThemedText type="small" themeColor="textSecondary">
          «{request.note}»
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <Button
          title="Погодитись"
          variant="danger"
          style={styles.flex}
          disabled={busy}
          onPress={() =>
            Alert.alert('Погодитись на розірвання?', 'Оренда завершиться сьогодні, а авто повернеться до власника. Записи й платежі збережуться.', [
              { text: 'Скасувати', style: 'cancel' },
              { text: 'Погодитись', style: 'destructive', onPress: () => void run('terminate/accept') },
            ])
          }
        />
        <Button title="Відхилити" variant="secondary" style={styles.flex} disabled={busy} onPress={() => void run('terminate/decline')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
