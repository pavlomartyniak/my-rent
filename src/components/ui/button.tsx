import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { MinHit, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

import { ThemedText } from '../themed-text';
import { Icon, type IconName } from './icon';

type Props = Omit<PressableProps, 'children'> & {
  /** Дієслово з результатом: «Орендувати за 2 400 ₴», а не «Далі» */
  title: string;
  /**
   * primary — головна дія екрана (одна на екран); secondary — рівноцінна друга; soft — другорядна;
   * tertiary — текстова дія без заливки; danger/dangerSolid — руйнівні; positive/positiveSolid — підтвердження
   */
  variant?: 'primary' | 'secondary' | 'soft' | 'tertiary' | 'danger' | 'positive' | 'positiveSolid' | 'dangerSolid';
  icon?: IconName;
  /** Спінер замість іконки; ширина кнопки не стрибає, повторні натискання блокуються */
  loading?: boolean;
  /** Чому кнопка недоступна: показується під нею, щоб користувач знав, що виправити */
  disabledReason?: string;
  /** Висота 44 замість 52 для вторинних дій у щільних блоках */
  compact?: boolean;
};

/** Вібровідгук за видом кнопки: головні дії — легкий дотик, руйнівні — попередження */
const FEEDBACK = { danger: haptic.warning, dangerSolid: haptic.warning } as const;

export function Button({ title, variant = 'primary', icon, disabled, loading, disabledReason, compact, style, onPress, ...rest }: Props) {
  const theme = useTheme();
  const off = disabled || loading;

  const look = {
    primary: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    secondary: { bg: theme.backgroundElement, fg: theme.text, border: theme.borderStrong },
    soft: { bg: theme.backgroundSelected, fg: theme.text, border: 'transparent' },
    tertiary: { bg: 'transparent', fg: theme.accent, border: 'transparent' },
    positive: { bg: theme.positiveSoft, fg: theme.positive, border: 'transparent' },
    danger: { bg: theme.negativeSoft, fg: theme.negative, border: 'transparent' },
    positiveSolid: { bg: theme.positive, fg: theme.onInk, border: theme.positive },
    dangerSolid: { bg: theme.negative, fg: theme.onInk, border: theme.negative },
  }[variant];

  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      hitSlop={compact ? 4 : 0}
      android_ripple={{ color: `${look.fg}22`, foreground: true }}
      onPress={(e) => {
        (FEEDBACK[variant as keyof typeof FEEDBACK] ?? haptic.tap)();
        onPress?.(e);
      }}
      style={(state) => [
        styles.button,
        { minHeight: compact ? MinHit : 52, backgroundColor: look.bg, borderColor: look.border },
        state.pressed && Platform.OS === 'ios' && styles.pressed,
        disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={look.fg} /> : icon ? <Icon name={icon} size={20} color={look.fg} /> : null}
        <ThemedText type="headline" style={[styles.label, { color: look.fg }]} numberOfLines={2}>
          {title}
        </ThemedText>
      </View>
    </Pressable>
  );

  if (!disabled || !disabledReason) return button;
  return (
    <View style={styles.reasonWrap}>
      {button}
      <ThemedText type="caption" themeColor="textSecondary" style={styles.reason}>
        {disabledReason}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  label: { textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  reasonWrap: { gap: Spacing.one },
  reason: { textAlign: 'center' },
});
