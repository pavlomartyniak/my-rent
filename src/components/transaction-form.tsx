import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { todayISO } from '@/lib/date';
import { useFleet } from '@/store/fleet';
import { EXPENSE_CATEGORIES, INCOME_CATEGORY, RENTER_EXPENSE_CATEGORIES, RENTER_INCOME_CATEGORY, type Transaction, type TransactionType } from '@/types';

import { CarPicker } from './car-picker';
import { Hint } from './hint';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { DateField } from './ui/date-field';
import { Field } from './ui/field';
import { Screen } from './ui/screen';
import { Segmented } from './ui/segmented';

const TYPES = ['Дохід', 'Витрата'] as const;
const RENTER_TYPES = ['Заробіток', 'Витрата'] as const;

type Props = {
  /** Існуючий запис для редагування */
  tx?: Transaction;
  initialCarId?: string;
  initialType?: TransactionType;
  /** Облік орендаря: запис належить його оренді */
  dealId?: string;
};

export function TransactionForm({ tx, initialCarId, initialType, dealId: dealParam }: Props) {
  const router = useRouter();
  const { cars, addTransaction, updateTransaction, deleteTransaction } = useFleet();

  const [carId, setCarId] = useState(tx?.carId ?? initialCarId ?? cars[0]?.id);
  const dealId = tx?.dealId ?? dealParam;
  const renter = !!dealId;
  const types: readonly string[] = renter ? RENTER_TYPES : TYPES;
  const expenseCategories: readonly string[] = renter ? RENTER_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES;
  const [kind, setKind] = useState<string>((tx?.type ?? initialType ?? 'income') === 'income' ? types[0] : 'Витрата');
  const [category, setCategory] = useState<string>(expenseCategories.find((c) => c === tx?.category) ?? expenseCategories[0]);
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '');
  const [date, setDate] = useState(tx?.date ?? todayISO());
  const [note, setNote] = useState(tx?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const type: TransactionType = kind === 'Витрата' ? 'expense' : 'income';
  const amountError = Number(amount) > 0 ? '' : 'Вкажіть суму';

  async function onSave() {
    if (saving) return;
    setSubmitted(true);
    if ((!renter && !carId) || amountError) return;
    const data = {
      // Власник вказує авто, орендар — оренду (її запис змінити не можна)
      ...(renter ? (tx ? {} : { dealId }) : { carId }),
      type,
      amount: Number(amount),
      date,
      category: type === 'income' ? (renter ? RENTER_INCOME_CATEGORY : INCOME_CATEGORY) : category,
      driver: !renter && type === 'income' ? (cars.find((c) => c.id === carId)?.driver ?? '') : '',
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
      {!tx ? (
        renter ? (
          <Hint id="tx-form-renter">«Заробіток» — гроші, які ви отримали з цим авто (таксі, перевезення). «Витрата» — усе, що ви платите: оренда власнику, паливо, мийка. Прибуток порахується сам.</Hint>
        ) : (
          <Hint id="tx-form">Оберіть «Дохід» (оренда) або «Витрата» і введіть суму. Прибуток і ROI порахуються самі.</Hint>
        )
      ) : null}
      <Segmented options={types} value={kind} onChange={setKind} />

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

      {!renter && cars.length > 1 ? <CarPicker value={carId} onChange={setCarId} /> : null}

      {type === 'expense' ? (
        <View style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary">
            На що
          </ThemedText>
          <Segmented options={expenseCategories} value={category} onChange={setCategory} />
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
