import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl } from 'react-native';

import { RenterRentals } from '@/components/requests/renter-rentals';
import { RenterWanted } from '@/components/requests/renter-wanted';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { useFleet } from '@/store/fleet';

const SECTIONS = ['Запити на авто', 'Мої заявки'] as const;
type Section = (typeof SECTIONS)[number];

/** Мої запити на оголошення й мої заявки «шукаю авто» з пропозиціями власників */
export default function MyRequestsScreen() {
  const { invalidate } = useFleet();
  const params = useLocalSearchParams<{ tab?: string }>();
  // `?tab=wanted` відкриває «Мої заявки» (після створення заявки); власний вибір діє, доки параметр той самий
  const [pick, setPick] = useState<{ param?: string; section: Section }>();
  const section: Section = pick && pick.param === params.tab ? pick.section : params.tab === 'wanted' ? 'Мої заявки' : 'Запити на авто';

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={false} onRefresh={invalidate} />}>
      <ThemedText type="subtitle">Мої запити</ThemedText>
      <Segmented options={SECTIONS} value={section} onChange={(s) => setPick({ param: params.tab, section: s })} />

      {section === 'Запити на авто' ? <RenterRentals /> : <RenterWanted />}
    </Screen>
  );
}
