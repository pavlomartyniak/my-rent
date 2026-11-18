import { View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { EmptyState } from './ui/empty-state';
import { CardSkeleton, ListSkeleton, SummarySkeleton } from './ui/skeleton';

type Props = {
  loading: boolean;
  error?: string;
  onRetry: () => void;
  /** Форма каркаса: `summary` — цифра й картка (звіти), `list` — рядки (чати, історія) */
  shape?: 'summary' | 'list';
};

/** Замість контенту: skeleton під час завантаження або помилка з поясненням і повтором */
export function ReportStatus({ loading, error, onRetry, shape = 'summary' }: Props) {
  if (error) {
    return <EmptyState icon="cloud-offline-outline" title="Не вдалося завантажити дані" text={`${error}. Перевірте інтернет і спробуйте ще раз.`} action="Спробувати ще раз" onAction={onRetry} />;
  }
  if (!loading) return null;
  if (shape === 'list') return <ListSkeleton />;
  return (
    <View style={{ gap: Spacing.three }}>
      <SummarySkeleton />
      <CardSkeleton />
    </View>
  );
}
