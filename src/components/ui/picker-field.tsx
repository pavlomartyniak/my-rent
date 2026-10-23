import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';
import { Icon } from './icon';

type Props = {
  label: string;
  /** Обране значення; порожнє — показуємо placeholder */
  value?: string;
  placeholder: string;
  onPress: () => void;
  error?: string;
  /** Підказка під полем, коли немає помилки */
  hint?: string;
  disabled?: boolean;
};

/** Поле, яке не редагується вручну, а відкриває список вибору */
export function PickerField({ label, value, placeholder, onPress, error, hint, disabled }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.box,
          { backgroundColor: theme.backgroundElement, borderColor: error ? theme.negative : theme.borderStrong },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}>
        <ThemedText type="default" themeColor={value ? 'text' : 'textSecondary'} style={styles.text} numberOfLines={1}>
          {value || placeholder}
        </ThemedText>
        <Icon name="chevron-down" size={20} color="accent" />
      </Pressable>
      {error ? (
        <ThemedText type="small" themeColor="negative">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  box: {
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: { flex: 1, fontWeight: 600 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
