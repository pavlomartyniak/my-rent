import { useMemo } from 'react';
import { View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useFleet } from '@/store/fleet';

import { ThemedText } from './themed-text';
import { Segmented } from './ui/segmented';

/** Вибір авто зі списку; однакові назви розрізняються по VIN */
export function CarPicker({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const { cars } = useFleet();

  const labels = useMemo(() => {
    const names = cars.map((c) => `${c.brand} ${c.model}`);
    return cars.map((c, i) =>
      names.filter((n) => n === names[i]).length > 1 ? `${names[i]} …${c.vin.slice(-4)}` : names[i],
    );
  }, [cars]);

  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="small" themeColor="textSecondary">
        Авто
      </ThemedText>
      <Segmented
        options={labels}
        value={labels[cars.findIndex((c) => c.id === value)] ?? ''}
        onChange={(label) => onChange(cars[labels.indexOf(label)].id)}
      />
    </View>
  );
}
