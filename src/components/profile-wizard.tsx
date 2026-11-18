import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { questionsFor, type ProfileExtras } from '@/lib/profile';

import { CityField } from './place-field';
import { drivingYearError, ProfilePhoto } from './profile-extras';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { ChoiceChips } from './ui/choice-chips';
import { Field } from './ui/field';
import { NumberField } from './ui/number-field';

type Props = {
  role: 'owner' | 'renter';
  name: string;
  value: ProfileExtras;
  onChange: (patch: Partial<ProfileExtras>) => void;
  /** Зберігає відповіді й завершує онбординг; false — не вдалося, лишаємось на останньому кроці */
  onFinish: () => Promise<boolean>;
};

/**
 * Обов'язкова анкета після реєстрації: по одному питанню на екрані, з прогресом і кнопкою «Назад». На кожне питання треба
 * відповісти, щоб піти далі: ці відповіді бачить друга сторона оренди. Необов'язкові лише фото й «Про себе».
 * Ті самі питання, що в «Профілі»: їх список береться з `questionsFor(role)`.
 */
export function ProfileWizard({ role, name, value, onChange, onFinish }: Props) {
  const theme = useTheme();
  const renter = role === 'renter';
  const questions = questionsFor(role);
  // Кроки: «Про вас» (фото, місто, стаж), по кроку на питання, «Про себе»
  const total = questions.length + 2;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const q = step >= 1 && step <= questions.length ? questions[step - 1] : null;
  const last = step === total - 1;

  const mileageMissing = q?.key === 'mileageLimit' && value.mileageLimit === 'limited' && value.mileageKm === null;
  const answered = q ? (q.multi ? (value[q.key] as string[]).length > 0 : !!value[q.key]) && !mileageMissing : true;
  const basicsOk = value.city.trim() !== '' && (!renter || (value.drivingSince !== null && !drivingYearError(value.drivingSince)));
  const valid = step === 0 ? basicsOk : q ? answered : true;

  const why = step === 0 ? (renter ? 'Оберіть місто й укажіть рік, з якого водите' : 'Оберіть місто') : mileageMissing ? 'Вкажіть, скільки км на добу входить в оренду' : 'Оберіть відповідь, щоб продовжити';

  async function next() {
    if (!last) return setStep(step + 1);
    setSaving(true);
    await onFinish();
    setSaving(false);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.top}>
        <ThemedText type="caption" themeColor="textSecondary">
          Крок {step + 1} з {total}
        </ThemedText>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step + 1 }}>
          <View style={[styles.fill, { backgroundColor: theme.accent, width: `${((step + 1) / total) * 100}%` }]} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <>
              <ThemedText type="title" accessibilityRole="header">
                Розкажіть про себе
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {renter ? 'Це бачитимуть власники авто: так їм легше довіритись.' : 'Це бачитимуть орендарі: так їм легше довіритись.'} Відповіді можна змінити пізніше в «Профілі».
              </ThemedText>
              <ProfilePhoto photoUri={value.photoUri} name={name} onChange={(photoUri) => onChange({ photoUri })} />
              <CityField inline label="Ваше місто" value={value.city} onChange={(city) => onChange({ city })} />
              {renter ? (
                <NumberField
                  label="З якого року ви водите авто?"
                  value={value.drivingSince === null ? '' : String(value.drivingSince)}
                  onChangeValue={(d) => onChange({ drivingSince: d ? Number(d) : null })}
                  maxDigits={4}
                  placeholder="Наприклад, 2015"
                  plain
                  error={value.drivingSince !== null ? drivingYearError(value.drivingSince) || undefined : undefined}
                />
              ) : null}
            </>
          ) : q ? (
            <>
              {q.multi ? (
                <ChoiceChips multi exclusive={q.exclusive} label={q.label} hint={q.hint} options={q.options} value={value[q.key] as string[]} onChange={(v) => onChange({ [q.key]: v })} />
              ) : (
                <ChoiceChips label={q.label} hint={q.hint} options={q.options} value={value[q.key] as string} onChange={(v) => onChange({ [q.key]: v })} />
              )}
              {q.key === 'mileageLimit' && value.mileageLimit === 'limited' ? (
                <NumberField
                  label="Скільки км на добу входить в оренду"
                  value={value.mileageKm === null ? '' : String(value.mileageKm)}
                  onChangeValue={(d) => onChange({ mileageKm: d ? Math.min(Number(d), 2000) : null })}
                  maxDigits={4}
                  placeholder="Наприклад, 300"
                  plain
                />
              ) : null}
            </>
          ) : (
            <>
              <ThemedText type="title" accessibilityRole="header">
                Кілька слів від себе
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                Необов’язково. Контактів тут не вказуйте: вони відкриваються стороні оренди автоматично.
              </ThemedText>
              <Field
                label="Про себе (необов’язково)"
                value={value.about}
                onChangeText={(about) => onChange({ about })}
                multiline
                maxLength={300}
                placeholder={renter ? 'Наприклад: працюю у таксі, потрібне авто на тривалий строк' : 'Наприклад: авто завжди чисте, можу передати вночі'}
                style={{ minHeight: 120, paddingTop: 12, textAlignVertical: 'top' }}
              />
              <ThemedText type="caption" themeColor="textSecondary" style={styles.counter}>
                {value.about.length} / 300
              </ThemedText>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button title={last ? 'Зберегти й почати' : 'Далі'} loading={saving} disabled={!valid} disabledReason={!valid ? why : undefined} onPress={() => void next()} />
        {step > 0 ? <Button title="Назад" variant="tertiary" disabled={saving} onPress={() => setStep(step - 1)} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four },
  flex: { flex: 1 },
  top: { gap: Spacing.two, paddingTop: Spacing.three },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  body: { gap: Spacing.four, paddingTop: Spacing.four, paddingBottom: Spacing.four },
  counter: { textAlign: 'right', marginTop: -Spacing.three },
  footer: { gap: Spacing.two, paddingBottom: Spacing.three },
});
