import { useEffect, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Лічильник поруч із назвою */
  counts?: Partial<Record<T, number>>;
};

/**
 * Перемикач розділів на всю ширину в стилі iOS: сірий трек, а обраний розділ — біла «таблетка», що плавно
 * їде під текстом. Лічильники стоять поруч із назвами. Розділи рівні за шириною, щоб не стрибали при перемиканні.
 */
export function SwitchTabs<T extends string>({ options, value, onChange, counts }: Props<T>) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.indexOf(value));
  const [x] = useState(() => new Animated.Value(index));

  useEffect(() => {
    Animated.timing(x, { toValue: index, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, x]);

  const inner = Math.max(0, width - PAD * 2);
  const segment = inner / options.length;

  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {width > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            { width: segment, backgroundColor: dark ? theme.borderStrong : '#FFFFFF', transform: [{ translateX: Animated.multiply(x, segment) }] },
            !dark && styles.thumbShadow,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option === value;
        const count = counts?.[option];
        return (
          <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option)} style={styles.tab}>
            <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'} numberOfLines={1}>
              {option}
            </ThemedText>
            {count !== undefined ? (
              <View style={[styles.count, { backgroundColor: selected ? theme.ink : theme.borderStrong }]}>
                <ThemedText type="smallBold" style={[styles.countText, { color: selected ? theme.onInk : '#FFFFFF' }]}>
                  {count}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const PAD = 4;

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.pill, padding: PAD },
  thumb: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: Radius.pill },
  thumbShadow: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40 },
  count: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, lineHeight: 15 },
});
