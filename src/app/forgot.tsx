import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';

/** Відновлення пароля: email → код із листа → новий пароль. Після успіху користувач одразу входить. */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validEmail = /\S+@\S+\.\S+/.test(email);

  async function sendCode() {
    if (!validEmail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/auth/forgot', { email: email.trim() });
      setStep('code');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не вдалося надіслати код. Спробуйте ще раз.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await resetPassword(email, code, password);
    setBusy(false);
    if (message) setError(message);
    else Alert.alert('Пароль змінено', 'Ви увійшли з новим паролем.');
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Відновлення пароля' }} />

      {step === 'email' ? (
        <>
          <ThemedText type="default" themeColor="textSecondary">
            Вкажіть email акаунта. Ми надішлемо 6-значний код, дійсний 15 хвилин.
          </ThemedText>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="name@example.com" onSubmitEditing={sendCode} />
          {error ? (
            <ThemedText type="small" themeColor="negative" accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}
          <Button title={busy ? 'Надсилаємо…' : 'Надіслати код'} disabled={!validEmail || busy} onPress={sendCode} />
        </>
      ) : (
        <>
          <ThemedText type="default" themeColor="textSecondary">
            Якщо акаунт із адресою {email.trim()} існує, ми надіслали на неї код. Перевірте також «Спам».
          </ThemedText>
          <Field label="Код із листа" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="123456" autoComplete="one-time-code" />
          <Field label="Новий пароль (мінімум 8 символів)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} />
          {error ? (
            <ThemedText type="small" themeColor="negative" accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}
          <Button title={busy ? 'Зачекайте…' : 'Змінити пароль'} disabled={code.length !== 6 || password.length < 8 || busy} onPress={submit} />
          <View style={styles.row}>
            <Button title="Надіслати код ще раз" variant="soft" style={styles.flex} disabled={busy} onPress={sendCode} />
            <Button title="Інший email" variant="soft" style={styles.flex} onPress={() => setStep('email')} />
          </View>
        </>
      )}
      <Button title="Назад до входу" variant="soft" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
