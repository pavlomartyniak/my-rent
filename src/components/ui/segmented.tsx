import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { haptic } from '@/lib/haptics';

import { ThemedText } from '../themed-text';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Лічильник біля варіанта; 0 чи відсутній — не показується */
  badges?: Partial<Record<T, number>>;
  /** Спокійний лічильник у підписі («Запити 2»): просто кількість, без вимоги дії. Червоний бейдж — лише для того, що чекає на користувача */
  counts?: Partial<Record<T, number>>;
  /** Один рядок, що гортається вбік, замість перенесення на другий */
  scroll?: boolean;
};

export function Segmented<T extends string>({ options, value, onChange, badges, counts, scroll }: Props<T>) {
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
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => {
              if (!selected) haptic.select();
              onChange(option);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.ink : theme.backgroundElement,
                borderColor: selected ? theme.ink : theme.borderStrong,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: selected ? theme.onInk : theme.text }}>
              {option}
              {counts?.[option] ? (
                <ThemedText type="smallBold" style={{ color: selected ? theme.onInk : theme.textSecondary, opacity: selected ? 0.75 : 1 }}>{`  ${counts[option]}`}</ThemedText>
              ) : null}
            </ThemedText>
            {badges?.[option] ? (
              // Лічильник сидить на верхньому куті кнопки, а не в рядку з назвою: так видно число, і кнопка не розтягується
              <View style={[styles.badge, { backgroundColor: theme.negative, borderColor: theme.background }]} accessibilityLabel={`${badges[option]}`}>
                <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onInk }]}>
                  {badges[option]! > 99 ? '99+' : badges[option]}
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
  // Верхній відступ лишає місце лічильнику над кнопкою, інакше горизонтальна прокрутка його обрізала б
  scroll: { flexGrow: 0, marginHorizontal: -20, marginTop: -Spacing.one },
  scrollRow: { gap: Spacing.two, paddingHorizontal: 20, paddingTop: Spacing.two, paddingRight: 28 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingTop: Spacing.one },
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
  badge: { position: 'absolute', top: -8, right: -6, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: Radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...Type.caption },
});
