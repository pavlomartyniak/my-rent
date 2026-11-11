import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { EMPTY_LICENSE, LicenseFields, licenseFill, type LicenseDraft } from '@/components/license-fields';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { Alert } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { phoneError } from '@/lib/profile';
import { useFleet } from '@/store/fleet';

/** Редагування профілю: ім'я, прізвище, телефон й (для орендаря) посвідчення водія. Email змінити не можна. */
export default function ProfileScreen() {
  const router = useRouter();
  const { email, role, firstName: savedFirst, lastName: savedLast, phone: savedPhone, updateProfile, invalidate } = useFleet();
  const isRenter = role === 'renter';

  const [firstName, setFirstName] = useState(savedFirst);
  const [lastName, setLastName] = useState(savedLast);
  const [phone, setPhone] = useState(savedPhone);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  // null — посвідчення ще завантажується
  const [license, setLicense] = useState<LicenseDraft | null>(null);
  const [licenseProblems, setLicenseProblems] = useState<string[]>([]);

  useEffect(() => {
    if (!isRenter) return;
    api<{ legal?: { license?: LicenseDraft } }>('GET', '/me')
      .then((me) => setLicense({ ...EMPTY_LICENSE, ...me.legal?.license }))
      .catch(() => setLicense(EMPTY_LICENSE));
  }, [isRenter]);

  const errors = {
    firstName: firstName.trim() ? '' : 'Вкажіть ім’я',
    lastName: lastName.trim() ? '' : 'Вкажіть прізвище',
    phone: phoneError(phone),
  };

  async function onSave() {
    if (saving) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    // Посвідчення: або порожнє (прибирається), або заповнене повністю
    if (isRenter && license && licenseFill(license) === 'partial') {
      setLicenseProblems(['Заповніть посвідчення повністю (серія, номер, строк дії) або залиште порожнім']);
      return;
    }
    setSaving(true);
    setLicenseProblems([]);
    const ok = await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() });
    if (ok && isRenter && license) {
      try {
        await api('PUT', '/me/license', license);
        invalidate();
      } catch (e) {
        setSaving(false);
        if (e instanceof ApiError && e.status === 400) setLicenseProblems(e.details?.length ? e.details : [e.message]);
        else Alert.alert('Не вдалося зберегти посвідчення', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
        return;
      }
    }
    setSaving(false);
    if (ok) router.back();
  }

  return (
    <Screen>
      <Field label="Ім’я" value={firstName} onChangeText={setFirstName} error={submitted ? errors.firstName : undefined} autoCapitalize="words" textContentType="givenName" maxLength={50} />
      <Field label="Прізвище" value={lastName} onChangeText={setLastName} error={submitted ? errors.lastName : undefined} autoCapitalize="words" textContentType="familyName" maxLength={50} />
      <Field
        label="Телефон"
        value={phone}
        onChangeText={setPhone}
        error={submitted || phone ? errors.phone || undefined : undefined}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        maxLength={20}
        placeholder="+380 67 123 45 67"
      />
      <Field label="Email (змінити не можна)" value={email} editable={false} selectTextOnFocus={false} style={{ opacity: 0.6 }} />
      {isRenter ? (
        <>
          <Card>
            <ThemedText type="smallBold">Посвідчення водія</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Посвідчення водія (серія, номер і строк дії) вказують у договорі. Його не вимагають, поки ви не захочете укласти договір, тоді воно має бути заповнене. Додати його можна й зараз, і пізніше.
            </ThemedText>
          </Card>
          {license ? <LicenseFields value={license} onChange={setLicense} /> : null}
          {licenseProblems.length ? (
            <Card>
              {licenseProblems.map((p) => (
                <ThemedText key={p} type="small" themeColor="negative">
                  • {p}
                </ThemedText>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
      <Button title={saving ? 'Зберігаємо…' : 'Зберегти'} disabled={saving} onPress={onSave} />
    </Screen>
  );
}
