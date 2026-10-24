import { useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/components/transaction-form';

export default function NewTransactionScreen() {
  const { carId, dealId, type } = useLocalSearchParams<{ carId?: string; dealId?: string; type?: string }>();
  return <TransactionForm initialCarId={carId} dealId={dealId} initialType={type === 'expense' ? 'expense' : 'income'} />;
}
