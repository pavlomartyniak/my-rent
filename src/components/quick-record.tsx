import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { useAddTransaction } from './transaction-sheet';
import { Button } from './ui/button';

/** Дві кнопки швидкого запису («Дохід», «Витрата») на картці активної оренди: відкривають нижній лист із підставленим авто чи орендою */
export function QuickRecord({ carId, dealId }: { carId?: string; dealId?: string }) {
  const add = useAddTransaction();
  return (
    <View style={styles.row}>
      <Button title="Дохід" icon="add" variant="positive" compact style={styles.flex} onPress={() => add({ type: 'income', carId, dealId })} />
      <Button title="Витрата" icon="remove" variant="danger" compact style={styles.flex} onPress={() => add({ type: 'expense', carId, dealId })} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
