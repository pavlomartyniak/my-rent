import { useLocalSearchParams } from 'expo-router';

import { CarForm } from '@/components/car-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { useFleet } from '@/store/fleet';

export default function EditCarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const car = useFleet().cars.find((c) => c.id === id);

  if (!car) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Авто не знайдено" />
      </Screen>
    );
  }
  return <CarForm car={car} />;
}
