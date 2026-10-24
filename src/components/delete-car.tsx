import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useFleet } from '@/store/fleet';

import { Button } from './ui/button';

/** Видалення авто разом з його записами, нагадуваннями, оголошенням і запитами; з підтвердженням */
export function DeleteCar({ carId, name }: { carId: string; name: string }) {
  const router = useRouter();
  const { deleteCar } = useFleet();

  const confirm = () =>
    Alert.alert(`Видалити «${name}»?`, 'Разом з авто видаляться всі його доходи, витрати, нагадування, оголошення й запити орендарів. Цю дію не можна скасувати.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          if (await deleteCar(carId)) router.dismissAll();
        },
      },
    ]);

  return <Button title="Видалити авто" icon="trash-outline" variant="danger" onPress={confirm} />;
}
