import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Лічильник біля варіанта; 0 чи відсутній — не показується */
  badges?: Partial<Record<T, number>>;
};

export function Segmented<T extends string>({ options, value, onChange, badges }: Props<T>) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.accent : theme.backgroundElement,
                borderColor: selected ? theme.accent : theme.borderStrong,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: selected ? '#ffffff' : theme.text }}>
              {option}
            </ThemedText>
            {badges?.[option] ? (
              <View style={[styles.badge, { backgroundColor: selected ? '#ffffff' : theme.accent }]}>
                <ThemedText type="smallBold" style={[styles.badgeText, { color: selected ? theme.accent : '#ffffff' }]}>
                  {badges[option]}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 13, lineHeight: 16 },
});
