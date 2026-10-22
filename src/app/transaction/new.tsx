import { useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/components/transaction-form';

export default function NewTransactionScreen() {
  const { carId, type } = useLocalSearchParams<{ carId?: string; type?: string }>();
  return <TransactionForm initialCarId={carId} initialType={type === 'expense' ? 'expense' : 'income'} />;
}
