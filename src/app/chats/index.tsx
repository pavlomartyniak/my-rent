import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ReportStatus } from '@/components/report-status';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { chatArchived } from '@/lib/archive';
import { listTime, type ChatSummary } from '@/lib/chat';
import { useChatEvents } from '@/store/chat';

const TABS = ['Активні', 'Архів'] as const;

/** Мої розмови: останнє повідомлення, час і кількість непрочитаних. Розмови без активної домовленості лежать в «Архіві». */
export default function ChatsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Активні');
  const { data, loading, error, retry } = useReport<ChatSummary[]>('/chats', { refetchOnFocus: true, keepPrevious: true });

  const shown = (data ?? []).filter((c) => chatArchived(c) === (tab === 'Архів'));

  // Нове повідомлення чи «прочитано» оновлюють список одразу
  useChatEvents((e) => {
    if (e.type === 'message' || e.type === 'read' || e.type === 'resume') retry();
  });

  const confirmDelete = (c: ChatSummary) =>
    Alert.alert('Видалити розмову?', `Розмова з ${c.counterpart.name}${c.context ? ` про ${c.context.title}` : ''} зникне лише у вас. Якщо співрозмовник напише знову, вона повернеться, але без старих повідомлень.`, [
      { text: 'Залишити', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          api('DELETE', `/chats/${c.id}`)
            .then(retry)
            .catch((e) => Alert.alert('Не вдалося видалити', e instanceof ApiError ? e.message : 'Спробуйте ще раз')),
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Повідомлення', headerBackTitle: 'Назад' }} />
      {!data ? (
        <ReportStatus shape="list" loading={loading} error={error} onRetry={retry} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Розмов ще немає"
          text="Написати можна власнику чи орендарю, з яким у вас є запит, пропозиція або оренда: натисніть «Написати» на їхній картці."
        />
      ) : (
        <>
          <Segmented
            options={TABS}
            value={tab}
            onChange={setTab}
            badges={{ Активні: data.filter((c) => !chatArchived(c)).reduce((n, c) => n + c.unread, 0), Архів: data.filter(chatArchived).reduce((n, c) => n + c.unread, 0) }}
          />
          {shown.length === 0 ? (
            tab === 'Архів' ? (
              <EmptyState icon="archive-outline" title="Архів порожній" text="Сюди потрапляють розмови, за якими вже немає активної домовленості: запит відхилено чи скасовано, оренду завершено." />
            ) : (
              <EmptyState icon="chatbubbles-outline" title="Активних розмов немає" text="Старі розмови, за якими вже немає домовленості, лежать в «Архіві»." />
            )
          ) : (
        <Card style={styles.list}>
          {shown.map((c, i) => (
            <Pressable key={c.id} accessibilityRole="button" onLongPress={() => confirmDelete(c)} onPress={() => router.push({ pathname: '/chats/[id]', params: { id: c.id } })}>
              <View style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <Avatar uri={c.counterpart.photoUri} name={c.counterpart.name} size={52} />
                <View style={styles.flex}>
                  <View style={styles.top}>
                    <ThemedText type="default" style={[styles.bold, styles.flex]} numberOfLines={1}>
                      {c.counterpart.name}
                    </ThemedText>
                    {c.lastMessage ? (
                      <ThemedText type="small" themeColor={c.unread > 0 ? 'accent' : 'textSecondary'}>
                        {listTime(c.lastMessage.at)}
                      </ThemedText>
                    ) : null}
                  </View>
                  {c.context ? (
                    <View style={styles.top}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
                        {c.context.title}
                      </ThemedText>
                      <StatusBadge status={c.stage} />
                    </View>
                  ) : null}
                  <View style={styles.top}>
                    <ThemedText type="small" themeColor={c.unread > 0 ? 'text' : 'textSecondary'} style={[styles.flex, c.unread > 0 && styles.bold]} numberOfLines={1}>
                      {c.lastMessage ? `${c.lastMessage.mine ? 'Ви: ' : ''}${c.lastMessage.text}` : ''}
                    </ThemedText>
                    {c.unread > 0 ? (
                      <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                        <ThemedText style={[styles.badgeText, { color: theme.onAccent }]}>{c.unread > 99 ? '99+' : c.unread}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Icon name="chevron-forward" size={18} color="textSecondary" />
              </View>
            </Pressable>
          ))}
        </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  bold: { fontWeight: 600 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...Type.caption, fontWeight: 700 },
});
