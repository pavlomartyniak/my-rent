import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { LegalSheet } from '@/components/legal-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidPhone } from '@/lib/profile';
import { EMPTY_LICENSE, LicenseFields, licenseFill, type LicenseDraft } from '@/components/license-fields';
import { useAuth } from '@/store/auth';

const MODES = ['Вхід', 'Реєстрація'] as const;
const ROLES = ['Я власник авто', 'Шукаю авто в оренду'] as const;

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [doc, setDoc] = useState<'privacy' | 'terms' | null>(null);
  const { login, register, confirmRegistration, resendRegistration } = useAuth();

  const [mode, setMode] = useState<(typeof MODES)[number]>('Вхід');
  const [roleLabel, setRoleLabel] = useState<(typeof ROLES)[number]>(ROLES[0]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [license, setLicense] = useState<LicenseDraft>(EMPTY_LICENSE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  // Після форми реєстрації: чекаємо код із листа
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);

  const signingUp = mode === 'Реєстрація';
  const isRenter = roleLabel !== ROLES[0];
  // Посвідчення при реєстрації необов'язкове: порожнє чи повністю заповнене
  const licenseState = isRenter ? licenseFill(license) : 'empty';
  const validProfile = !!firstName.trim() && !!lastName.trim() && isValidPhone(phone) && licenseState !== 'partial';
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

  // Лічильник до можливості надіслати код ще раз
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    if (signingUp) {
      const res = await register(email, password, { firstName, lastName, phone }, isRenter ? 'renter' : 'owner', licenseState === 'full' ? license : undefined);
      setBusy(false);
      if (res.error) return setError(res.error);
      setWait(res.resendInSeconds ?? 60);
      setCode('');
      setAwaitingCode(true);
      return;
    }
    const message = await login(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  async function confirmCode() {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const message = await confirmRegistration(email, code);
    setBusy(false);
    if (message) setError(message);
  }

  async function resendCode() {
    if (wait > 0 || busy) return;
    setBusy(true);
    setError(null);
    const res = await resendRegistration(email);
    setBusy(false);
    if (res.error) return setError(res.error);
    setWait(res.resendInSeconds ?? 60);
    setCode('');
  }

  if (awaitingCode) {
    return (
      <Screen contentContainerStyle={{ paddingTop: insets.top + Spacing.four }} gap={Spacing.three}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('@/assets/images/kolo-mark.png')} style={styles.mark} accessibilityLabel="Kolo" />
            <ThemedText type="subtitle" style={styles.wordmark}>
              Kolo
            </ThemedText>
          </View>
          <ThemedText type="subtitle" style={styles.hero}>
            Підтвердіть пошту
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Ми надіслали код на {email.trim()}. Акаунт створиться, щойно ви введете його. Перевірте також «Спам».
          </ThemedText>
        </View>

        <Field
          label="Код із листа"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          autoFocus
          style={styles.codeInput}
          onSubmitEditing={() => void confirmCode()}
        />
        {error ? (
          <ThemedText type="small" themeColor="negative" accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}
        <Button title={busy ? 'Перевіряємо…' : 'Підтвердити й створити акаунт'} disabled={code.length !== 6 || busy} onPress={() => void confirmCode()} />
        <Button title={wait > 0 ? `Надіслати код ще раз (${wait} с)` : 'Надіслати код ще раз'} variant="soft" disabled={wait > 0 || busy} onPress={() => void resendCode()} />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAwaitingCode(false);
            setError(null);
          }}
          hitSlop={8}
          style={{ alignSelf: 'center' }}>
          <ThemedText type="smallBold" themeColor="accent">
            Змінити пошту чи дані
          </ThemedText>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ paddingTop: insets.top + Spacing.four }} gap={Spacing.three}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('@/assets/images/kolo-mark.png')} style={styles.mark} accessibilityLabel="Kolo" />
          <ThemedText type="subtitle" style={styles.wordmark}>
            Kolo
          </ThemedText>
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
          <Field label="Ім’я" value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" maxLength={50} placeholder="Іван" />
          <Field label="Прізвище" value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" maxLength={50} placeholder="Шевченко" />
          <Field
            label="Телефон"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={20}
            placeholder="+380 67 123 45 67"
            error={phone.trim() && !isValidPhone(phone) ? 'Невірний формат телефону' : undefined}
          />
          {isRenter ? (
            <>
              <ThemedText type="smallBold">Посвідчення водія (необов’язково)</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Знадобиться, щоб надіслати запит на авто чи створити заявку. Якщо не заповнювати зараз, додайте пізніше в профілі.
              </ThemedText>
              <LicenseFields value={license} onChange={setLicense} />
              {licenseState === 'partial' ? (
                <ThemedText type="small" themeColor="negative">
                  Заповніть посвідчення повністю (серія, номер, категорії, строк дії) або залиште порожнім.
                </ThemedText>
              ) : null}
            </>
          ) : null}
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

      {!signingUp ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/forgot')} hitSlop={8} style={{ alignSelf: 'center' }}>
          <ThemedText type="smallBold" themeColor="accent">
            Забули пароль?
          </ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {signingUp ? 'Створюючи акаунт' : 'Входячи'}, ви погоджуєтесь з{' '}
        <ThemedText type="small" themeColor="accent" onPress={() => setDoc('terms')}>
          Умовами користування
        </ThemedText>{' '}
        і{' '}
        <ThemedText type="small" themeColor="accent" onPress={() => setDoc('privacy')}>
          Політикою конфіденційності
        </ThemedText>
        .
      </ThemedText>
      <LegalSheet doc={doc} onClose={() => setDoc(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  hero: { marginTop: Spacing.two },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  wordmark: { fontSize: 30, letterSpacing: -1 },
  mark: { width: 52, height: 52 },
  tabs: { flexDirection: 'row', gap: Spacing.four, borderBottomWidth: 1 },
  tab: { paddingVertical: Spacing.two, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  role: { gap: Spacing.two },
  roles: { flexDirection: 'row', gap: Spacing.two },
  roleCard: { flex: 1, borderRadius: Radius.lg, padding: Spacing.three, gap: 4 },
  center: { textAlign: 'center' },
  codeInput: { fontSize: 28, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
});
