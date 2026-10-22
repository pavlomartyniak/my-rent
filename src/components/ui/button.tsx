import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';
import { Icon, type IconName } from './icon';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'positive';
  icon?: IconName;
};

/**
 * Усі кнопки мають заливку або рамку й помітну реакцію на натискання,
 * щоб не зливатися з картками та текстом.
 */
export function Button({ title, variant = 'primary', icon, disabled, style, ...rest }: Props) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';

  const look = {
    primary: { bg: theme.accent, fg: '#FFFFFF', border: theme.accent },
    secondary: { bg: theme.backgroundElement, fg: theme.accent, border: theme.accent },
    positive: { bg: theme.positiveSoft, fg: theme.positive, border: theme.positive },
    danger: { bg: theme.negativeSoft, fg: theme.negative, border: theme.negative },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.button,
        { backgroundColor: look.bg, borderColor: look.border },
        variant === 'primary' && !dark && styles.shadow,
        state.pressed && styles.pressed,
        disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <View style={styles.content}>
        {icon ? <Icon name={icon} size={20} color={look.fg} /> : null}
        <ThemedText type="default" style={[styles.label, { color: look.fg }]}>
          {title}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontWeight: 700 },
  shadow: {
    shadowColor: '#1F5BFF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});
