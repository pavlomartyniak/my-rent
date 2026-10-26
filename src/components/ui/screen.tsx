import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = ScrollViewProps & {
  /** Екран у табах: без хедера, відступи під статус-бар і таб-бар задаємо вручну */
  tabs?: boolean;
  /** Відстань між блоками екрана */
  gap?: number;
};

export function Screen({ tabs, gap = 20, contentContainerStyle, children, ...rest }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // На iOS у екранах з хедером системні відступи додає сам ScrollView (automatic);
  // у табах хедера немає, тому там відступи рахуємо вручну, щоб не подвоювати їх.
  const ios = Platform.OS === 'ios';
  const paddingTop = tabs ? insets.top + Spacing.three : Spacing.three;
  const paddingBottom = tabs
    ? BottomTabInset + insets.bottom + Spacing.three
    : Spacing.five + (ios ? 0 : insets.bottom);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior={tabs ? 'never' : 'automatic'}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // iOS: при відкритій клавіатурі додає знизу відступ і прокручує екран до активного поля, щоб його не закривало
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.content, { paddingTop, paddingBottom }, contentContainerStyle]}
      {...rest}>
      <View style={[styles.inner, { gap }]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingHorizontal: 20 },
  inner: { width: '100%', maxWidth: MaxContentWidth },
});
