import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Смужка «дохід / витрати» однієї довжини: зелена частка доходу, червона витрат */
export function SplitBar({ income, expense }: { income: number; expense: number }) {
  const theme = useTheme();
  const total = income + expense;
  const share = total > 0 ? (income / total) * 100 : 0;
  return (
    <View style={[styles.bar, { backgroundColor: total > 0 ? theme.negative : theme.backgroundSelected }]}>
      <View style={{ width: `${share}%`, height: 6, backgroundColor: theme.positive }} />
    </View>
  );
}

const styles = StyleSheet.create({ bar: { height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' } });
