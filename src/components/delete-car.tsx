import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { useFleet } from '@/store/fleet';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';

/** Видалення авто разом з його записами, нагадуваннями, оголошенням і запитами; з підтвердженням */
export function DeleteCar({ carId, name, rented }: { carId: string; name: string; /** Авто зараз в оренді: видалити не можна */ rented?: boolean }) {
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

  if (rented) {
    return (
      <View style={{ gap: Spacing.one }}>
        <Button title="Видалити авто" icon="trash-outline" variant="danger" disabled onPress={() => {}} />
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Авто в оренді, тому його не можна видалити. Спершу завершіть чи розірвіть оренду.
        </ThemedText>
      </View>
    );
  }

  return <Button title="Видалити авто" icon="trash-outline" variant="danger" onPress={confirm} />;
}
