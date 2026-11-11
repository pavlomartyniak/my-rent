import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayISO } from '@/lib/date';
import { LICENSE_CATEGORIES } from '@/lib/legal-profile';

import { ThemedText } from './themed-text';
import { DateField } from './ui/date-field';
import { Field } from './ui/field';

/** Посвідчення водія, яке вводить користувач: серія, номер, категорії, строк дії (YYYY-MM-DD; порожньо — не обрано) */
export type LicenseDraft = { series: string; number: string; categories: string[]; validUntil: string };

export const EMPTY_LICENSE: LicenseDraft = { series: '', number: '', categories: [], validUntil: '' };

/** Скільки полів заповнено: жодного, частково чи всі (за всіма чотирма пунктами) */
export function licenseFill(l: LicenseDraft): 'empty' | 'partial' | 'full' {
  const filled = [l.series.trim(), l.number.trim(), l.categories.length, l.validUntil].filter(Boolean).length;
  return filled === 0 ? 'empty' : filled === 4 ? 'full' : 'partial';
}

/** Поля посвідчення водія: серія, номер, категорії й строк дії. Використовуються в профілі та при реєстрації */
export function LicenseFields({ value, onChange }: { value: LicenseDraft; onChange: (next: LicenseDraft) => void }) {
  const theme = useTheme();
  const set = (patch: Partial<LicenseDraft>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.wrap}>
      <Field label="Серія" value={value.series} onChangeText={(v) => set({ series: v.toUpperCase() })} autoCapitalize="characters" autoCorrect={false} maxLength={3} placeholder="ААА" />
      <Field label="Номер" value={value.number} onChangeText={(v) => set({ number: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={6} placeholder="6 цифр" />
      <DateField label="Діє до" value={value.validUntil || todayISO()} onChange={(iso) => set({ validUntil: iso })} minimumDate={new Date()} />
      <ThemedText type="small" themeColor="textSecondary">
        {value.validUntil ? 'Посвідчення має діяти до кінця оренди, інакше запит не надіслати.' : 'Дату не обрано: торкніться поля й оберіть, до якого числа діє посвідчення.'}
      </ThemedText>
      <View style={styles.wrap}>
        <ThemedText type="smallBold">Категорії</ThemedText>
        <View style={styles.chips}>
          {LICENSE_CATEGORIES.map((c) => {
            const on = value.categories.includes(c);
            return (
              <Pressable
                key={c}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => set({ categories: on ? value.categories.filter((x) => x !== c) : [...value.categories, c] })}
                style={[styles.chip, { backgroundColor: on ? theme.ink : theme.backgroundElement, borderColor: on ? theme.ink : theme.borderStrong }]}>
                <ThemedText type="smallBold" style={{ color: on ? theme.onInk : theme.text }}>
                  {c}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
