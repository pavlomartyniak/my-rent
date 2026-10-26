import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Лічильник біля варіанта; 0 чи відсутній — не показується */
  badges?: Partial<Record<T, number>>;
  /** Один рядок, що гортається вбік, замість перенесення на другий */
  scroll?: boolean;
};

export function Segmented<T extends string>({ options, value, onChange, badges, scroll }: Props<T>) {
  const theme = useTheme();

  const Wrap = scroll ? ScrollView : View;
  const wrapProps = scroll ? { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.scrollRow, style: styles.scroll } : { style: styles.row };

  return (
    <Wrap {...(wrapProps as object)}>
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
                backgroundColor: selected ? theme.ink : theme.backgroundElement,
                borderColor: selected ? theme.ink : theme.borderStrong,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: selected ? theme.onInk : theme.text }}>
              {option}
            </ThemedText>
            {badges?.[option] ? (
              <View style={[styles.badge, { backgroundColor: selected ? theme.onInk : theme.accent }]}>
                <ThemedText type="smallBold" style={[styles.badgeText, { color: selected ? theme.ink : '#ffffff' }]}>
                  {badges[option]}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </Wrap>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginHorizontal: -20 },
  scrollRow: { gap: Spacing.two, paddingHorizontal: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 38,
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
