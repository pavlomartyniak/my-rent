import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl } from 'react-native';

import { RenterRentals } from '@/components/requests/renter-rentals';
import { RenterWanted } from '@/components/requests/renter-wanted';
import { ScreenTitle } from '@/components/screen-title';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { usePendingOffers } from '@/hooks/use-pending-requests';
import { useFleet } from '@/store/fleet';

const SECTIONS = ['Запити на авто', 'Шукаю авто'] as const;
type Section = (typeof SECTIONS)[number];

/** Мої запити на оголошення й мої заявки «шукаю авто» з пропозиціями власників */
export default function MyRequestsScreen() {
  const { invalidate } = useFleet();
  const offers = usePendingOffers();
  const params = useLocalSearchParams<{ tab?: string }>();
  // `?tab=wanted` відкриває «Шукаю авто» (після створення); власний вибір діє, доки параметр той самий
  const [pick, setPick] = useState<{ param?: string; section: Section }>();
  const section: Section = pick && pick.param === params.tab ? pick.section : params.tab === 'wanted' ? 'Шукаю авто' : 'Запити на авто';

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={false} onRefresh={invalidate} />}>
      <ScreenTitle>Мої запити</ScreenTitle>
      <Segmented options={SECTIONS} value={section} onChange={(s) => setPick({ param: params.tab, section: s })} badges={{ 'Шукаю авто': offers }} />

      {section === 'Запити на авто' ? <RenterRentals /> : <RenterWanted />}
    </Screen>
  );
}
