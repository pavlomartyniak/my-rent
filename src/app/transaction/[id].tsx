import { useLocalSearchParams } from 'expo-router';

import { ReportStatus } from '@/components/report-status';
import { TransactionForm } from '@/components/transaction-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { useReport } from '@/hooks/use-report';
import type { Transaction } from '@/types';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Без кешу: форма стартує зі свіжих даних, а не зі збереженої попередньої версії запису
  const { data: tx, loading, error, retry } = useReport<Transaction>(`/transactions/${id}`, { useCache: false });

  if (!tx) {
    return (
      <Screen>
        {error === 'Запис не знайдено' ? (
          <EmptyState icon="alert-circle-outline" title="Запис не знайдено" />
        ) : (
          <ReportStatus loading={loading} error={error} onRetry={retry} />
        )}
      </Screen>
    );
  }
  return <TransactionForm tx={tx} />;
}
