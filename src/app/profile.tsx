import { useRouter } from 'expo-router';
import { useState } from 'react';

import { drivingYearError, ProfileExtrasForm } from '@/components/profile-extras';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { EMPTY_EXTRAS, phoneError, type ProfileExtras } from '@/lib/profile';
import { useFleet } from '@/store/fleet';

/**
 * Редагування профілю: ПІБ і телефон (потрібні для договору), а також необов'язкове: фото, місто, кілька слів про себе,
 * стаж водіння й мета оренди. Усе необов'язкове бачать інші на сторінці профілю. Email змінити не можна.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const me = useFleet();
  const { email, updateProfile, role, id: myId } = me;

  const [firstName, setFirstName] = useState(me.firstName);
  const [lastName, setLastName] = useState(me.lastName);
  const [middleName, setMiddleName] = useState(me.middleName);
  const [phone, setPhone] = useState(me.phone);
  const [extras, setExtras] = useState<ProfileExtras>({ ...EMPTY_EXTRAS, city: me.city ?? '', photoUri: me.photoUri ?? '', about: me.about ?? '', drivingSince: me.drivingSince ?? null, purposes: me.purposes ?? [], licenseCategories: me.licenseCategories ?? [], accidents: me.accidents ?? '', rentExperience: me.rentExperience ?? '', occupation: me.occupation ?? '', rentTerm: me.rentTerm ?? '', depositReady: me.depositReady ?? '', transmission: me.transmission ?? '' });
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
    year: drivingYearError(extras.drivingSince),
  };

  async function onSave() {
    if (saving) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    setServerErrors({});
    const ok = await updateProfile(
      { firstName: firstName.trim(), lastName: lastName.trim(), middleName: middleName.trim(), phone: phone.trim(), ...extras, city: extras.city.trim(), about: extras.about.trim() },
      setServerErrors,
    );
    setSaving(false);
    if (ok) router.back();
  }

  const name = [lastName, firstName].map((s) => s.trim()).filter(Boolean).join(' ');

  return (
    <Screen>
      <ProfileExtrasForm value={extras} onChange={(patch) => setExtras((e) => ({ ...e, ...patch }))} name={name} renter={role === 'renter'} submitted={submitted} />

      <SectionHeader title="Особисті дані" />
      <ThemedText type="small" themeColor="textSecondary">
        Ці дані потрібні для договору. Повне ім’я бачить лише сторона вашої оренди, іншим показується «Ім’я П.».
      </ThemedText>
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
      <Button title="Як бачать мій профіль інші" variant="soft" icon="eye-outline" disabled={!myId} onPress={() => router.push({ pathname: '/user/[id]', params: { id: myId } })} />
    </Screen>
  );
}
