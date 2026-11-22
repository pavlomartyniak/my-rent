import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { PhotoViewer } from '@/components/photo-viewer';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SwitchTabs } from '@/components/ui/switch-tabs';
import { type IconName } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { type CheckinReport, type CheckinSettings, type CheckinView, dueText, errorText, EVERY_OPTIONS, remindCheckin, saveCheckinSettings, WEEKDAY_OPTIONS } from '@/lib/checkin';
import { daysUntil, formatDate } from '@/lib/date';
import { formatKm } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const stamp = (iso: string) => `${formatDate(iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
const EVERY_LABELS = EVERY_OPTIONS.map((o) => o.label);
const WEEKDAY_ACCUSATIVE = ['у неділю', 'у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у пʼятницю', 'у суботу'];

/**
 * Регулярний фотозвіт орендаря про авто. Власник вмикає його й обирає, що показувати (панель приладів із пробігом завжди,
 * кузов і салон за бажанням); орендар надсилає звіт камерою, а обидва бачать історію звітів із пробігом за кожен період.
 */
export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, loading, error, retry } = useReport<CheckinView>(`/checkin/${id}`, { useCache: false, refetchOnFocus: true });
  const [draft, setDraft] = useState<CheckinSettings | null>(null);
  const [busy, setBusy] = useState<'save' | 'remind' | null>(null);
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Звіти про авто', headerBackTitle: 'Назад' }} />
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      </Screen>
    );
  }

  const owner = data.role === 'owner';
  const s = draft ?? data.settings;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(data.settings);
  const patch = (changes: Partial<CheckinSettings>) => setDraft({ ...s, ...changes });
  const { state, due } = data.status;

  async function save() {
    if (!draft) return;
    setBusy('save');
    try {
      await saveCheckinSettings(String(id), draft);
      setDraft(null);
      retry();
    } catch (e) {
      Alert.alert('Не вдалося зберегти', errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function remind() {
    setBusy('remind');
    try {
      await remindCheckin(String(id));
      retry();
      Alert.alert('Нагадування надіслано', 'Орендар побачить його в чаті.');
    } catch (e) {
      Alert.alert('Не вдалося надіслати', errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const statusLine = (() => {
    if (!data.settings.enabled || !due) return null;
    const days = daysUntil(due);
    const tone = state === 'overdue' ? 'negative' : state === 'open' ? 'warning' : 'textSecondary';
    const head = state === 'overdue' ? 'Звіт прострочено' : state === 'open' ? 'Час надіслати звіт' : 'Наступний звіт';
    return { tone: tone as 'negative' | 'warning' | 'textSecondary', head, text: `${dueText(state, days, data.status.overdueDays)} · ${formatDate(due)}` };
  })();

  return (
    <>
      <Screen contentContainerStyle={dirty ? { paddingBottom: 120 } : undefined}>
        <Stack.Screen options={{ title: 'Звіти про авто', headerBackTitle: 'Назад' }} />

        {owner ? (
          <>
            <Card style={styles.masterCard}>
              <View style={styles.rowBetween}>
                <Bubble icon="camera" tone={s.enabled ? 'accent' : 'neutral'} />
                <View style={styles.flex}>
                  <ThemedText type="headline">Звіт від орендаря</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.enabled ? 'Увімкнено: орендар знімає авто й надсилає фото та пробіг' : 'Вимкнено. Увімкніть, щоб бачити стан авто під час оренди'}
                  </ThemedText>
                </View>
                <Switch value={s.enabled} disabled={!data.canConfigure} onValueChange={(enabled) => patch({ enabled })} trackColor={{ true: theme.accent }} />
              </View>
            </Card>

            {s.enabled ? (
              <>
                <SectionLabel>Розклад</SectionLabel>
                <Card style={styles.card}>
                  <SwitchTabs
                    options={EVERY_LABELS}
                    value={EVERY_OPTIONS.find((o) => o.value === s.every)!.label}
                    onChange={(l) => patch({ every: EVERY_OPTIONS.find((o) => o.label === l)!.value })}
                  />
                  {s.every !== 'monthly' ? (
                    <>
                      <View style={styles.days}>
                        {WEEKDAY_OPTIONS.map((d) => {
                          const on = d.value === s.weekday;
                          return (
                            <Pressable
                              key={d.value}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: on, checked: on }}
                              accessibilityLabel={d.label}
                              disabled={!data.canConfigure}
                              onPress={() => {
                                haptic.select();
                                patch({ weekday: d.value });
                              }}
                              style={[styles.day, { backgroundColor: on ? theme.ink : theme.backgroundSelected }]}
                            >
                              <ThemedText type="smallBold" style={{ color: on ? theme.onInk : theme.text }}>
                                {d.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {s.every === 'weekly' ? 'Щотижня' : 'Раз на два тижні'}, {WEEKDAY_ACCUSATIVE[s.weekday]}. Першого звіту чекаємо не раніше ніж через{' '}
                        {s.every === 'weekly' ? 'тиждень' : 'два тижні'} після початку оренди.
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Щомісяця, у той самий день, коли почалась оренда.
                    </ThemedText>
                  )}
                </Card>

                <SectionLabel>Що сфотографувати</SectionLabel>
                <Card style={styles.list}>
                  <ItemRow icon="speedometer-outline" title="Панель приладів" subtitle="Пробіг, паливо, помилки" locked value onChange={() => {}} />
                  <Divider />
                  <ItemRow
                    icon="car-sport-outline"
                    title="Кузов з усіх боків"
                    subtitle="4 фото: спереду, ззаду, зліва, справа"
                    value={s.body}
                    disabled={!data.canConfigure}
                    onChange={(body) => patch({ body })}
                  />
                  <Divider />
                  <ItemRow
                    icon="people-outline"
                    title="Салон"
                    subtitle="Передні й задні сидіння"
                    value={s.interior}
                    disabled={!data.canConfigure}
                    onChange={(interior) => patch({ interior })}
                  />
                </Card>
                <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
                  Фото орендар знімає камерою в застосунку, галерея недоступна. Умови з’являться в договорі, якщо його ще не підписано.
                </ThemedText>
              </>
            ) : null}
          </>
        ) : null}

        {statusLine ? (
          <Card style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <ThemedText type="small" themeColor="textSecondary">
                  {owner ? 'Орендар' : 'Звіт'} · {data.requirement}
                </ThemedText>
                <ThemedText type="headline" themeColor={statusLine.tone}>
                  {statusLine.head}
                </ThemedText>
                <ThemedText type="default" themeColor={statusLine.tone}>
                  {statusLine.text}
                </ThemedText>
              </View>
              <Icon
                name={state === 'overdue' ? 'alert-circle' : state === 'open' ? 'camera' : 'calendar-outline'}
                size={34}
                color={state === 'overdue' ? 'negative' : state === 'open' ? 'warning' : 'textSecondary'}
              />
            </View>
            {!owner && data.canSubmit ? (
              <Button title="Зробити звіт" icon="camera-outline" onPress={() => router.push({ pathname: '/checkin/report', params: { dealId: String(id) } })} />
            ) : null}
            {owner && data.canRemind ? (
              <Button
                title="Нагадати орендарю"
                icon="notifications-outline"
                variant="secondary"
                loading={busy === 'remind'}
                disabled={busy !== null}
                onPress={() => void remind()}
              />
            ) : null}
          </Card>
        ) : null}

        {!owner && !data.settings.enabled ? (
          <EmptyState icon="camera-outline" title="Звіт не вимагається" text="Власник не просить регулярних звітів про авто. Якщо попросить, ви отримаєте повідомлення в чаті." />
        ) : null}

        {data.reports.length ? (
          <>
            <SectionHeader title="Звіти" />
            {data.totalKm !== null ? (
              <ThemedText type="small" themeColor="textSecondary">
                З початку оренди проїхано {formatKm(data.totalKm)}
                {data.lastKm !== null ? ` · зараз ${formatKm(data.lastKm)}` : ''}
              </ThemedText>
            ) : null}
            {data.reports.map((r) => (
              <ReportCard key={r.id} report={r} onOpen={(index) => setViewer({ urls: r.photos.map((p) => p.url), index })} />
            ))}
          </>
        ) : owner && s.enabled ? (
          <ThemedText type="small" themeColor="textSecondary">
            Звітів поки немає. Щойно орендар надішле перший, він з’явиться тут і в чаті.
          </ThemedText>
        ) : null}

        {viewer ? <PhotoViewer photos={viewer.urls} startIndex={viewer.index} onClose={() => setViewer(null)} /> : null}
      </Screen>
      {dirty ? (
        // Кнопка збереження закріплена внизу, поки є незбережені зміни: не треба гортати, щоб її знайти
        <View style={[styles.bar, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <Button
            title={busy === 'save' ? 'Зберігаємо…' : s.enabled ? 'Зберегти' : 'Вимкнути звіт'}
            loading={busy === 'save'}
            disabled={busy !== null}
            onPress={() => void save()}
          />
          {s.enabled ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.barNote}>
              Орендар отримає повідомлення в чаті
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function Bubble({ icon, tone }: { icon: IconName; tone: 'accent' | 'neutral' }) {
  const theme = useTheme();
  return (
    <View style={[styles.bubble, { backgroundColor: tone === 'accent' ? theme.accentSoft : theme.backgroundSelected }]}>
      <Icon name={icon} size={22} color={tone === 'accent' ? 'accent' : 'textSecondary'} />
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
      {children.toUpperCase()}
    </ThemedText>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

function ItemRow({
  icon,
  title,
  subtitle,
  value,
  disabled,
  locked,
  onChange,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  locked?: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.item}>
      <Bubble icon={icon} tone={value ? 'accent' : 'neutral'} />
      <View style={styles.flex}>
        <ThemedText type="default" style={styles.itemTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      {locked ? (
        <View style={styles.locked}>
          <Icon name="lock-closed" size={14} color="textSecondary" />
          <ThemedText type="small" themeColor="textSecondary">
            Завжди
          </ThemedText>
        </View>
      ) : (
        <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: theme.accent }} />
      )}
    </View>
  );
}

function ReportCard({ report, onOpen }: { report: CheckinReport; onOpen: (index: number) => void }) {
  const theme = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <ThemedText type="headline">Звіт за {formatDate(report.due)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Надіслано {stamp(report.at)}
          </ThemedText>
        </View>
        <View style={styles.km}>
          <ThemedText type="headline">{formatKm(report.km)}</ThemedText>
          {report.deltaKm !== null && report.deltaKm >= 0 ? (
            <ThemedText type="smallBold" themeColor="positive">
              +{formatKm(report.deltaKm)}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {report.photos.map((p, i) => (
          <Pressable
            key={p.slot}
            accessibilityRole="button"
            accessibilityLabel={`${p.label}: відкрити фото`}
            onPress={() => onOpen(i)}
            style={[styles.thumb, { borderColor: theme.border }]}
          >
            <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.thumbLabel}>
              <ThemedText type="small" style={styles.thumbText} numberOfLines={1}>
                {p.label}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  masterCard: { gap: 0, paddingVertical: Spacing.three },
  bubble: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { marginBottom: -Spacing.two, paddingHorizontal: Spacing.one, letterSpacing: 0.6 },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: { flex: 1, aspectRatio: 1, maxWidth: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 0, paddingVertical: Spacing.one },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  itemTitle: { fontWeight: 600 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: Spacing.one },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 44 + Spacing.three },
  footnote: { paddingHorizontal: Spacing.one, marginTop: -Spacing.two },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barNote: { textAlign: 'center' },
  card: { gap: Spacing.three },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  group: { gap: Spacing.two },
  km: { alignItems: 'flex-end' },
  strip: { gap: Spacing.two },
  thumb: { width: 104, height: 78, borderRadius: Radius.sm, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, justifyContent: 'flex-end' },
  thumbLabel: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2 },
  thumbText: { color: '#FFFFFF', fontSize: 11 },
});
