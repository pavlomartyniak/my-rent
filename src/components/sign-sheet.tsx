import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { haptic } from '@/lib/haptics';

import { ThemedText } from './themed-text';
import { BottomSheet } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

/**
 * Підписання договору: згода з умовами й одна кнопка «Підписати договір». Без коду з пошти. Це простий електронний підпис:
 * підтвердження в застосунку, а докази (час, пошта, пристрій) сервер зберігає разом із підписом.
 */
export function SignSheet({ visible, dealId, number, onClose, onSigned }: { visible: boolean; dealId: string; number: string; onClose: () => void; onSigned: () => void }) {
  const theme = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function close() {
    if (busy) return;
    setAgreed(false);
    setError('');
    onClose();
  }

  async function sign() {
    setBusy(true);
    setError('');
    try {
      await api('POST', `/deals/${dealId}/sign`, {});
      haptic.success();
      setAgreed(false);
      onSigned();
    } catch (e) {
      haptic.error();
      setError(e instanceof ApiError ? e.message : 'Не вдалося підписати. Спробуйте ще раз');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={close} locked={busy}>
      <ThemedText style={styles.heading} accessibilityRole="header">
        Підписання договору № {number}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary">
        Ви підписуєте договір простим електронним підписом: підтверджуєте його в застосунку. Час підпису, адресу пошти й пристрій ми збережемо як підтвердження.
      </ThemedText>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed(!agreed)} style={styles.agree}>
        <View style={[styles.box, { borderColor: agreed ? theme.accent : theme.borderStrong, backgroundColor: agreed ? theme.accent : 'transparent' }]}>
          {agreed ? <Icon name="checkmark" size={16} color={theme.onAccent} /> : null}
        </View>
        <ThemedText type="callout" style={styles.flex}>
          Я прочитав(ла) договір, погоджуюсь з його умовами й визнаю підпис у застосунку.
        </ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="callout" themeColor="negative">
          {error}
        </ThemedText>
      ) : null}
      <Button title="Підписати договір" icon="create-outline" loading={busy} disabled={!agreed} disabledReason={!agreed ? 'Спершу підтвердьте, що прочитали договір' : undefined} onPress={() => void sign()} />
      <Button title="Скасувати" variant="tertiary" disabled={busy} onPress={close} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  heading: { ...Type.headline },
  agree: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  flex: { flex: 1 },
});
