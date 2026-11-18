import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import type { ReviewState } from '@/lib/profiles';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

/** Нижній лист оцінки: зірки й теги з фіксованого списку (вільного тексту немає). Оцінку не можна змінити. */
export function ReviewSheet({ dealId, state, visible, onClose, onDone }: { dealId: string; state: ReviewState; visible: boolean; onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  async function submit() {
    if (!rating || busy) return;
    setBusy(true);
    try {
      await api('POST', '/reviews', { dealId, rating, tags });
      setBusy(false);
      setRating(0);
      setTags([]);
      onDone();
    } catch (e) {
      setBusy(false);
      Alert.alert('Не вдалося надіслати оцінку', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]} onPress={() => {}}>
          <ThemedText type="default" style={styles.heading}>
            Оцінка: {state.target.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Оцінку побачать усі в профілі. Змінити її потім не можна.
          </ThemedText>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${i} з 5`} hitSlop={6} onPress={() => setRating(i)}>
                <Icon name={i <= rating ? 'star' : 'star-outline'} size={40} color="#F5A623" />
              </Pressable>
            ))}
          </View>

          <ThemedText type="smallBold" themeColor="textSecondary">
            Що було добре (необов’язково)
          </ThemedText>
          <View style={styles.tags}>
            {state.tags.map((t) => {
              const on = tags.includes(t);
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => toggle(t)}
                  style={[styles.tag, { backgroundColor: on ? theme.accentSoft : theme.backgroundSelected, borderColor: on ? theme.accent : 'transparent' }]}>
                  <ThemedText type="small" themeColor={on ? 'accent' : 'text'} style={{ fontWeight: 600 }}>
                    {t}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Button title={busy ? 'Надсилаємо…' : 'Надіслати оцінку'} disabled={!rating || busy} onPress={() => void submit()} />
          <Pressable accessibilityRole="button" onPress={onClose} disabled={busy} style={styles.cancel}>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.four, gap: Spacing.three },
  heading: { fontWeight: 700, fontSize: 18 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
