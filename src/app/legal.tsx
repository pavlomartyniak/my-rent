import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { NumberField } from '@/components/ui/number-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/date';
import { deleteLegal, EMPTY_LEGAL, getLegal, type LegalData, legalProblems, type LegalStep, mask, saveLegal, STEP_FIELDS, stepOk } from '@/lib/contract-data';
import { useFleet } from '@/store/fleet';

const DOC_TYPES = [
  { value: 'passport', label: 'Паспорт (книжечка)' },
  { value: 'id', label: 'ID-картка' },
];
const OWNERSHIPS = [
  { value: 'owner', label: 'Я власник за свідоцтвом про реєстрацію' },
  { value: 'proxy', label: 'Діюю за довіреністю' },
];

/**
 * «Дані для договору»: короткий майстер із 5 кроків (хто ви, документ, адреса, посвідчення чи підстава володіння, перевірка).
 * Дані потрібні лише щоб у договорі не було порожніх рядків: їх бачить тільки друга сторона вашої оренди, і лише в договорі.
 */
export default function LegalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { role, firstName, lastName, middleName } = useFleet();
  const kind = role === 'renter' ? 'renter' : 'owner';
  const [d, setD] = useState<LegalData | null>(null);
  const [consent, setConsent] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [step, setStep] = useState(0);
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof LegalData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getLegal()
      .then((s) => {
        setD(s.data ?? EMPTY_LEGAL);
        setConsent(s.consent);
        setSaved(s.saved);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Не вдалося завантажити'));
  }, []);

  if (!d) return <ReportStatus loading={!loadError} error={loadError} onRetry={() => router.replace('/legal')} />;

  const steps: LegalStep[] = ['person', 'document', 'address', 'extra'];
  const total = steps.length + 1;
  const current = step < steps.length ? steps[step]! : null;
  const problems = { ...legalProblems(d, kind), ...serverErrors };
  const set = (patch: Partial<LegalData>) => {
    setD({ ...d, ...patch });
    setServerErrors({});
  };
  const err = (k: keyof LegalData) => (touched ? problems[k] : undefined);
  const valid = current ? stepOk(d, kind, current) : consent && Object.keys(legalProblems(d, kind)).length === 0;
  const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ');

  async function next() {
    if (current) {
      if (!valid) return setTouched(true);
      setTouched(false);
      return setStep(step + 1);
    }
    setSaving(true);
    try {
      await saveLegal(d!);
      router.back();
    } catch (e) {
      const fields = e instanceof ApiError ? (e.fields as Partial<Record<keyof LegalData, string>> | undefined) : undefined;
      if (fields) {
        setServerErrors(fields);
        const bad = steps.findIndex((s) => STEP_FIELDS[s].some((k) => fields[k]));
        if (bad >= 0) setStep(bad);
        setTouched(true);
      } else Alert.alert('Не вдалося зберегти', e instanceof Error ? e.message : 'Спробуйте ще раз');
    } finally {
      setSaving(false);
    }
  }

  const remove = () =>
    Alert.alert('Видалити дані для договору?', 'Дані зникнуть із застосунку й з ще непідписаних договорів. У вже підписаних договорах вони лишаються як частина документа.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          void deleteLegal()
            .then(() => router.back())
            .catch((e) => Alert.alert('Не вдалося видалити', e instanceof Error ? e.message : 'Спробуйте ще раз')),
      },
    ]);

  const why = current ? 'Заповніть усі поля цього кроку' : !consent ? 'Підтвердьте згоду, щоб зберегти' : 'Перевірте дані';

  return (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: theme.background }]}>
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
          {current === 'person' ? (
            <>
              <Title text="Хто ви" sub="Ці дані потрібні лише для тексту договору. Їх бачить тільки друга сторона вашої оренди, і лише в самому договорі: не в профілі й не в оголошеннях." />
              <Card style={styles.name}>
                <ThemedText type="caption" themeColor="textSecondary">
                  ПІБ у договорі
                </ThemedText>
                <ThemedText type="headline">{fullName || 'Вкажіть імʼя в «Особисті дані»'}</ThemedText>
              </Card>
              <DateField label="Дата народження" value={d.birthDate} onChange={(birthDate) => set({ birthDate })} placeholder="Оберіть дату" initialDate={new Date(1990, 0, 1)} maximumDate={new Date()} error={err('birthDate')} />
              <NumberField label="РНОКПП (ідентифікаційний код)" value={d.taxId} onChangeValue={(taxId) => set({ taxId })} maxDigits={10} plain placeholder="10 цифр" error={err('taxId')} />
              <Note icon="information-circle-outline" text="РНОКПП потрібен за законом України: без нього договір не матиме повної юридичної сили." />
            </>
          ) : current === 'document' ? (
            <>
              <Title text="Документ, що посвідчує особу" sub="Оберіть тип і перепишіть дані з документа." />
              <ChoiceChips label="Тип документа" options={DOC_TYPES} value={d.docType} onChange={(v) => v && set({ docType: v as LegalData['docType'], docSeries: '', docNumber: '', docIssuer: '', docValidUntil: '' })} />
              {d.docType === 'passport' ? (
                <>
                  <View style={styles.row}>
                    <View style={styles.series}>
                      <Field label="Серія" value={d.docSeries} onChangeText={(t) => set({ docSeries: t.toUpperCase().replace(/[^А-ЯІЇЄҐA-Z]/g, '').slice(0, 2) })} autoCapitalize="characters" placeholder="АА" maxLength={2} error={err('docSeries')} />
                    </View>
                    <View style={styles.flex}>
                      <NumberField label="Номер" value={d.docNumber} onChangeValue={(docNumber) => set({ docNumber })} maxDigits={6} plain placeholder="6 цифр" error={err('docNumber')} />
                    </View>
                  </View>
                  <Field label="Ким виданий" value={d.docIssuer} onChangeText={(docIssuer) => set({ docIssuer })} placeholder="Наприклад, Галицьким РВ ЛМУ УМВС" error={err('docIssuer')} />
                </>
              ) : (
                <>
                  <NumberField label="Номер ID-картки (запис)" value={d.docNumber} onChangeValue={(docNumber) => set({ docNumber })} maxDigits={9} plain placeholder="9 цифр" error={err('docNumber')} />
                  <NumberField label="Орган, що видав" value={d.docIssuer} onChangeValue={(docIssuer) => set({ docIssuer })} maxDigits={4} plain placeholder="4 цифри, наприклад 4601" error={err('docIssuer')} />
                </>
              )}
              <DateField label="Дата видачі" value={d.docIssuedAt} onChange={(docIssuedAt) => set({ docIssuedAt })} maximumDate={new Date()} initialDate={new Date(2018, 0, 1)} error={err('docIssuedAt')} />
              {d.docType === 'id' ? <DateField label="Дійсна до" value={d.docValidUntil} onChange={(docValidUntil) => set({ docValidUntil })} initialDate={new Date()} error={err('docValidUntil')} /> : null}
            </>
          ) : current === 'address' ? (
            <>
              <Title text="Адреса проживання" sub="Повна адреса, як у договорі: місто, вулиця, будинок, квартира." />
              <Field label="Адреса" value={d.address} onChangeText={(address) => set({ address })} multiline placeholder="м. Львів, вул. Зелена, 5, кв. 12" style={{ minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }} error={err('address')} />
            </>
          ) : current === 'extra' ? (
            kind === 'renter' ? (
              <>
                <Title text="Посвідчення водія" sub="Перепишіть серію й номер з посвідчення. Категорії ви вже вказали в профілі." />
                <Field label="Серія й номер" value={d.licenseNumber} onChangeText={(licenseNumber) => set({ licenseNumber: licenseNumber.toUpperCase() })} autoCapitalize="characters" placeholder="ААА 123456" error={err('licenseNumber')} />
                <DateField label="Дата видачі" value={d.licenseIssuedAt} onChange={(licenseIssuedAt) => set({ licenseIssuedAt })} maximumDate={new Date()} initialDate={new Date(2020, 0, 1)} error={err('licenseIssuedAt')} />
                <DateField label="Дійсне до" value={d.licenseValidUntil} onChange={(licenseValidUntil) => set({ licenseValidUntil })} initialDate={new Date()} error={err('licenseValidUntil')} />
              </>
            ) : (
              <>
                <Title text="На якій підставі ви здаєте авто" sub="Договір має містити підставу, за якою ви розпоряджаєтесь авто." />
                <ChoiceChips label="Підстава" options={OWNERSHIPS} value={d.ownership} onChange={(v) => v && set({ ownership: v as LegalData['ownership'] })} />
                {d.ownership === 'proxy' ? (
                  <>
                    <Field label="Номер довіреності" value={d.proxyNumber} onChangeText={(proxyNumber) => set({ proxyNumber })} error={err('proxyNumber')} />
                    <DateField label="Дата довіреності" value={d.proxyDate} onChange={(proxyDate) => set({ proxyDate })} maximumDate={new Date()} initialDate={new Date()} error={err('proxyDate')} />
                    <Field label="Ким посвідчена" value={d.proxyIssuer} onChangeText={(proxyIssuer) => set({ proxyIssuer })} placeholder="Нотаріус, округ" error={err('proxyIssuer')} />
                  </>
                ) : null}
              </>
            )
          ) : (
            <>
              <Title text="Перевірте й збережіть" sub="Усе правильно? Дані підставляться в договір, друкувати й вписувати від руки нічого не доведеться." />
              <Card style={styles.summary}>
                <Row k="ПІБ" v={fullName || '—'} />
                <Row k="Дата народження" v={formatDate(d.birthDate)} />
                <Row k="РНОКПП" v={mask(d.taxId)} />
                <Row k="Документ" v={`${d.docType === 'passport' ? `Паспорт ${d.docSeries}` : 'ID-картка'} ${mask(d.docNumber, 3)}`} />
                <Row k="Адреса" v={d.address} />
                {kind === 'renter' ? <Row k="Посвідчення водія" v={mask(d.licenseNumber.replace(/\s/g, ''), 3)} /> : <Row k="Підстава" v={d.ownership === 'owner' ? 'Власник авто' : `Довіреність № ${d.proxyNumber}`} />}
              </Card>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={styles.consent}>
                <View style={[styles.box, { borderColor: consent ? theme.accent : theme.borderStrong, backgroundColor: consent ? theme.accent : 'transparent' }]}>{consent ? <Icon name="checkmark" size={16} color={theme.onAccent} /> : null}</View>
                <ThemedText type="callout" style={styles.flex}>
                  Погоджуюсь, щоб Kolo зберігало ці дані зашифрованими й підставило їх у договір оренди. Їх бачить лише друга сторона цієї оренди. Видалити дані можна в будь-який час у «Профілі».
                </ThemedText>
              </Pressable>
              <Note icon="lock-closed-outline" text="Ми не передаємо ці дані третім особам і не використовуємо в рекламі." />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button title={current ? 'Далі' : 'Зберегти'} loading={saving} disabled={!!current ? false : !valid} disabledReason={!current && !valid ? why : undefined} onPress={() => void next()} />
        {step > 0 ? <Button title="Назад" variant="tertiary" disabled={saving} onPress={() => setStep(step - 1)} /> : null}
        {step === 0 && saved ? <Button title="Видалити мої дані" variant="tertiary" disabled={saving} onPress={remove} /> : null}
      </View>
    </SafeAreaView>
  );
}

function Title({ text, sub }: { text: string; sub: string }) {
  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="title" accessibilityRole="header">
        {text}
      </ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        {sub}
      </ThemedText>
    </View>
  );
}

function Note({ icon, text }: { icon: 'information-circle-outline' | 'lock-closed-outline'; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: theme.accentSoft }]}>
      <Icon name={icon} size={20} color="accent" />
      <ThemedText type="callout" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.sumRow}>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.sumKey}>
        {k}
      </ThemedText>
      <ThemedText type="callout" style={styles.sumVal}>
        {v}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  body: { padding: Spacing.four, gap: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.three },
  series: { width: 96 },
  name: { gap: 2 },
  note: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, alignItems: 'flex-start' },
  summary: { gap: Spacing.two },
  sumRow: { flexDirection: 'row', gap: Spacing.three },
  sumKey: { width: 120 },
  sumVal: { flex: 1, fontWeight: 600 },
  consent: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start', minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  footer: { padding: Spacing.four, gap: Spacing.two },
});
