import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Field } from './ui/field';
import { Icon } from './ui/icon';

type CodeSent = { email: string; expiresInMinutes: number; resendInSeconds: number };

/**
 * Підписання договору кодом з пошти: спершу згода з умовами й надсилання коду, потім введення шести цифр.
 * Це простий електронний підпис; докази (час, пошта, пристрій) сервер зберігає разом із підписом.
 */
export function SignSheet({ visible, dealId, number, onClose, onSigned }: { visible: boolean; dealId: string; number: string; onClose: () => void; onSigned: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState(false);
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState<'send' | 'sign' | null>(null);
  const [error, setError] = useState('');

  // Лічильник до можливості надіслати код ще раз
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  function close() {
    if (busy) return;
    setAgreed(false);
    setSent(null);
    setCode('');
    setError('');
    setWait(0);
    onClose();
  }

  async function send() {
    setBusy('send');
    setError('');
    try {
      const res = await api<CodeSent>('POST', `/deals/${dealId}/sign/code`, {});
      setSent(res);
      setWait(res.resendInSeconds);
      setCode('');
    } catch (e) {
      // «Код уже надіслано» не помилка для користувача: показуємо поле введення, а таймер піде з відповіді сервера
      const message = e instanceof ApiError ? e.message : 'Спробуйте ще раз';
      setError(message);
    } finally {
      setBusy(null);
    }
  }

  async function sign() {
    setBusy('sign');
    setError('');
    try {
      await api('POST', `/deals/${dealId}/sign`, { code });
      setAgreed(false);
      setSent(null);
      setCode('');
      onSigned();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не вдалося підписати. Спробуйте ще раз');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]} onPress={() => {}}>
            <ThemedText type="default" style={styles.heading}>
              Підписання договору № {number}
            </ThemedText>

            {!sent ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Ви підписуєте договір простим електронним підписом: підтверджуєте його кодом, який ми надішлемо на вашу електронну пошту. Підписуйте під час зустрічі, коли власник передає авто й ключі, а орендар — гроші.
                </ThemedText>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed(!agreed)} style={styles.agree}>
                  <View style={[styles.box, { borderColor: agreed ? theme.accent : theme.borderStrong, backgroundColor: agreed ? theme.accent : 'transparent' }]}>
                    {agreed ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : null}
                  </View>
                  <ThemedText type="small" style={styles.flex}>
                    Я прочитав(ла) договір, погоджуюсь з його умовами й визнаю підпис кодом з пошти.
                  </ThemedText>
                </Pressable>
                {error ? (
                  <ThemedText type="small" themeColor="negative">
                    {error}
                  </ThemedText>
                ) : null}
                <Button title={busy === 'send' ? 'Надсилаємо…' : 'Надіслати код на пошту'} icon="mail-outline" disabled={!agreed || busy !== null} onPress={() => void send()} />
              </>
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Код надіслано на {sent.email}. Він дійсний {sent.expiresInMinutes} хв. Перевірте також «Спам».
                </ThemedText>
                <Field
                  label="Код з листа"
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  autoFocus
                  error={error || undefined}
                  style={styles.codeInput}
                />
                <Button title={busy === 'sign' ? 'Підписуємо…' : 'Підписати договір'} icon="create-outline" disabled={code.length !== 6 || busy !== null} onPress={() => void sign()} />
                <Button
                  title={wait > 0 ? `Надіслати код ще раз (${wait} с)` : 'Надіслати код ще раз'}
                  variant="soft"
                  disabled={wait > 0 || busy !== null}
                  onPress={() => void send()}
                />
              </>
            )}

            <Pressable accessibilityRole="button" onPress={close} style={styles.cancel}>
              <ThemedText type="default" themeColor="textSecondary">
                Скасувати
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.three },
  heading: { fontWeight: 700, fontSize: 18 },
  agree: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  flex: { flex: 1 },
  codeInput: { fontSize: 28, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
