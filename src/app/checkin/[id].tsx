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
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { type CheckinReport, type CheckinSettings, type CheckinView, dueText, errorText, EVERY_OPTIONS, remindCheckin, saveCheckinSettings, WEEKDAY_OPTIONS } from '@/lib/checkin';
import { daysUntil, formatDate } from '@/lib/date';
import { formatKm } from '@/lib/format';

const stamp = (iso: string) => `${formatDate(iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
const EVERY_LABELS = EVERY_OPTIONS.map((o) => o.label);
const WEEKDAY_LABELS = WEEKDAY_OPTIONS.map((o) => o.label);

/**
 * Регулярний фотозвіт орендаря про авто. Власник вмикає його й обирає, що показувати (панель приладів із пробігом завжди,
 * кузов і салон за бажанням); орендар надсилає звіт камерою, а обидва бачать історію звітів із пробігом за кожен період.
 */
export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
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
    <Screen>
      <Stack.Screen options={{ title: 'Звіти про авто', headerBackTitle: 'Назад' }} />

      {owner ? (
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <ThemedText type="headline">Вимагати звіт від орендаря</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Орендар сам знімає авто в застосунку й надсилає фото та пробіг
              </ThemedText>
            </View>
            <Switch value={s.enabled} disabled={!data.canConfigure} onValueChange={(enabled) => patch({ enabled })} trackColor={{ true: theme.accent }} />
          </View>

          {s.enabled ? (
            <>
              <View style={styles.group}>
                <ThemedText type="smallBold">Як часто</ThemedText>
                <Segmented options={EVERY_LABELS} value={EVERY_OPTIONS.find((o) => o.value === s.every)!.label} onChange={(l) => patch({ every: EVERY_OPTIONS.find((o) => o.label === l)!.value })} scroll />
              </View>
              {s.every !== 'monthly' ? (
                <View style={styles.group}>
                  <ThemedText type="smallBold">У який день</ThemedText>
                  <Segmented options={WEEKDAY_LABELS} value={WEEKDAY_OPTIONS.find((o) => o.value === s.weekday)!.label} onChange={(l) => patch({ weekday: WEEKDAY_OPTIONS.find((o) => o.label === l)!.value })} scroll />
                </View>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Звіт щомісяця в той самий день, коли почалась оренда.
                </ThemedText>
              )}

              <View style={styles.group}>
                <ThemedText type="smallBold">Що сфотографувати</ThemedText>
                <ItemRow title="Панель приладів" subtitle="Пробіг, паливо, помилки. Завжди входить у звіт" value disabled onChange={() => {}} />
                <ItemRow title="Кузов з усіх боків" subtitle="4 фото: спереду, ззаду, зліва, справа" value={s.body} disabled={!data.canConfigure} onChange={(body) => patch({ body })} />
                <ItemRow title="Салон" subtitle="Передні й задні сидіння" value={s.interior} disabled={!data.canConfigure} onChange={(interior) => patch({ interior })} />
              </View>
            </>
          ) : null}

          {dirty ? (
            <Button title={busy === 'save' ? 'Зберігаємо…' : s.enabled ? 'Зберегти' : 'Вимкнути звіт'} loading={busy === 'save'} disabled={busy !== null} onPress={() => void save()} />
          ) : null}
          {dirty && s.enabled ? (
            <ThemedText type="small" themeColor="textSecondary">
              Орендар отримає про це повідомлення в чаті.
            </ThemedText>
          ) : null}
        </Card>
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
            <Icon name={state === 'overdue' ? 'alert-circle' : state === 'open' ? 'camera' : 'calendar-outline'} size={34} color={state === 'overdue' ? 'negative' : state === 'open' ? 'warning' : 'textSecondary'} />
          </View>
          {!owner && data.canSubmit ? <Button title="Зробити звіт" icon="camera-outline" onPress={() => router.push({ pathname: '/checkin/report', params: { dealId: String(id) } })} /> : null}
          {owner && data.canRemind ? <Button title="Нагадати орендарю" icon="notifications-outline" variant="secondary" loading={busy === 'remind'} disabled={busy !== null} onPress={() => void remind()} /> : null}
        </Card>
      ) : null}

      {!owner && !data.settings.enabled ? <EmptyState icon="camera-outline" title="Звіт не вимагається" text="Власник не просить регулярних звітів про авто. Якщо попросить, ви отримаєте повідомлення в чаті." /> : null}

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
  );
}

function ItemRow({ title, subtitle, value, disabled, onChange }: { title: string; subtitle: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.rowBetween}>
      <View style={styles.flex}>
        <ThemedText type="default">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: theme.accent }} />
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
          <Pressable key={p.slot} accessibilityRole="button" accessibilityLabel={`${p.label}: відкрити фото`} onPress={() => onOpen(i)} style={[styles.thumb, { borderColor: theme.border }]}>
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
  card: { gap: Spacing.three },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  group: { gap: Spacing.two },
  km: { alignItems: 'flex-end' },
  strip: { gap: Spacing.two },
  thumb: { width: 104, height: 78, borderRadius: Radius.sm, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, justifyContent: 'flex-end' },
  thumbLabel: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2 },
  thumbText: { color: '#FFFFFF', fontSize: 11 },
});
