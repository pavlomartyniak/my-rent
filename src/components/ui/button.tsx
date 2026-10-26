import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';
import { Icon, type IconName } from './icon';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'soft' | 'danger' | 'positive';
  icon?: IconName;
};

/**
 * Усі кнопки мають заливку або рамку й помітну реакцію на натискання,
 * щоб не зливатися з картками та текстом.
 */
export function Button({ title, variant = 'primary', icon, disabled, style, ...rest }: Props) {
  const theme = useTheme();

  const look = {
    primary: { bg: theme.accent, fg: '#FFFFFF', border: theme.accent },
    secondary: { bg: theme.backgroundElement, fg: theme.text, border: theme.ink },
    soft: { bg: theme.backgroundSelected, fg: theme.text, border: 'transparent' },
    positive: { bg: theme.positiveSoft, fg: theme.positive, border: 'transparent' },
    danger: { bg: theme.negativeSoft, fg: theme.negative, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.button,
        { backgroundColor: look.bg, borderColor: look.border },
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
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontWeight: 600 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});
