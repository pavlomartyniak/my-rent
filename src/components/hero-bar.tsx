import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

/**
 * Кнопки поверх фото екрана (назад, редагувати, на весь екран). Власний шар під вирізом, а не кнопки системного хедера:
 * на нових iOS системний хедер загортає кожну кнопку у власну капсулу із заливкою, яка обрізає й дублює наше коло.
 * Шар не перехоплює дотики поза кнопками, тож фото під ним гортається як звичайно.
 */
export function HeroBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.bar, { paddingTop: insets.top + Spacing.one }]}>
      <View pointerEvents="box-none">{left}</View>
      <View pointerEvents="box-none" style={styles.right}>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  right: { flexDirection: 'row', gap: Spacing.two },
});
