import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { todayISO } from '@/lib/date';
import { useFleet } from '@/store/fleet';
import { EXPENSE_CATEGORIES, INCOME_CATEGORY, type Transaction, type TransactionType } from '@/types';

import { CarPicker } from './car-picker';
import { Hint } from './hint';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { DateField } from './ui/date-field';
import { Field } from './ui/field';
import { Screen } from './ui/screen';
import { Segmented } from './ui/segmented';

const TYPES = ['Дохід', 'Витрата'] as const;

type Props = {
  /** Існуючий запис для редагування */
  tx?: Transaction;
  initialCarId?: string;
  initialType?: TransactionType;
};

export function TransactionForm({ tx, initialCarId, initialType }: Props) {
  const router = useRouter();
  const { cars, addTransaction, updateTransaction, deleteTransaction } = useFleet();

  const [carId, setCarId] = useState(tx?.carId ?? initialCarId ?? cars[0]?.id);
  const [kind, setKind] = useState<(typeof TYPES)[number]>((tx?.type ?? initialType ?? 'income') === 'income' ? 'Дохід' : 'Витрата');
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>(
    EXPENSE_CATEGORIES.find((c) => c === tx?.category) ?? EXPENSE_CATEGORIES[0],
  );
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '');
  const [date, setDate] = useState(tx?.date ?? todayISO());
  const [note, setNote] = useState(tx?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const type: TransactionType = kind === 'Дохід' ? 'income' : 'expense';
  const amountError = Number(amount) > 0 ? '' : 'Вкажіть суму';

  async function onSave() {
    if (saving) return;
    setSubmitted(true);
    if (!carId || amountError) return;
    const data = {
      carId,
      type,
      amount: Number(amount),
      date,
      category: type === 'income' ? INCOME_CATEGORY : category,
      driver: type === 'income' ? (cars.find((c) => c.id === carId)?.driver ?? '') : '',
      note: note.trim(),
    };
    setSaving(true);
    const ok = await (tx ? updateTransaction(tx.id, data) : addTransaction(data));
    setSaving(false);
    if (ok) router.back();
  }

  function onDelete() {
    if (!tx) return;
    Alert.alert('Видалити запис?', 'Цю дію не можна скасувати.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          if (await deleteTransaction(tx.id)) router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      {!tx ? <Hint id="tx-form">Оберіть «Дохід» (оренда) або «Витрата» і введіть суму. Прибуток і ROI порахуються самі.</Hint> : null}
      <Segmented options={TYPES} value={kind} onChange={setKind} />

      <Field
        label="Сума, ₴"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        error={submitted ? amountError : undefined}
        autoFocus={!tx}
        style={styles.amount}
      />

      {cars.length > 1 ? <CarPicker value={carId} onChange={setCarId} /> : null}

      {type === 'expense' ? (
        <View style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary">
            На що
          </ThemedText>
          <Segmented options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} />
        </View>
      ) : null}

      <DateField label="Дата" value={date} onChange={setDate} />
      <Field label="Примітка (необов'язково)" value={note} onChangeText={setNote} />

      <Button title={saving ? 'Зберігаємо…' : 'Зберегти'} disabled={saving} onPress={onSave} />
      {tx ? <Button title="Видалити запис" variant="danger" onPress={onDelete} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 28, fontWeight: 700, minHeight: 64 },
  group: { gap: Spacing.one },
});
