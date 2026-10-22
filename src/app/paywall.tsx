import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useFleet } from '@/store/fleet';
import { FREE_CAR_LIMIT, PRO_CAR_LIMIT, PRO_PRICE } from '@/types';

const FEATURES = [`До ${PRO_CAR_LIMIT} авто замість ${FREE_CAR_LIMIT}`, 'Експорт для звітності', 'Резервна копія в хмарі'];

export default function PaywallScreen() {
  const router = useRouter();
  const { setPro, isPro } = useFleet();

  return (
    <Screen>
      <ThemedText type="subtitle">Pro · {PRO_PRICE}/міс</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        У безкоштовному тарифі можна вести {FREE_CAR_LIMIT} авто.
      </ThemedText>

      <Card style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f} style={styles.feature}>
            <Icon name="checkmark-circle" size={22} color="positive" />
            <ThemedText type="default">{f}</ThemedText>
          </View>
        ))}
      </Card>

      <Button
        title={isPro ? 'Pro вже активний' : 'Активувати Pro (демо)'}
        disabled={isPro}
        onPress={async () => {
          if (await setPro(true)) router.back();
        }}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Оплату ще не підключено — це демо для перевірки сценаріїв.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  features: { gap: Spacing.three },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
