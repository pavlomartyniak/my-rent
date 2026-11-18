import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { drivingYearError, ProfileExtrasForm } from '@/components/profile-extras';
import { EMPTY_EXTRAS, hasAnswers, type ProfileExtras } from '@/lib/profile';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFleet } from '@/store/fleet';

type Step = { icon: IconName; title: string; text: string };

const OWNER_STEPS: Step[] = [
  { icon: 'car-sport', title: 'Усі авто в одному місці', text: 'Додайте машини в оренді: марка, VIN, пробіг, водій і дата початку оренди.' },
  { icon: 'stats-chart', title: 'Прибуток і ROI', text: 'Вносьте доходи та витрати за кілька тапів — застосунок сам порахує прибуток і окупність кожного авто.' },
  { icon: 'megaphone', title: 'Здавайте через застосунок', text: 'Опублікуйте вільне авто, і орендарі надішлють запити. Прийнявши запит, ви автоматично додаєте оренду в облік.' },
];

const RENTER_STEPS: Step[] = [
  { icon: 'search', title: 'Знайдіть авто в оренду', text: 'Шукайте вільні авто від власників у своєму місті та дивіться ціну за добу.' },
  { icon: 'paper-plane', title: 'Надішліть запит', text: 'Оберіть дати й напишіть власнику. Запит нічого не бронює, поки власник його не прийме.' },
  { icon: 'call', title: 'Домовтесь із власником', text: 'Після підтвердження ви побачите номер власника, щоб домовитись про передачу авто.' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { finishOnboarding, role, updateProfile, firstName, lastName } = useFleet();
  const STEPS = role === 'renter' ? RENTER_STEPS : OWNER_STEPS;
  const [step, setStep] = useState(0);
  const [extras, setExtras] = useState<ProfileExtras>(EMPTY_EXTRAS);
  const [saving, setSaving] = useState(false);
  // Після слайдів іде необов'язковий крок «Розкажіть про себе»
  const profileStep = step === STEPS.length;
  const last = step === STEPS.length - 1;
  const s = STEPS[Math.min(step, STEPS.length - 1)];

  async function saveAndStart() {
    if (saving) return;
    if (drivingYearError(extras.drivingSince)) return;
    setSaving(true);
    const filled = extras.city.trim() || extras.photoUri || extras.about.trim() || extras.drivingSince !== null || hasAnswers(extras, role ?? '');
    // Збережене в профілі можна змінити потім у «Профілі»; помилка збереження не має блокувати початок роботи
    if (filled) await updateProfile({ ...extras, city: extras.city.trim(), about: extras.about.trim() });
    await finishOnboarding();
    setSaving(false);
  }

  if (profileStep) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ThemedText type="subtitle">Розкажіть про себе</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Це необов’язково й видно іншим у вашому профілі. Заповнити чи змінити можна будь-коли в «Профілі».
            </ThemedText>
            <ProfileExtrasForm value={extras} onChange={(patch) => setExtras((e) => ({ ...e, ...patch }))} name={[lastName, firstName].filter(Boolean).join(' ')} renter={role === 'renter'} submitted />
          </ScrollView>
          <View style={styles.footer}>
            <Button title={saving ? 'Зберігаємо…' : 'Зберегти й почати'} disabled={saving} onPress={() => void saveAndStart()} />
            <Button title="Пропустити" variant="secondary" disabled={saving} onPress={() => void finishOnboarding()} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <Icon name={s.icon} size={56} color="accent" />
        </View>
        <ThemedText type="subtitle" style={styles.center}>
          {s.title}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
          {s.text}
        </ThemedText>
        <View style={styles.dots}>
          {[...STEPS, null].map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === step ? theme.accent : theme.backgroundSelected }, i === step && styles.dotActive]} />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        {last ? (
          <Button title="Далі" onPress={() => setStep(step + 1)} />
        ) : (
          <>
            <Button title="Далі" onPress={() => setStep(step + 1)} />
            <Button title="Пропустити" variant="secondary" onPress={() => void finishOnboarding()} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  badge: { width: 120, height: 120, borderRadius: Radius.lg + 10, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.three },
  center: { textAlign: 'center' },
  dots: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  footer: { gap: Spacing.two, paddingBottom: Spacing.three },
  formBody: { gap: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.four },
});
