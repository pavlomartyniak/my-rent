import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/** Ідентифікатор панелі «Готово» над цифровою клавіатурою iOS: у неї немає власної кнопки повернення */
export const DONE_BAR_ID = 'kolo-done-bar';

/** Панель з кнопкою «Готово» над цифровою клавіатурою (iOS). Монтується один раз у корені, поля підключають її через inputAccessoryViewID */
export function KeyboardDoneBar() {
  const theme = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_BAR_ID}>
      <View style={[styles.bar, { backgroundColor: theme.backgroundSelected, borderTopColor: theme.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Сховати клавіатуру" onPress={Keyboard.dismiss} hitSlop={8} style={styles.btn}>
          <ThemedText type="headline" themeColor="accent">
            Готово
          </ThemedText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  btn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
});
