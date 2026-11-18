import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, AppState, Linking, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarPhoto } from '@/components/car-photo';
import { MoreMenu } from '@/components/more-menu';
import { ReportSheet } from '@/components/report-sheet';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { confirmBlock, type ReportTarget } from '@/lib/moderation';
import { Avatar } from '@/components/avatar';
import { ChatAttachments } from '@/components/chat-attachments';
import { Image } from 'expo-image';
import { openProfile } from '@/lib/profiles';
import { type Attachment, clock, dayLabel, differentDays, newClientId, type ChatMessage, type ChatSummary, type MessagesPage } from '@/lib/chat';
import { type Draft, formatSize, MAX_FILES, pickDocuments, pickFromCamera, pickFromLibrary, uploadDrafts } from '@/lib/chat-files';
import { useChat, useChatEvents } from '@/store/chat';
import { useFleet } from '@/store/fleet';

const PAGE = 40;

/** Відкриває набір номера; в симуляторі чи на пристрої без телефону просто показує номер */
function callPhone(phone: string) {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => Alert.alert('Не вдалося відкрити набір номера', `Номер: ${phone}`));
}

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
  // Файли, вибрані, але ще не надіслані
  const [drafts, setDrafts] = useState<Draft[]>([]);
  // Що саме надсилається в кожному повідомленні (за clientId): для повтору після збою, щоб не завантажувати файли двічі
  const outbox = useRef(new Map<string, { text: string; drafts: Draft[]; uploaded?: Attachment[] }>());
  const [typing, setTyping] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
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
      const out = outbox.current.get(clientId);
      // Файли завантажуємо в хмару один раз: після збою відправки повтор використовує вже завантажені
      if (out?.drafts.length && !out.uploaded) out.uploaded = await uploadDrafts(out.drafts, String(id));
      const attachments = out?.uploaded;
      const saved = await api<ChatMessage>('POST', `/chats/${id}/messages`, { text: body, clientId, ...(attachments?.length ? { attachments: attachments.map(({ url, name, size, fileId }) => (fileId ? { fileId, name, size } : { url, name, size })) } : {}) });
      outbox.current.delete(clientId);
      setMessages((prev) => {
        // Подія сокета могла вже замінити локальну копію
        if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => !(m.status && m.clientId === clientId));
        return prev.map((m) => (m.clientId === clientId ? { ...saved, mine: true } : m));
      });
    } catch (e) {
      // Причину показуємо під повідомленням: інакше повтор «нічого не робить», коли збій повторюється
      const reason = e instanceof Error && e.message ? e.message : 'Немає зв’язку із сервером';
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed', error: reason } : m)));
      if (e instanceof ApiError && e.status === 403) load();
    }
  }

  /** Знімає блокування співрозмовника й оновлює чат: поле вводу повертається */
  function unblock() {
    if (!chat) return;
    api('DELETE', `/moderation/blocks/${chat.counterpart.id}`).then(load, (e) => Alert.alert('Не вдалося розблокувати', e instanceof ApiError ? e.message : 'Спробуйте ще раз'));
  }

  function send() {
    const body = text.trim();
    if ((!body && !drafts.length) || !chat?.canSend) return;
    const clientId = newClientId();
    const files = drafts;
    outbox.current.set(clientId, { text: body, drafts: files });
    setText('');
    setDrafts([]);
    setMessages((prev) => [
      { id: `local-${clientId}`, text: body, attachments: files.map((d) => ({ kind: d.kind, url: d.uri, name: d.name, size: d.size })), mine: true, createdAt: new Date().toISOString(), clientId, status: 'sending' },
      ...prev,
    ]);
    void deliver(clientId, body);
  }

  /** Меню вкладень: фото чи відео з галереї, камера, файл */
  function attach() {
    const room = MAX_FILES - drafts.length;
    if (room <= 0) return Alert.alert('Забагато файлів', `За раз можна додати до ${MAX_FILES} вкладень.`);
    const add = (p: Promise<Draft[]>) => void p.then((d) => d.length && setDrafts((cur) => [...cur, ...d].slice(0, MAX_FILES))).catch(() => Alert.alert('Не вдалося додати файл', 'Спробуйте ще раз'));
    const actions = [
      { title: 'Фото чи відео', run: () => add(pickFromLibrary(room)) },
      { title: 'Зробити фото чи відео', run: () => add(pickFromCamera(room)) },
      { title: 'Файл', run: () => add(pickDocuments(room)) },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: [...actions.map((a) => a.title), 'Скасувати'], cancelButtonIndex: actions.length }, (i) => actions[i]?.run());
    } else {
      Alert.alert('Додати вкладення', undefined, [...actions.map((a) => ({ text: a.title, onPress: a.run })), { text: 'Скасувати', style: 'cancel' as const }]);
    }
  }

  function retry(m: ChatMessage) {
    if (!m.clientId) return;
    setMessages((prev) => prev.map((x) => (x.clientId === m.clientId ? { ...x, status: 'sending', error: undefined } : x)));
    void deliver(m.clientId, outbox.current.get(m.clientId)?.text ?? m.text);
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

  // Довге натискання на чуже повідомлення пропонує поскаржитись на нього
  function reportMessage(m: ChatMessage) {
    Alert.alert('Повідомлення', undefined, [
      { text: 'Поскаржитись на повідомлення', style: 'destructive', onPress: () => setReporting({ kind: 'message', messageId: m.id }) },
      { text: 'Скасувати', style: 'cancel' },
    ]);
  }

  const lastMineId = messages.find((m) => m.mine && !m.status)?.id;
  const readUntil = chat?.otherReadAt ? new Date(chat.otherReadAt).getTime() : 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <IconButton icon="chevron-back" label="Назад" onPress={() => router.back()} />
        <Pressable accessibilityRole="button" accessibilityLabel="Відкрити профіль" disabled={!chat} onPress={() => chat && openProfile(chat.counterpart.id)} style={[styles.flex, { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }]}>
          {chat ? <Avatar uri={chat.counterpart.photoUri} name={chat.counterpart.name} size={36} /> : null}
          <View style={styles.flex}>
            <ThemedText type="default" style={styles.bold} numberOfLines={1}>
              {chat?.counterpart.name ?? 'Розмова'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {chat?.counterpart.phone ?? (chat?.context?.title || ' ')}
            </ThemedText>
          </View>
        </Pressable>
        {chat?.counterpart.phone ? (
          <IconButton icon="call" label={`Зателефонувати: ${chat.counterpart.phone}`} onPress={() => callPhone(chat.counterpart.phone!)} />
        ) : null}
        {chat ? (
          <MoreMenu
            label="Безпека"
            actions={[
              { title: 'Поскаржитись на користувача', icon: 'flag-outline', onPress: () => setReporting({ kind: 'user', userId: chat.counterpart.id }) },
              // Уже заблокованого користувача можна розблокувати прямо тут; блокувати вдруге немає сенсу
              chat.blockedByMe
                ? { title: 'Розблокувати користувача', icon: 'checkmark-circle-outline', onPress: unblock }
                : { title: 'Заблокувати користувача', icon: 'ban-outline', destructive: true, onPress: () => confirmBlock({ userId: chat.counterpart.id }, chat.counterpart.name, () => router.back()) },
            ]}
          />
        ) : null}
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
            // У перевернутому списку «header» стоїть внизу: «друкує…» з'являється одразу під останнім повідомленням
            ListHeaderComponent={
              typing ? (
                <View style={styles.typing}>
                  <View style={[styles.typingBubble, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <ThemedText type="small" themeColor="accent" style={styles.typingText}>
                      {chat?.counterpart.name.split(' ')[0] ?? 'Співрозмовник'} друкує…
                    </ThemedText>
                  </View>
                </View>
              ) : undefined
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.accent} style={{ margin: Spacing.three }} /> : undefined}
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
                      disabled={!failed && (item.mine || !!item.status)}
                      onPress={failed ? () => retry(item) : undefined}
                      onLongPress={!item.mine && !item.status ? () => reportMessage(item) : undefined}
                      accessibilityLabel={failed ? 'Не надіслано. Натисніть, щоб повторити' : undefined}
                      style={[
                        styles.bubble,
                        item.mine ? { backgroundColor: failed ? theme.negative : theme.accent } : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 },
                        item.status === 'sending' && styles.sending,
                      ]}>
                      {item.attachments?.length ? <ChatAttachments items={item.attachments} mine={item.mine} chatId={String(id)} inert={!!item.status} /> : null}
                      {item.text ? (
                        <ThemedText type="default" style={{ color: item.mine ? '#FFFFFF' : theme.text }} selectable>
                          {item.text}
                        </ThemedText>
                      ) : null}
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
                      Не надіслано{item.error ? `: ${item.error}` : ''}. Натисніть на повідомлення, щоб повторити
                    </ThemedText>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        {chat?.blocked ? (
          <View style={[styles.closed, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.two), gap: Spacing.two }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.closedText}>
              {chat.blockedByMe ? 'Ви заблокували цього користувача, тому писати йому не можна. Історію можна читати.' : 'Писати цьому користувачу неможливо. Історію можна читати.'}
            </ThemedText>
            {chat.blockedByMe ? (
              <Button
                title="Розблокувати"
                variant="secondary"
                onPress={unblock}
              />
            ) : null}
          </View>
        ) : chat && !chat.canSend ? (
          <View style={[styles.closed, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.closedText}>
              Чат закрито: між вами вже немає активного запиту чи оренди. Історію можна читати.
            </ThemedText>
          </View>
        ) : (
          <View style={{ backgroundColor: theme.backgroundElement, borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }}>
            {drafts.length ? (
              <View style={styles.drafts}>
                {drafts.map((d) => (
                  <View key={d.id} style={[styles.draft, { backgroundColor: theme.backgroundSelected }]}>
                    {d.kind === 'image' ? (
                      <Image source={{ uri: d.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <View style={styles.draftFile}>
                        <Icon name={d.kind === 'video' ? 'videocam' : 'document-text-outline'} size={22} color="textSecondary" />
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.draftName}>
                          {d.name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatSize(d.size)}
                        </ThemedText>
                      </View>
                    )}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Прибрати ${d.name}`} hitSlop={6} onPress={() => setDrafts((cur) => cur.filter((x) => x.id !== d.id))} style={styles.draftRemove}>
                      <Icon name="close" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          <View style={[styles.composer, { paddingBottom: keyboard ? Spacing.two : Math.max(insets.bottom, Spacing.two), borderTopWidth: 0 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Додати вкладення" onPress={attach} style={({ pressed }) => [styles.attach, pressed && { opacity: 0.6 }]}>
              <Icon name="attach" size={24} color="textSecondary" />
            </Pressable>
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
              disabled={!text.trim() && !drafts.length}
              onPress={send}
              style={({ pressed }) => [styles.send, { backgroundColor: text.trim() || drafts.length ? theme.accent : theme.backgroundSelected }, pressed && { opacity: 0.8 }]}>
              <Icon name="send" size={20} color={text.trim() || drafts.length ? '#FFFFFF' : 'textSecondary'} />
            </Pressable>
          </View>
          </View>
        )}
      </KeyboardAvoidingView>
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
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
  typing: { flexDirection: 'row', justifyContent: 'flex-start', paddingTop: 2 },
  typingBubble: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.lg, borderWidth: 1 },
  typingText: { fontStyle: 'italic', fontWeight: 600 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 130, borderRadius: 22, borderWidth: 1, paddingHorizontal: Spacing.three, paddingTop: 11, paddingBottom: 11, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  attach: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  drafts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  draft: { width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden' },
  draftFile: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4, gap: 1 },
  draftName: { maxWidth: 64 },
  draftRemove: { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  closed: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  closedText: { textAlign: 'center' },
});
