import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth';

const MODES = ['Вхід', 'Реєстрація'] as const;

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<(typeof MODES)[number]>('Вхід');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);

  const signingUp = mode === 'Реєстрація';
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= (signingUp ? 8 : 1);

  // Якщо відповідь іде довше за кілька секунд — пояснюємо чому
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [busy]);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const message = await (signingUp ? register : login)(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <Screen contentContainerStyle={{ paddingTop: insets.top + Spacing.five }}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <Icon name="car-sport" size={40} color="accent" />
        </View>
        <ThemedText type="subtitle">my-rent</ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
          Облік авто в оренді: доходи, витрати, прибуток і нагадування
        </ThemedText>
      </View>

      <Segmented options={MODES} value={mode} onChange={(m) => { setMode(m); setError(null); }} />

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        placeholder="name@example.com"
      />
      <Field
        label={signingUp ? 'Пароль (мінімум 8 символів)' : 'Пароль'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        textContentType={signingUp ? 'newPassword' : 'password'}
        onSubmitEditing={submit}
      />

      {error ? (
        <ThemedText type="small" themeColor="negative" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}

      {busy && slow ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Сервер прокидається після простою, це може тривати до хвилини. Будь ласка, зачекайте.
        </ThemedText>
      ) : null}

      <Button title={busy ? 'Зачекайте…' : signingUp ? 'Створити акаунт' : 'Увійти'} disabled={!valid || busy} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  badge: { width: 80, height: 80, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
