import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { LEGAL_CONTACT } from '@/lib/legal';
import { REPORT_REASONS, sendReport, type ReportReason, type ReportTarget } from '@/lib/moderation';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

const TITLES = { listing: 'Поскаржитись на оголошення', user: 'Поскаржитись на користувача', message: 'Поскаржитись на повідомлення' } as const;

/** Нижній лист скарги: причина й необов'язковий коментар. Скарги розглядаються протягом 24 годин */
export function ReportSheet({ target, onClose, onSent }: { target: ReportTarget | null; onClose: () => void; /** Скаргу прийнято */ onSent?: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setReason(null);
    setNote('');
    onClose();
  }

  async function submit() {
    if (!target || !reason || busy) return;
    setBusy(true);
    try {
      await sendReport(target, reason, note);
      setBusy(false);
      setReason(null);
      setNote('');
      onClose();
      Alert.alert('Скаргу надіслано', `Дякуємо. Ми розглянемо її протягом 24 годин. Питання: ${LEGAL_CONTACT}`);
      onSent?.();
    } catch (e) {
      setBusy(false);
      Alert.alert('Не вдалося надіслати', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    }
  }

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]} onPress={() => {}}>
            <ThemedText type="default" style={styles.heading}>
              {target ? TITLES[target.kind] : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Оберіть причину. Скарга потрапить до модератора, обидві сторони лишаться анонімними одна для одної.
            </ThemedText>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {REPORT_REASONS.map((r, i) => (
                <Pressable
                  key={r.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reason === r.value }}
                  onPress={() => setReason(r.value)}
                  style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
                  <View style={styles.flex}>
                    <ThemedText type="default" style={styles.title}>
                      {r.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {r.hint}
                    </ThemedText>
                  </View>
                  <Icon name={reason === r.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={reason === r.value ? 'accent' : 'textSecondary'} />
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Коментар (необов’язково)"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              style={[styles.note, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
            />
            <Button title={busy ? 'Надсилаємо…' : 'Надіслати скаргу'} icon="flag-outline" disabled={!reason || busy} onPress={() => void submit()} />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.two },
  heading: { fontWeight: 700, fontSize: 18 },
  list: { maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two + 2 },
  flex: { flex: 1 },
  title: { fontWeight: 600 },
  note: { minHeight: 64, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, textAlignVertical: 'top', fontSize: 16 },
});
