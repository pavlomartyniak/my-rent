import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidPhone } from '@/lib/profile';
import { useAuth } from '@/store/auth';

const MODES = ['Вхід', 'Реєстрація'] as const;
const ROLES = ['Я власник авто', 'Шукаю авто в оренду'] as const;

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<(typeof MODES)[number]>('Вхід');
  const [roleLabel, setRoleLabel] = useState<(typeof ROLES)[number]>(ROLES[0]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);

  const signingUp = mode === 'Реєстрація';
  const validProfile = !!firstName.trim() && !!lastName.trim() && isValidPhone(phone);
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= (signingUp ? 8 : 1) && (!signingUp || validProfile);

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
    const message = signingUp ? await register(email, password, { firstName, lastName, phone }, roleLabel === ROLES[0] ? 'owner' : 'renter') : await login(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <Screen contentContainerStyle={{ paddingTop: insets.top + Spacing.four }} gap={Spacing.three}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Icon name="car-sport" size={26} color="#FFFFFF" />
        </View>
        <ThemedText type="subtitle" style={styles.hero}>
          {signingUp ? 'Створіть акаунт' : 'З поверненням'}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {signingUp ? 'Облік авто або пошук оренди — оберіть, що вам потрібно.' : 'Увійдіть, щоб побачити свої авто, оренди й повідомлення.'}
        </ThemedText>
      </View>

      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {MODES.map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: m === mode }}
            onPress={() => {
              setMode(m);
              setError(null);
            }}
            style={[styles.tab, m === mode && { borderBottomColor: theme.ink }]}>
            <ThemedText type="default" style={{ fontWeight: 600 }} themeColor={m === mode ? 'text' : 'textSecondary'}>
              {m}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {signingUp ? (
        <>
          <View style={styles.role}>
            <ThemedText type="smallBold">Хто ви? Тип акаунта потім змінити не можна</ThemedText>
            <View style={styles.roles}>
              {ROLES.map((r) => {
                const on = r === roleLabel;
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setRoleLabel(r)}
                    style={[styles.roleCard, { borderColor: on ? theme.ink : theme.border, borderWidth: on ? 2 : 1, backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement }]}>
                    <Icon name={r === ROLES[0] ? 'key-outline' : 'search-outline'} size={24} color="text" />
                    <ThemedText type="default" style={{ fontWeight: 600 }}>
                      {r === ROLES[0] ? 'Я власник авто' : 'Шукаю авто'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {r === ROLES[0] ? 'Облік, оренди й прибуток' : 'Пошук і оренда'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Field label="Ім’я" value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" maxLength={50} placeholder="Павло" />
          <Field label="Прізвище" value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" maxLength={50} placeholder="Мартиняк" />
          <Field
            label="Телефон (необов’язково)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={20}
            placeholder="+380 67 123 45 67"
            error={isValidPhone(phone) ? undefined : 'Невірний формат телефону'}
          />
        </>
      ) : null}

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
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  hero: { marginTop: Spacing.two },
  badge: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: Spacing.four, borderBottomWidth: 1 },
  tab: { paddingVertical: Spacing.two, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  role: { gap: Spacing.two },
  roles: { flexDirection: 'row', gap: Spacing.two },
  roleCard: { flex: 1, borderRadius: Radius.lg, padding: Spacing.three, gap: 4 },
  center: { textAlign: 'center' },
});
