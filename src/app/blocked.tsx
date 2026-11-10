import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/date';
import type { BlockedUser } from '@/lib/moderation';

/** Заблоковані користувачі: тут їх можна розблокувати */
export default function BlockedScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<BlockedUser[]>('GET', '/moderation/blocks')
      .then((list) => {
        setError(null);
        setItems(list);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити список'));
  }, []);
  useFocusEffect(load);

  function unblock(user: BlockedUser) {
    Alert.alert(`Розблокувати ${user.name}?`, 'Ви знову бачитимете оголошення одне одного й зможете писати.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Розблокувати',
        onPress: () =>
          api('DELETE', `/moderation/blocks/${user.userId}`)
            .then(load)
            .catch((e) => Alert.alert('Не вдалося розблокувати', e instanceof ApiError ? e.message : 'Спробуйте ще раз')),
      },
    ]);
  }

  if (error) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Не вдалося завантажити" text={error} action="Спробувати ще раз" onAction={load} />
      </Screen>
    );
  }
  if (!items) {
    return (
      <Screen>
        <ActivityIndicator color={theme.accent} />
      </Screen>
    );
  }
  if (items.length === 0) {
    return (
      <Screen>
        <EmptyState icon="shield-checkmark-outline" title="Заблокованих немає" text="Заблокувати користувача можна в чаті або на сторінці оголошення." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={styles.card}>
        {items.map((u, i) => (
          <View key={u.userId} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.name}>
                {u.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Заблоковано {formatDate(u.blockedAt.slice(0, 10))}
              </ThemedText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => unblock(u)} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <ThemedText type="default" themeColor="accent" style={styles.name}>
                Розблокувати
              </ThemedText>
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  flex: { flex: 1 },
  name: { fontWeight: 600 },
});
