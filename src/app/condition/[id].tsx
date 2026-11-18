import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoViewer } from '@/components/photo-viewer';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { NumberField } from '@/components/ui/number-field';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { type ConditionPhoto, type ConditionView, type Phase, removePhoto, saveOdometer, savePhoto, takePhoto, uploadConditionPhoto } from '@/lib/condition';
import { formatDate } from '@/lib/date';
import { thumbnailUrl } from '@/lib/media';
import { useFleet } from '@/store/fleet';

const PHASES = ['При передачі', 'При поверненні'] as const;
const stamp = (iso: string) => `${formatDate(iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;

/**
 * Стан авто: спільні фото кузова й салону та показник одометра. При передачі це обов'язковий крок до початку оренди: поки не
 * додано всі фото, договір (чи підтвердження умов) підписати не можна. Фото лише з камери, час ставить сервер, а обидві сторони
 * бачать усе: так нюанси фіксуються з самого початку, і суперечок потім менше. Поверненню відведено окремий необов'язковий розділ.
 */
export default function ConditionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { invalidate } = useFleet();
  const { data, loading, error, retry } = useReport<ConditionView>(`/condition/${id}`, { useCache: false, refetchOnFocus: true });
  const [phaseLabel, setPhaseLabel] = useState<(typeof PHASES)[number]>(PHASES[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);
  const [km, setKm] = useState('');
  const [damage, setDamage] = useState<{ uri: string } | null>(null);
  const [note, setNote] = useState('');

  const phase: Phase = phaseLabel === PHASES[0] ? 'handover' : 'return';

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Стан авто', headerBackTitle: 'Назад' }} />
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      </Screen>
    );
  }

  const report = phase === 'handover' ? data.handover : data.return;
  const canEdit = phase === 'handover' ? data.handover.canEdit : data.return.canEdit;
  const canDamage = phase === 'handover' ? data.handover.canAddDamage : data.return.canEdit;
  const required = data.slots.filter((s) => s.required);
  const have = phase === 'handover' ? required.length - data.handover.missing.length : 0;
  const bySlot = new Map(report.photos.filter((p) => p.slot !== 'damage').map((p) => [p.slot, p]));
  const damages = report.photos.filter((p) => p.slot === 'damage');
  const slotsToShow = phase === 'handover' ? data.slots : data.slots.map((s) => ({ ...s, required: false }));

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
      invalidate();
      retry();
    } catch (e) {
      Alert.alert('Не вдалося', e instanceof ApiError || e instanceof Error ? e.message : 'Спробуйте ще раз');
      retry();
    } finally {
      setBusy(null);
    }
  }

  async function capture(slot: string) {
    const uri = await takePhoto();
    if (!uri) return;
    await run(slot, async () => savePhoto(String(id), phase, { slot, url: await uploadConditionPhoto(String(id), uri) }));
  }

  function openPhoto(p: ConditionPhoto, all: ConditionPhoto[]) {
    const actions: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: 'Переглянути', onPress: () => setViewer({ urls: all.map((x) => x.url), index: all.findIndex((x) => x.id === p.id) }) }];
    if (p.byMe && (canEdit || (p.slot === 'damage' && canDamage))) {
      if (p.slot !== 'damage') actions.push({ text: 'Зробити нове фото', onPress: () => void capture(p.slot) });
      actions.push({ text: 'Видалити', style: 'destructive', onPress: () => void run(p.id, () => removePhoto(String(id), phase, p.id)) });
    }
    actions.push({ text: 'Закрити', style: 'cancel' });
    Alert.alert(p.label, `${p.by === 'owner' ? 'Додав власник' : 'Додав орендар'}, ${stamp(p.at)}${p.note ? `\n${p.note}` : ''}`, actions);
  }

  async function addDamage() {
    const uri = await takePhoto();
    if (uri) {
      setNote('');
      setDamage({ uri });
    }
  }

  async function submitDamage() {
    if (!damage || !note.trim()) return;
    const { uri } = damage;
    setDamage(null);
    await run('damage', async () => savePhoto(String(id), phase, { slot: 'damage', url: await uploadConditionPhoto(String(id), uri), note: note.trim() }));
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Стан авто', headerBackTitle: 'Назад' }} />
      <Segmented options={PHASES} value={phaseLabel} onChange={setPhaseLabel} />

      <Card style={styles.info}>
        <Icon name="shield-checkmark-outline" size={22} color="accent" />
        <View style={styles.flex}>
          {phase === 'handover' ? (
            <>
              <ThemedText type="smallBold">{data.handover.ready ? 'Стан авто зафіксовано' : `Обов’язково: ${have} з ${required.length} фото й показник одометра`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Сфотографуйте кузов з чотирьох боків і салон, коли авто передається. Фото лише з камери, час ставить сервер, обидві сторони бачать їх. Без цього оренду не почати.
              </ThemedText>
            </>
          ) : (
            <>
              <ThemedText type="smallBold">{canEdit ? 'Зафіксуйте стан авто при поверненні' : 'Фіксація при поверненні'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {canEdit ? 'Це необов’язково, але допоможе порівняти авто з тим, яким воно було на початку оренди.' : 'Відкривається за добу до завершення оренди і триває 14 днів після неї.'}
              </ThemedText>
            </>
          )}
        </View>
      </Card>

      <SectionHeader title="Кузов і салон" />
      <View style={styles.grid}>
        {slotsToShow.map((s) => {
          const p = bySlot.get(s.id);
          const working = busy === s.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={p ? `${s.label}: фото додано` : `${s.label}: зробити фото`}
              disabled={working || (!p && !canEdit)}
              onPress={() => (p ? openPhoto(p, [...bySlot.values()]) : void capture(s.id))}
              style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: p ? theme.positive : s.required && phase === 'handover' ? theme.warning : theme.border }]}>
              {p ? <Image source={{ uri: thumbnailUrl(p.url, 500) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {!p ? (
                <View style={styles.empty}>
                  {working ? <ActivityIndicator /> : <Icon name={canEdit ? 'camera-outline' : 'image-outline'} size={26} color="textSecondary" />}
                </View>
              ) : null}
              <View style={[styles.label, { backgroundColor: p ? 'rgba(0,0,0,0.55)' : 'transparent' }]}>
                <ThemedText type="small" style={{ color: p ? '#FFFFFF' : theme.text, fontWeight: 600 }} numberOfLines={2}>
                  {s.label}
                  {s.required && !p ? ' *' : ''}
                </ThemedText>
                {p ? (
                  <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                    {p.by === 'owner' ? 'Власник' : 'Орендар'} · {stamp(p.at)}
                  </ThemedText>
                ) : null}
              </View>
              {working && p ? (
                <View style={[StyleSheet.absoluteFill, styles.empty, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                  <ActivityIndicator />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Показник одометра" />
      <Card style={styles.odo}>
        {report.odometer ? (
          <ThemedText type="default" style={{ fontWeight: 600 }}>
            {report.odometer.km.toLocaleString('uk-UA')} км · {report.odometer.by === 'owner' ? 'вказав власник' : 'вказав орендар'}, {stamp(report.odometer.at)}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {phase === 'handover' ? 'Вкажіть пробіг з панелі приладів: це обов’язково.' : 'Вкажіть пробіг при поверненні.'}
          </ThemedText>
        )}
        {canEdit && (!report.odometer || report.odometer.byMe) ? (
          <>
            <NumberField label="Пробіг, км" value={km} onChangeValue={setKm} maxDigits={7} placeholder={report.odometer ? String(report.odometer.km) : '120 000'} />
            <Button title={busy === 'odo' ? 'Зберігаємо…' : report.odometer ? 'Змінити показник' : 'Зберегти показник'} variant="secondary" disabled={!km || busy === 'odo'} onPress={() => void run('odo', async () => { await saveOdometer(String(id), phase, Number(km)); setKm(''); })} />
          </>
        ) : null}
      </Card>

      <SectionHeader title={damages.length ? `Пошкодження й зауваження · ${damages.length}` : 'Пошкодження й зауваження'} />
      {damages.map((d) => (
        <Pressable key={d.id} accessibilityRole="button" onPress={() => openPhoto(d, damages)}>
          <Card style={styles.damage}>
            <Image source={{ uri: thumbnailUrl(d.url, 300) }} style={styles.damagePhoto} contentFit="cover" />
            <View style={styles.flex}>
              <ThemedText type="default" style={{ fontWeight: 600 }}>
                {d.note}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {d.by === 'owner' ? 'Власник' : 'Орендар'} · {stamp(d.at)}
              </ThemedText>
            </View>
          </Card>
        </Pressable>
      ))}
      {!damages.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {phase === 'handover' ? 'Подряпини, вм’ятини, плями в салоні: сфотографуйте й опишіть їх тут, щоб потім не було суперечок.' : 'Тут будуть нові пошкодження, помічені при поверненні.'}
        </ThemedText>
      ) : null}
      {canDamage ? <Button title={busy === 'damage' ? 'Завантажуємо…' : 'Додати пошкодження'} icon="alert-circle-outline" variant="secondary" disabled={busy !== null} onPress={() => void addDamage()} /> : null}
      {phase === 'handover' && !data.handover.canEdit && data.handover.canAddDamage ? (
        <ThemedText type="small" themeColor="textSecondary">
          Оренда вже почалась: фото при передачі заморожені, а нові пошкодження можна додати ще протягом двох діб після початку.
        </ThemedText>
      ) : null}

      <DamageModal visible={!!damage} note={note} onNote={setNote} onCancel={() => setDamage(null)} onSubmit={() => void submitDamage()} />
      {viewer ? <PhotoViewer photos={viewer.urls} startIndex={viewer.index} onClose={() => setViewer(null)} /> : null}
    </Screen>
  );
}

/** Опис пошкодження перед завантаженням фото */
function DamageModal({ visible, note, onNote, onCancel, onSubmit }: { visible: boolean; note: string; onNote: (v: string) => void; onCancel: () => void; onSubmit: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]} onPress={() => {}}>
          <ThemedText type="default" style={{ ...Type.headline }}>
            Опишіть пошкодження
          </ThemedText>
          <Field label="Що й де" value={note} onChangeText={onNote} multiline maxLength={300} placeholder="Подряпина на передньому лівому крилі, ~10 см" style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }} autoFocus />
          <Button title="Додати" disabled={!note.trim()} onPress={onSubmit} />
          <Pressable accessibilityRole="button" onPress={onCancel} style={{ alignItems: 'center', paddingVertical: Spacing.two }}>
            <ThemedText type="default" themeColor="textSecondary">
              Скасувати
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  info: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { width: '48.5%', aspectRatio: 4 / 3, borderRadius: Radius.md, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'flex-end' },
  empty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  label: { paddingHorizontal: 8, paddingVertical: 6 },
  odo: { gap: Spacing.three },
  damage: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  damagePhoto: { width: 64, height: 64, borderRadius: Radius.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.four, gap: Spacing.three },
});
