import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { CarPicker } from '@/components/car-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { todayISO } from '@/lib/date';
import { useFleet } from '@/store/fleet';
import { REMINDER_KINDS, type ReminderKind } from '@/types';

export default function NewReminderScreen() {
  const router = useRouter();
  const { carId: paramCarId } = useLocalSearchParams<{ carId?: string }>();
  const { cars, addReminder } = useFleet();

  const [carId, setCarId] = useState(paramCarId ?? cars[0]?.id);
  const [kind, setKind] = useState<ReminderKind>('ТО');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const other = kind === 'Інше';

  async function onSave() {
    if (!carId || saving) return;
    setSubmitted(true);
    if (other && !note.trim()) return;
    setSaving(true);
    const ok = await addReminder({ carId, kind, date, ...(other ? { note: note.trim() } : {}) });
    setSaving(false);
    if (ok) router.back();
  }

  return (
    <Screen>
      <CarPicker value={carId} onChange={setCarId} />
      <Segmented options={REMINDER_KINDS} value={kind} onChange={setKind} />
      {other ? <Field label="Що нагадати" value={note} onChangeText={setNote} placeholder="Наприклад, заміна шин" maxLength={60} error={submitted && !note.trim() ? 'Вкажіть, що саме нагадати' : undefined} autoFocus /> : null}
      <DateField label="Дата" value={date} onChange={setDate} minimumDate={new Date()} />
      <Button title={saving ? 'Зберігаємо…' : 'Створити'} icon="checkmark" disabled={saving} onPress={onSave} />
    </Screen>
  );
}
