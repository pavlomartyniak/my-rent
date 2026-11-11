import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { todayISO } from '@/lib/date';

import { ThemedText } from './themed-text';
import { DateField } from './ui/date-field';
import { Field } from './ui/field';

/** Посвідчення водія, яке вводить користувач: серія, номер, строк дії (YYYY-MM-DD; порожньо — не обрано) */
export type LicenseDraft = { series: string; number: string; validUntil: string };

export const EMPTY_LICENSE: LicenseDraft = { series: '', number: '', validUntil: '' };

/** Скільки полів заповнено: жодного, частково чи всі (серія, номер, строк дії) */
export function licenseFill(l: LicenseDraft): 'empty' | 'partial' | 'full' {
  const filled = [l.series.trim(), l.number.trim(), l.validUntil].filter(Boolean).length;
  return filled === 0 ? 'empty' : filled === 3 ? 'full' : 'partial';
}

/** Поля посвідчення водія: серія, номер і строк дії. Використовуються в профілі та при реєстрації */
export function LicenseFields({ value, onChange, errors }: { value: LicenseDraft; onChange: (next: LicenseDraft) => void; /** Помилки полів (series, number, validUntil), що підсвічуються червоним */ errors?: Partial<Record<keyof LicenseDraft, string>> }) {
  const set = (patch: Partial<LicenseDraft>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.wrap}>
      <Field label="Серія" value={value.series} onChangeText={(v) => set({ series: v.toUpperCase() })} autoCapitalize="characters" autoCorrect={false} maxLength={3} placeholder="ААА" error={errors?.series} />
      <Field label="Номер" value={value.number} onChangeText={(v) => set({ number: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={6} placeholder="6 цифр" error={errors?.number} />
      <DateField label="Діє до" value={value.validUntil || todayISO()} onChange={(iso) => set({ validUntil: iso })} minimumDate={new Date()} error={errors?.validUntil} />
      <ThemedText type="small" themeColor="textSecondary">
        {value.validUntil ? 'Посвідчення має діяти до кінця оренди, інакше запит не надіслати.' : 'Дату не обрано: торкніться поля й оберіть, до якого числа діє посвідчення.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
});
