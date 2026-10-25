import { useRouter, Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { listTime, type ChatSummary } from '@/lib/chat';
import { useChatEvents } from '@/store/chat';

/** Усі мої розмови: останнє повідомлення, час і кількість непрочитаних */
export default function ChatsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { data, loading, error, retry } = useReport<ChatSummary[]>('/chats', { refetchOnFocus: true, keepPrevious: true });

  // Нове повідомлення чи «прочитано» оновлюють список одразу
  useChatEvents((e) => {
    if (e.type === 'message' || e.type === 'read' || e.type === 'resume') retry();
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Повідомлення', headerBackTitle: 'Назад' }} />
      {!data ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Розмов ще немає"
          text="Написати можна власнику чи орендарю, з яким у вас є запит, пропозиція або оренда: натисніть «Написати» на їхній картці."
        />
      ) : (
        <Card style={styles.list}>
          {data.map((c, i) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/chats/[id]', params: { id: c.id } })}>
              <View style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText type="default" themeColor="accent" style={styles.initial}>
                    {c.counterpart.name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.flex}>
                  <View style={styles.top}>
                    <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                      {c.counterpart.name}
                    </ThemedText>
                    {c.lastMessage ? (
                      <ThemedText type="small" themeColor={c.unread > 0 ? 'accent' : 'textSecondary'}>
                        {listTime(c.lastMessage.at)}
                      </ThemedText>
                    ) : null}
                  </View>
                  {c.contextTitle ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {c.contextTitle}
                    </ThemedText>
                  ) : null}
                  <View style={styles.top}>
                    <ThemedText type="small" themeColor={c.unread > 0 ? 'text' : 'textSecondary'} style={[styles.flex, c.unread > 0 && styles.bold]} numberOfLines={1}>
                      {c.lastMessage ? `${c.lastMessage.mine ? 'Ви: ' : ''}${c.lastMessage.text}` : ''}
                    </ThemedText>
                    {c.unread > 0 ? (
                      <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                        <ThemedText style={styles.badgeText}>{c.unread > 99 ? '99+' : c.unread}</ThemedText>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  avatar: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: 700, fontSize: 20 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  bold: { fontWeight: 700 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: 700 },
});
