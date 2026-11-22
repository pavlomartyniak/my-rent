import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { UploadBar, UploadRing } from '@/components/upload-progress';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { NumberField } from '@/components/ui/number-field';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { type CheckinView, errorText, SLOT_HINTS, submitCheckin, takeFreshPhoto, uploadCheckinPhotos } from '@/lib/checkin';
import { formatKm } from '@/lib/format';
import { haptic } from '@/lib/haptics';

/**
 * Звіт про авто: плитки для кожного потрібного фото (лише камера), пробіг і одна кнопка «Надіслати». Плитки заповнюються по черзі,
 * а під час відправки на кожній видно кільце прогресу.
 */
export default function CheckinReportScreen() {
  const { dealId } = useLocalSearchParams<{ dealId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { data, loading, error, retry } = useReport<CheckinView>(`/checkin/${dealId}`, { useCache: false });
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [km, setKm] = useState('');
  const [sent, setSent] = useState<Record<string, number> | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Звіт про авто', headerBackTitle: 'Назад' }} />
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      </Screen>
    );
  }

  const sending = sent !== null;
  const have = data.slots.filter((s) => photos[s.id]).length;
  const prev = data.lastKm;
  const kmNumber = Number(km);
  const kmError = !km ? 'Вкажіть пробіг' : prev !== null && kmNumber < prev ? `Не менше за попередній: ${formatKm(prev)}` : '';
  const ready = have === data.slots.length && !kmError;

  async function shoot(slot: string) {
    if (sending) return;
    const uri = await takeFreshPhoto();
    if (uri) {
      haptic.tap();
      setPhotos((p) => ({ ...p, [slot]: uri }));
    }
  }

  async function send() {
    setSubmitted(true);
    if (!ready || sending) return;
    setSent(Object.fromEntries(data!.slots.map((s) => [s.id, 0])));
    try {
      const items = data!.slots.map((s) => ({ slot: s.id, uri: photos[s.id]! }));
      const uploaded = await uploadCheckinPhotos(String(dealId), items, (i, f) => setSent((cur) => (cur ? { ...cur, [items[i]!.slot]: f } : cur)));
      await submitCheckin(String(dealId), uploaded, kmNumber);
      haptic.success();
      router.back();
    } catch (e) {
      Alert.alert('Не вдалося надіслати звіт', errorText(e));
      setSent(null);
    }
  }

  const total = sent ? Object.values(sent).reduce((a, b) => a + b, 0) / data.slots.length : 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Звіт про авто', headerBackTitle: 'Назад' }} />
      <ThemedText type="small" themeColor="textSecondary">
        {data.title}. Знімайте зараз, на камеру: звіт показує, який стан авто сьогодні. Готово {have} з {data.slots.length}.
      </ThemedText>

      <View style={styles.grid}>
        {data.slots.map((s) => {
          const uri = photos[s.id];
          const progress = sent?.[s.id];
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={uri ? `${s.label}: перезняти` : `${s.label}: зробити фото`}
              disabled={sending}
              onPress={() => void shoot(s.id)}
              style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: uri ? theme.positive : submitted ? theme.warning : theme.border }]}>
              {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {!uri ? (
                <View style={styles.empty}>
                  <Icon name="camera-outline" size={28} color="textSecondary" />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.hint} numberOfLines={3}>
                    {SLOT_HINTS[s.id] ?? s.label}
                  </ThemedText>
                </View>
              ) : null}
              <View style={[styles.label, { backgroundColor: uri ? 'rgba(0,0,0,0.55)' : 'transparent' }]}>
                <ThemedText type="small" style={{ color: uri ? '#FFFFFF' : theme.text, fontWeight: 600 }} numberOfLines={1}>
                  {s.label}
                </ThemedText>
              </View>
              {uri && !sending ? (
                <View style={[styles.check, { backgroundColor: theme.positive }]}>
                  <Icon name="checkmark" size={14} color="#FFFFFF" />
                </View>
              ) : null}
              {progress !== undefined ? (
                <View style={styles.ring} pointerEvents="none">
                  <UploadRing progress={progress} size={44} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <NumberField label="Пробіг, км" value={km} onChangeValue={setKm} maxDigits={7} placeholder={prev !== null ? `Не менше ${prev}` : 'З одометра'} error={submitted ? kmError : undefined} editable={!sending} />
      {prev !== null ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.prev}>
          Минулий пробіг: {formatKm(prev)}
        </ThemedText>
      ) : null}

      {sending ? <UploadBar progress={total} label="Надсилаємо звіт" /> : null}
      <Button title={sending ? 'Надсилаємо…' : 'Надіслати звіт'} icon="paper-plane-outline" loading={sending} disabled={sending || (submitted && !ready)} onPress={() => void send()} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Після відправки власник отримає повідомлення в чаті.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { width: '48.5%', aspectRatio: 4 / 3, borderRadius: Radius.md, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'flex-end' },
  empty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: Spacing.two, gap: 4 },
  hint: { textAlign: 'center', fontSize: 11, lineHeight: 14 },
  label: { paddingHorizontal: 8, paddingVertical: 6 },
  check: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ring: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  prev: { marginTop: -Spacing.two },
  note: { textAlign: 'center' },
});
