import { Platform, Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

type Props = ViewProps & {
  /** Уся картка клікабельна: pressed-стан, ripple, роль «кнопка». Вкладені кнопки робіть лише явними вторинними діями. */
  onPress?: () => void;
  /** Підпис для скрінрідера, коли картка натискається */
  label?: string;
  /** flat — без тіні й рамки, для вкладених блоків; raised — з тінню (за замовчуванням) */
  tone?: 'raised' | 'flat';
};

/** Картка-поверхня. Без `onPress` — статичний блок і не виглядає натискним; з ним — уся площа реагує. */
export function Card({ style, onPress, label, tone = 'raised', ...rest }: Props) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';

  const look = [
    styles.card,
    { backgroundColor: tone === 'flat' ? theme.backgroundSelected : theme.backgroundElement, borderColor: tone === 'flat' ? 'transparent' : theme.border },
    tone === 'raised' && !dark && styles.shadow,
  ];

  if (!onPress) return <View style={[look, style]} {...rest} />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: theme.border, foreground: true }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [look, styles.clip, pressed && Platform.OS === 'ios' && styles.pressed, style as object]}
      {...(rest as object)}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, borderWidth: 1 },
  clip: { overflow: 'hidden' },
  shadow: { shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
