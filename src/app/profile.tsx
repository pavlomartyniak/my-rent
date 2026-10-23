import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { isValidPhone } from '@/lib/profile';
import { useFleet } from '@/store/fleet';

/** Редагування профілю: ім'я, прізвище, телефон. Email змінити не можна. */
export default function ProfileScreen() {
  const router = useRouter();
  const { email, firstName: savedFirst, lastName: savedLast, phone: savedPhone, updateProfile } = useFleet();

  const [firstName, setFirstName] = useState(savedFirst);
  const [lastName, setLastName] = useState(savedLast);
  const [phone, setPhone] = useState(savedPhone);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = {
    firstName: firstName.trim() ? '' : 'Вкажіть ім’я',
    lastName: lastName.trim() ? '' : 'Вкажіть прізвище',
    phone: isValidPhone(phone) ? '' : 'Невірний формат телефону',
  };

  async function onSave() {
    if (saving) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    const ok = await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() });
    setSaving(false);
    if (ok) router.back();
  }

  return (
    <Screen>
      <Field label="Ім’я" value={firstName} onChangeText={setFirstName} error={submitted ? errors.firstName : undefined} autoCapitalize="words" textContentType="givenName" maxLength={50} />
      <Field label="Прізвище" value={lastName} onChangeText={setLastName} error={submitted ? errors.lastName : undefined} autoCapitalize="words" textContentType="familyName" maxLength={50} />
      <Field
        label="Телефон (необов’язково)"
        value={phone}
        onChangeText={setPhone}
        error={submitted || phone ? errors.phone || undefined : undefined}
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
