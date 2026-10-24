import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { EmptyState } from './ui/empty-state';

type Props = { loading: boolean; error?: string; onRetry: () => void };

/** Замість звіту: індикатор завантаження або помилка з повтором */
export function ReportStatus({ loading, error, onRetry }: Props) {
  const theme = useTheme();

  if (error) {
    return <EmptyState icon="cloud-offline-outline" title="Не вдалося завантажити звіт" text={error} action="Спробувати ще раз" onAction={onRetry} />;
  }
  if (!loading) return null;
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.six },
});
