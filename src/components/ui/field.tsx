import type { ComponentRef, Ref } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { DONE_BAR_ID } from '../keyboard-done';
import { ThemedText } from '../themed-text';

type Props = TextInputProps & { label: string; error?: string; ref?: Ref<ComponentRef<typeof TextInput>> };

const NUMERIC = ['number-pad', 'decimal-pad', 'numeric', 'phone-pad'];

export function Field({ label, error, style, ...rest }: Props) {
  const theme = useTheme();
  // Цифрова клавіатура iOS не має кнопки повернення: додаємо над нею панель «Готово»
  const needsDone = Platform.OS === 'ios' && !rest.multiline && NUMERIC.includes(rest.keyboardType ?? '');

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" themeColor="text">
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: error ? theme.negative : theme.borderStrong },
          style,
        ]}
        inputAccessoryViewID={needsDone ? DONE_BAR_ID : undefined}
        // Клавіша повернення в однорядковому полі ховає клавіатуру (підпис «Готово»); у багаторядковому вона додає новий рядок
        returnKeyType={rest.multiline ? undefined : 'done'}
        {...rest}
      />
      {error ? (
        <ThemedText type="small" themeColor="negative">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  input: {
    minHeight: 54,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    // Явні вертикальні відступи замість покладання на авто-центрування: текст і плейсхолдер стоять рівно посередині в усіх полях
    paddingVertical: 16,
    textAlignVertical: 'center',
    fontSize: Type.body.fontSize,
    letterSpacing: 0,
  },
});
