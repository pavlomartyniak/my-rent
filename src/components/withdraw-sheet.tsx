import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { OWNER_GROUNDS, RENTER_GROUNDS, type WithdrawGround } from '@/lib/contract';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

/**
 * Нижній лист «Відмовитися від договору» для власника: підстава з переліку й коментар. Орендар отримує повідомлення
 * в застосунку та на пошту; дату отримання зафіксовано в журналі договору.
 */
export function WithdrawSheet({ visible, dealId, role, onClose, onDone }: { visible: boolean; dealId: string; role: 'owner' | 'renter'; onClose: () => void; onDone: () => void }) {
  const grounds = role === 'owner' ? OWNER_GROUNDS : RENTER_GROUNDS;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [ground, setGround] = useState<WithdrawGround | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setGround(null);
    setNote('');
    onClose();
  }

  function confirm() {
    if (!ground || busy) return;
    Alert.alert('Відмовитись від договору?', 'Друга сторона отримає повідомлення. Договір буде розірвано через 12 годин після того, як вона його отримає; до цього він діє. Скасувати відмову не можна. Розрахунки за фактичний строк користування лишаються.', [
      { text: 'Ні', style: 'cancel' },
      { text: 'Відмовитись', style: 'destructive', onPress: () => void submit() },
    ]);
  }

  async function submit() {
    setBusy(true);
    try {
      await api('POST', `/deals/${dealId}/withdraw`, { ground, note: note.trim() || undefined });
      setBusy(false);
      setGround(null);
      setNote('');
      onDone();
    } catch (e) {
      setBusy(false);
      Alert.alert('Не вдалося відмовитись', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]} onPress={() => {}}>
            <ThemedText type="default" style={styles.heading}>
              Відмова від договору
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Оберіть підставу з договору (розд. 9). Прострочку оплати застосунок перевіряє за графіком платежів.
            </ThemedText>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {grounds.map((g, i) => (
                <Pressable
                  key={g.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ground === g.value }}
                  onPress={() => setGround(g.value)}
                  style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
                  <View style={styles.flex}>
                    <ThemedText type="default" style={styles.title}>
                      {g.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {g.hint}
                    </ThemedText>
                  </View>
                  <Icon name={ground === g.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={ground === g.value ? 'accent' : 'textSecondary'} />
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Коментар для другої сторони (необов’язково)"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              style={[styles.note, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
            />
            <Button title={busy ? 'Надсилаємо…' : 'Відмовитись від договору'} icon="close-circle-outline" variant="danger" disabled={!ground || busy} onPress={confirm} />
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
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two + 2 },
  flex: { flex: 1 },
  title: { fontWeight: 600 },
  note: { minHeight: 64, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, textAlignVertical: 'top', fontSize: 16 },
});
