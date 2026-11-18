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
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidPhone } from '@/lib/profile';
import { useAuth } from '@/store/auth';

const MODES = ['Вхід', 'Реєстрація'] as const;
const ROLES = ['Я власник авто', 'Шукаю авто в оренду'] as const;

/** Картки вибору ролі: що кожна означає, щоб вибір був свідомим */
const ROLE_OPTIONS: { label: (typeof ROLES)[number]; icon: 'key-outline' | 'search-outline'; text: string; points: string[] }[] = [
  { label: ROLES[0], icon: 'key-outline', text: 'Я здаю свої авто в оренду.', points: ['Облік доходів і витрат по кожному авто', 'Запити й договори з орендарями', 'Публікація авто для пошуку'] },
  { label: ROLES[1], icon: 'search-outline', text: 'Я беру авто в оренду в власників.', points: ['Пошук вільних авто в потрібному місті', 'Запит і договір із власником', 'Облік заробітку й витрат'] },
];

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [doc, setDoc] = useState<'privacy' | 'terms' | null>(null);
  const { login, register, confirmRegistration, resendRegistration } = useAuth();

  const [mode, setMode] = useState<(typeof MODES)[number]>('Вхід');
  // Роль обирають на окремому екрані й без значення за замовчуванням: щоб її не проминули. Потім змінити не можна.
  const [roleLabel, setRoleLabel] = useState<(typeof ROLES)[number] | null>(null);
  const [picked, setPicked] = useState<(typeof ROLES)[number] | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Помилки полів від сервера (зайнятий телефон чи пошта, хибне посвідчення): підсвічують відповідні поля, поки їх не змінять
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearField = (...keys: string[]) => setFieldErrors((f) => (keys.some((k) => k in f) ? Object.fromEntries(Object.entries(f).filter(([k]) => !keys.includes(k))) : f));
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  // Після форми реєстрації: чекаємо код із листа
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);

  const signingUp = mode === 'Реєстрація';
  const isRenter = roleLabel === ROLES[1];
  const validProfile = !!firstName.trim() && !!lastName.trim() && !!middleName.trim() && isValidPhone(phone);
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
    setFieldErrors({});
    if (signingUp) {
      const res = await register(email, password, { firstName, lastName, middleName, phone }, isRenter ? 'renter' : 'owner');
      setBusy(false);
      // Якщо сервер вказав поля, підсвічуємо їх, а загального повідомлення внизу не показуємо
      if (res.fields && Object.keys(res.fields).length) return setFieldErrors(res.fields);
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

  // Реєстрація починається з окремого екрана вибору ролі
  if (signingUp && !roleLabel && !awaitingCode) {
    return (
      <Screen contentContainerStyle={{ paddingTop: insets.top + Spacing.four }} gap={Spacing.three}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('@/assets/images/kolo-mark.png')} style={styles.mark} accessibilityLabel="Kolo" />
            <ThemedText type="subtitle" style={styles.wordmark}>
              Kolo
            </ThemedText>
          </View>
          <ThemedText type="subtitle" style={styles.hero} accessibilityRole="header">
            Хто ви?
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Оберіть, що вам потрібно. Тип акаунта потім змінити не можна.
          </ThemedText>
        </View>

        <View style={styles.bigRoles} accessibilityRole="radiogroup">
          {ROLE_OPTIONS.map((o) => {
            const on = picked === o.label;
            return (
              <Pressable
                key={o.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, selected: on }}
                accessibilityLabel={`${o.label}. ${o.text}`}
                onPress={() => setPicked(o.label)}
                style={({ pressed }) => [styles.bigRole, { borderColor: on ? theme.accent : theme.borderStrong, borderWidth: on ? 2 : 1, backgroundColor: on ? theme.accentSoft : theme.backgroundElement }, pressed && { opacity: 0.85 }]}>
                <View style={styles.bigRoleHead}>
                  <View style={[styles.bigRoleIcon, { backgroundColor: on ? theme.accent : theme.backgroundSelected }]}>
                    <Icon name={o.icon} size={28} color={on ? theme.onAccent : theme.text} />
                  </View>
                  <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={26} color={on ? 'accent' : 'textSecondary'} />
                </View>
                <ThemedText type="title">{o.label}</ThemedText>
                <ThemedText type="body" themeColor="textSecondary">
                  {o.text}
                </ThemedText>
                <View style={styles.bullets}>
                  {o.points.map((pt) => (
                    <View key={pt} style={styles.bullet}>
                      <Icon name="checkmark-circle" size={18} color="accent" />
                      <ThemedText type="callout" style={styles.flex}>
                        {pt}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Button title="Продовжити" disabled={!picked} disabledReason={!picked ? 'Оберіть, хто ви, щоб продовжити' : undefined} onPress={() => setRoleLabel(picked)} />
        <Pressable accessibilityRole="button" onPress={() => setMode('Вхід')} hitSlop={8} style={{ alignSelf: 'center' }}>
          <ThemedText type="smallBold" themeColor="accent">
            Вже є акаунт? Увійти
          </ThemedText>
        </Pressable>
      </Screen>
    );
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
          {signingUp ? 'Заповніть дані: їх буде видно в договорі.' : 'Увійдіть, щоб побачити свої авто, оренди й повідомлення.'}
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
          <View style={[styles.chosen, { backgroundColor: theme.accentSoft }]}>
            <Icon name={isRenter ? 'search-outline' : 'key-outline'} size={22} color="accent" />
            <View style={styles.flex}>
              <ThemedText type="caption" themeColor="textSecondary">
                Ви реєструєтесь як
              </ThemedText>
              <ThemedText type="headline">{roleLabel}</ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Змінити тип акаунта"
              hitSlop={8}
              onPress={() => {
                setPicked(roleLabel);
                setRoleLabel(null);
              }}>
              <ThemedText type="smallBold" themeColor="accent">
                Змінити
              </ThemedText>
            </Pressable>
          </View>
          <Field label="Прізвище" value={lastName} onChangeText={(v) => { setLastName(v); clearField('lastName'); }} error={fieldErrors.lastName} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" maxLength={50} placeholder="Шевченко" />
          <Field label="Ім’я" value={firstName} onChangeText={(v) => { setFirstName(v); clearField('firstName'); }} error={fieldErrors.firstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" maxLength={50} placeholder="Іван" />
          <Field label="По батькові" value={middleName} onChangeText={(v) => { setMiddleName(v); clearField('middleName'); }} error={fieldErrors.middleName} autoCapitalize="words" maxLength={50} placeholder="Петрович" />
          <ThemedText type="small" themeColor="textSecondary">
            Прізвище, ім’я й по батькові потрібні, щоб у договорі були вказані ваші ПІБ повністю. Інших особистих даних (паспорт, РНОКПП, адреса) застосунок не вимагає.
          </ThemedText>
          <Field
            label="Телефон"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              clearField('phone');
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={20}
            placeholder="+380 67 123 45 67"
            error={fieldErrors.phone ?? (phone.trim() && !isValidPhone(phone) ? 'Невірний формат телефону' : undefined)}
          />
        </>
      ) : null}

      <Field
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          clearField('email');
        }}
        error={fieldErrors.email}
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
        onChangeText={(v) => {
          setPassword(v);
          clearField('password');
        }}
        error={fieldErrors.password}
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
  wordmark: { ...Type.display, letterSpacing: -1 },
  mark: { width: 52, height: 52 },
  tabs: { flexDirection: 'row', gap: Spacing.four, borderBottomWidth: 1 },
  tab: { paddingVertical: Spacing.two, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  flex: { flex: 1 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.md, padding: Spacing.three },
  bigRoles: { gap: Spacing.three },
  bigRole: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  bigRoleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bigRoleIcon: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  bullets: { gap: Spacing.one, marginTop: Spacing.one },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  codeInput: { ...Type.figure, letterSpacing: 8, textAlign: 'center' },
});
