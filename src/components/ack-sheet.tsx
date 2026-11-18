import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

/**
 * Підтвердження умов оренди без договору: пояснення, що це означає, галочка «Розумію» і кнопка. Без коду з пошти:
 * згоду фіксуємо з датою й часом, а оренда починається, коли підтвердили обидві сторони.
 */
export function AckSheet({ dealId, visible, onClose, onDone }: { dealId: string; visible: boolean; onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!agreed || busy) return;
    setBusy(true);
    try {
      await api('POST', `/deals/${dealId}/acknowledge`);
      setBusy(false);
      setAgreed(false);
      onDone();
    } catch (e) {
      setBusy(false);
      Alert.alert('Не вдалося підтвердити', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]} onPress={() => {}}>
          <ThemedText type="default" style={styles.heading}>
            Оренда без договору
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Договір не складається. Kolo лише веде облік: графік платежів, заставу й чат. У разі спору підтверджень у застосунку може бути недостатньо, а розірвати оренду можна лише за згодою обох сторін. Підтверджуйте під час зустрічі, коли передаєте авто, ключі й гроші.
          </ThemedText>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed(!agreed)} style={styles.agree}>
            <View style={[styles.box, { borderColor: agreed ? theme.accent : theme.borderStrong, backgroundColor: agreed ? theme.accent : 'transparent' }]}>
              {agreed ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : null}
            </View>
            <ThemedText type="small" style={styles.flex}>
              Розумію, що оренда без договору, і погоджуюсь із цим.
            </ThemedText>
          </Pressable>
          <Button title={busy ? 'Підтверджуємо…' : 'Підтвердити умови'} icon="checkmark-circle-outline" disabled={!agreed || busy} onPress={() => void submit()} />
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
  agree: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
