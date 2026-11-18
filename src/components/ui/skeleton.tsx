import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Card } from './card';

/** Сіра плашка, що ледь пульсує: повторює форму майбутнього контенту замість спінера */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: DimensionValue; height?: number; radius?: number; style?: ViewStyle }) {
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    let off = false;
    // Без анімації, якщо в системі ввімкнено «Зменшити рух»
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!off && !reduce) opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
    });
    return () => {
      off = true;
    };
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected }, animated, style]} />;
}

/** Каркас картки з фото, назвою й двома рядками: для списків авто, оренд і запитів */
export function CardSkeleton() {
  return (
    <Card accessibilityLabel="Завантаження" accessibilityRole="progressbar" style={styles.card}>
      <Skeleton height={140} radius={Radius.md} />
      <Skeleton width="60%" height={20} />
      <Skeleton width="85%" />
    </Card>
  );
}

/** Каркас картки з головною цифрою: для підсумків доходів */
export function SummarySkeleton() {
  return (
    <Card accessibilityLabel="Завантаження" accessibilityRole="progressbar" style={styles.card}>
      <Skeleton width="35%" />
      <Skeleton width="60%" height={44} radius={10} />
      <View style={styles.row}>
        <Skeleton height={48} radius={Radius.md} style={styles.half} />
        <Skeleton height={48} radius={Radius.md} style={styles.half} />
      </View>
    </Card>
  );
}

/** Каркас списку рядків «кружечок + два рядки»: чати, історія, заблоковані, вибір авто */
export function ListSkeleton({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <View accessibilityLabel="Завантаження" accessibilityRole="progressbar" style={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.listRow}>
          {avatar ? <Skeleton width={48} height={48} radius={24} /> : null}
          <View style={styles.listText}>
            <Skeleton width="55%" height={16} />
            <Skeleton width="80%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three, alignSelf: 'stretch', width: '100%' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  listText: { flex: 1, gap: Spacing.two },
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  half: { flex: 1 },
});
