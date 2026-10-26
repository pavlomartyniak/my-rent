import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Обов'язковий підпис для скрінрідерів */
  label: string;
  tone?: 'accent' | 'negative' | 'neutral';
  size?: number;
};

/** Кругла кнопка з іконкою: заливка + рамка, щоб було видно, що її можна натиснути */
export function IconButton({ icon, label, tone = 'accent', size = 40, disabled, ...rest }: Props) {
  const theme = useTheme();
  const look = {
    accent: { bg: theme.backgroundSelected, border: 'transparent', fg: 'text' },
    negative: { bg: theme.negativeSoft, border: 'transparent', fg: 'negative' },
    neutral: { bg: theme.backgroundElement, border: theme.border, fg: 'textSecondary' },
  }[tone] as { bg: string; border: string; fg: 'accent' };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, backgroundColor: look.bg, borderColor: look.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={look.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.3 },
});
