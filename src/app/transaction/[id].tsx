import { useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/components/transaction-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { useFleet } from '@/store/fleet';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tx = useFleet().transactions.find((t) => t.id === id);

  if (!tx) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Запис не знайдено" />
      </Screen>
    );
  }
  return <TransactionForm tx={tx} />;
}
