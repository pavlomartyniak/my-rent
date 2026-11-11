import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { phoneError } from '@/lib/profile';
import { useFleet } from '@/store/fleet';

/** Редагування профілю: прізвище, ім'я, по батькові (ПІБ у договорі) і телефон. Email змінити не можна. */
export default function ProfileScreen() {
  const router = useRouter();
  const { email, firstName: savedFirst, lastName: savedLast, middleName: savedMiddle, phone: savedPhone, updateProfile } = useFleet();

  const [firstName, setFirstName] = useState(savedFirst);
  const [lastName, setLastName] = useState(savedLast);
  const [middleName, setMiddleName] = useState(savedMiddle);
  const [phone, setPhone] = useState(savedPhone);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  // Помилки полів від сервера (наприклад, телефон уже зайнятий): підсвічують поле, поки його не змінять
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const clear = (key: string) => setServerErrors((f) => (key in f ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)) : f));

  const errors = {
    firstName: firstName.trim() ? '' : 'Вкажіть ім’я',
    lastName: lastName.trim() ? '' : 'Вкажіть прізвище',
    middleName: middleName.trim() ? '' : 'Вкажіть по батькові',
    phone: phoneError(phone),
  };

  async function onSave() {
    if (saving) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    setServerErrors({});
    const ok = await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), middleName: middleName.trim(), phone: phone.trim() }, setServerErrors);
    setSaving(false);
    if (ok) router.back();
  }

  return (
    <Screen>
      <Field label="Прізвище" value={lastName} onChangeText={(v) => { setLastName(v); clear('lastName'); }} error={serverErrors.lastName ?? (submitted ? errors.lastName : undefined)} autoCapitalize="words" textContentType="familyName" maxLength={50} />
      <Field label="Ім’я" value={firstName} onChangeText={(v) => { setFirstName(v); clear('firstName'); }} error={serverErrors.firstName ?? (submitted ? errors.firstName : undefined)} autoCapitalize="words" textContentType="givenName" maxLength={50} />
      <Field label="По батькові" value={middleName} onChangeText={(v) => { setMiddleName(v); clear('middleName'); }} error={serverErrors.middleName ?? (submitted ? errors.middleName : undefined)} autoCapitalize="words" maxLength={50} placeholder="Петрович" />
      <Field
        label="Телефон"
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          clear('phone');
        }}
        error={serverErrors.phone ?? (submitted || phone ? errors.phone || undefined : undefined)}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        maxLength={20}
        placeholder="+380 67 123 45 67"
      />
      <Field label="Email (змінити не можна)" value={email} editable={false} selectTextOnFocus={false} style={{ opacity: 0.6 }} />
      <Button title={saving ? 'Зберігаємо…' : 'Зберегти'} disabled={saving} onPress={onSave} />
    </Screen>
  );
}
