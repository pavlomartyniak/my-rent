import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarPhoto } from '@/components/car-photo';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { clock, dayLabel, differentDays, newClientId, type ChatMessage, type ChatSummary, type MessagesPage } from '@/lib/chat';
import { useChat, useChatEvents } from '@/store/chat';
import { useFleet } from '@/store/fleet';

const PAGE = 40;

/** Розмова: повідомлення приходять у реальному часі, надсилаються з миттєвим відображенням */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { role } = useFleet();
  const { sendTyping } = useChat();

  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // від нових до старих
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  // Позначає чат прочитаним, щоб співрозмовник побачив «прочитано», а лічильник скинувся
  const markRead = useCallback(() => {
    if (AppState.currentState === 'active') api('POST', `/chats/${id}/read`).catch(() => {});
  }, [id]);

  const load = useCallback(() => {
    Promise.all([api<ChatSummary>('GET', `/chats/${id}`), api<MessagesPage>('GET', `/chats/${id}/messages?limit=${PAGE}`)])
      .then(([summary, page]) => {
        setError(null);
        setChat(summary);
        // Локальні повідомлення, що ще не дійшли, лишаються зверху
        setMessages((prev) => [...prev.filter((m) => m.status), ...page.items.filter((m) => !prev.some((p) => p.status && p.clientId === m.clientId))]);
        setHasMore(page.hasMore);
        setLoading(false);
        markRead();
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити розмову');
        setLoading(false);
      });
  }, [id, markRead]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  useChatEvents((e) => {
    if (e.type === 'removed' && e.conversationId === id) {
      router.back();
      return;
    }
    if (e.type === 'resume') {
      load();
      return;
    }
    if (e.conversationId !== id) return;
    if (e.type === 'message') {
      const mine = chat ? e.senderId !== chat.counterpart.id : false;
      const incoming: ChatMessage = { ...e.message, mine };
      setMessages((prev) => {
        // Своє повідомлення замінює локальну копію за clientId; чужі додаються, якщо їх ще немає
        const i = prev.findIndex((m) => m.id === incoming.id || (incoming.clientId && m.clientId === incoming.clientId));
        if (i >= 0) return prev.map((m, j) => (j === i ? incoming : m));
        return [incoming, ...prev];
      });
      if (!mine) {
        setTyping(false);
        markRead();
      }
    } else if (e.type === 'read') {
      if (e.by !== role) setChat((c) => (c ? { ...c, otherReadAt: e.at } : c));
    } else if (e.type === 'typing') {
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3500);
    }
  });

  async function loadOlder() {
    const oldest = [...messages].reverse().find((m) => !m.status);
    if (!hasMore || loadingMore || !oldest) return;
    setLoadingMore(true);
    try {
      const page = await api<MessagesPage>('GET', `/chats/${id}/messages?limit=${PAGE}&before=${oldest.id}`);
      setMessages((prev) => [...prev, ...page.items.filter((m) => !prev.some((p) => p.id === m.id))]);
      setHasMore(page.hasMore);
    } catch {
      // Наступна прокрутка спробує ще раз
    } finally {
      setLoadingMore(false);
    }
  }

  async function deliver(clientId: string, body: string) {
    try {
      const saved = await api<ChatMessage>('POST', `/chats/${id}/messages`, { text: body, clientId });
      setMessages((prev) => {
        // Подія сокета могла вже замінити локальну копію
        if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => !(m.status && m.clientId === clientId));
        return prev.map((m) => (m.clientId === clientId ? { ...saved, mine: true } : m));
      });
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m)));
      if (e instanceof ApiError && e.status === 403) load();
    }
  }

  function send() {
    const body = text.trim();
    if (!body || !chat?.canSend) return;
    const clientId = newClientId();
    setText('');
    setMessages((prev) => [{ id: `local-${clientId}`, text: body, mine: true, createdAt: new Date().toISOString(), clientId, status: 'sending' }, ...prev]);
    void deliver(clientId, body);
  }

  function retry(m: ChatMessage) {
    if (!m.clientId) return;
    setMessages((prev) => prev.map((x) => (x.clientId === m.clientId ? { ...x, status: 'sending' } : x)));
    void deliver(m.clientId, m.text);
  }

  function onChange(value: string) {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      sendTyping(id);
    }
  }

  const confirmDelete = () =>
    Alert.alert('Видалити розмову?', 'Вона зникне лише у вас. Якщо співрозмовник напише знову, розмова повернеться, але без старих повідомлень.', [
      { text: 'Залишити', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () => api('DELETE', `/chats/${id}`).catch((e) => Alert.alert('Не вдалося видалити', e instanceof ApiError ? e.message : 'Спробуйте ще раз')),
      },
    ]);

  // Тап по картці веде туди, звідки розмова: оренда → оренда, пропозиція → пропозиція, запит → запит
  function openContext() {
    if (!chat) return;
    if (chat.dealId) {
      if (role === 'renter') router.push({ pathname: '/deals/[id]', params: { id: chat.dealId } });
      else if (chat.context?.carId) router.push({ pathname: '/car/[id]', params: { id: chat.context.carId } });
      return;
    }
    if (chat.source?.kind === 'offer') {
      if (role === 'renter' && chat.source.wantedId) router.push({ pathname: '/wanted/[id]', params: { id: chat.source.wantedId } });
      else if (role === 'owner') router.navigate({ pathname: '/requests', params: { section: 'offers' } });
    } else if (chat.source?.kind === 'request') {
      router.navigate(role === 'renter' ? '/renter/requests' : '/requests');
    }
  }
  const contextTappable = !!chat && (!!chat.dealId || !!chat.source);

  const lastMineId = messages.find((m) => m.mine && !m.status)?.id;
  const readUntil = chat?.otherReadAt ? new Date(chat.otherReadAt).getTime() : 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <IconButton icon="chevron-back" label="Назад" onPress={() => router.back()} />
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.bold} numberOfLines={1}>
            {chat?.counterpart.name ?? 'Розмова'}
          </ThemedText>
          <ThemedText type="small" themeColor={typing ? 'accent' : 'textSecondary'} numberOfLines={1}>
            {typing ? 'друкує…' : chat?.context?.title || ' '}
          </ThemedText>
        </View>
        <IconButton icon="trash-outline" label="Видалити розмову" tone="neutral" onPress={confirmDelete} />
      </View>

      {chat?.context ? (
        <Pressable
          accessibilityRole={contextTappable ? 'button' : undefined}
          disabled={!contextTappable}
          onPress={openContext}
          style={[styles.context, { backgroundColor: theme.backgroundElement, borderBottomColor: theme.border }]}>
          <CarPhoto uri={chat.context.photoUri ?? undefined} style={styles.contextPhoto} iconSize={20} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {chat.context.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {[chat.context.city, `${formatMoney(chat.context.pricePerDay)}/доба`].filter(Boolean).join(' · ')}
            </ThemedText>
            {chat.context.startDate ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {formatDate(chat.context.startDate)} – {formatDate(chat.context.endDate)}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.contextEnd}>
            <StatusBadge status={chat.stage} />
            {contextTappable ? <Icon name="chevron-forward" size={16} color="textSecondary" /> : null}
          </View>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Не вдалося відкрити розмову" text={error} action="Спробувати ще раз" onAction={() => { setLoading(true); load(); }} />
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.clientId ?? m.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReached={() => void loadOlder()}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.messages}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Розмова ще порожня. Напишіть перше повідомлення.
                </ThemedText>
              </View>
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.accent} style={{ margin: Spacing.three }} /> : null}
            renderItem={({ item, index }) => {
              const older = messages[index + 1];
              const sepBefore = !older || differentDays(item.createdAt, older.createdAt);
              const failed = item.status === 'failed';
              const seen = item.id === lastMineId && new Date(item.createdAt).getTime() <= readUntil;
              return (
                <View>
                  {sepBefore ? (
                    <View style={[styles.day, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.dayText}>
                        {dayLabel(item.createdAt)}
                      </ThemedText>
                    </View>
                  ) : null}
                  <View style={[styles.line, item.mine ? styles.lineMine : styles.lineTheirs]}>
                    <Pressable
                      disabled={!failed}
                      onPress={() => retry(item)}
                      accessibilityLabel={failed ? 'Не надіслано. Натисніть, щоб повторити' : undefined}
                      style={[
                        styles.bubble,
                        item.mine ? { backgroundColor: failed ? theme.negative : theme.accent } : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 },
                        item.status === 'sending' && styles.sending,
                      ]}>
                      <ThemedText type="default" style={{ color: item.mine ? '#FFFFFF' : theme.text }} selectable>
                        {item.text}
                      </ThemedText>
                      <View style={styles.meta}>
                        <ThemedText type="small" style={[styles.time, { color: item.mine ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>
                          {clock(item.createdAt)}
                        </ThemedText>
                        {item.mine && !item.status ? <Icon name={seen ? 'checkmark-done' : 'checkmark'} size={14} color={seen ? '#FFFFFF' : 'rgba(255,255,255,0.8)'} /> : null}
                      </View>
                    </Pressable>
                  </View>
                  {failed ? (
                    <ThemedText type="small" themeColor="negative" style={styles.failed}>
                      Не надіслано. Натисніть на повідомлення, щоб повторити
                    </ThemedText>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        {chat && !chat.canSend ? (
          <View style={[styles.closed, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.closedText}>
              Чат закрито: між вами вже немає активного запиту чи оренди. Історію можна читати.
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: keyboard ? Spacing.two : Math.max(insets.bottom, Spacing.two) }]}>
            <TextInput
              value={text}
              onChangeText={onChange}
              placeholder="Повідомлення"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={2000}
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.borderStrong, color: theme.text }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Надіслати"
              disabled={!text.trim()}
              onPress={send}
              style={({ pressed }) => [styles.send, { backgroundColor: text.trim() ? theme.accent : theme.backgroundSelected }, pressed && { opacity: 0.8 }]}>
              <Icon name="send" size={20} color={text.trim() ? '#FFFFFF' : 'textSecondary'} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  context: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  contextPhoto: { width: 48, height: 48, borderRadius: Radius.sm },
  contextEnd: { alignItems: 'flex-end', gap: 4 },
  messages: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: 6, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  emptyWrap: { padding: Spacing.five, transform: [{ scaleY: -1 }] },
  emptyText: { textAlign: 'center' },
  day: { alignSelf: 'center', paddingHorizontal: Spacing.three, paddingVertical: 4, borderRadius: Radius.pill, marginVertical: Spacing.two },
  dayText: { fontWeight: 600 },
  line: { flexDirection: 'row' },
  lineMine: { justifyContent: 'flex-end' },
  lineTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.lg, gap: 2 },
  sending: { opacity: 0.6 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  time: { fontSize: 11, lineHeight: 14 },
  failed: { textAlign: 'right', marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 130, borderRadius: 22, borderWidth: 1, paddingHorizontal: Spacing.three, paddingTop: 11, paddingBottom: 11, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closed: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  closedText: { textAlign: 'center' },
});
