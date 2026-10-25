import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { OwnerBoard } from '@/components/requests/owner-board';
import { OwnerOffers } from '@/components/requests/owner-offers';
import { OwnerRentals } from '@/components/requests/owner-rentals';
import { ScreenTitle } from '@/components/screen-title';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';

const SECTIONS = ['Запити', 'Шукають авто', 'Мої пропозиції'] as const;

/** Усе, що стосується орендарів: запити на мої авто, їхні заявки «шукаю авто» й мої пропозиції */
export default function RequestsScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  // `?section=offers` відкриває «Мої пропозиції» (перехід з чату); власний вибір діє, доки параметр той самий
  const [pick, setPick] = useState<{ param?: string; section: (typeof SECTIONS)[number] }>();
  const section = pick && pick.param === params.section ? pick.section : params.section === 'offers' ? SECTIONS[2] : SECTIONS[0];
  const setSection = (s: (typeof SECTIONS)[number]) => setPick({ param: params.section, section: s });

  return (
    <Screen tabs>
      <ScreenTitle>Запити</ScreenTitle>
      <Segmented options={SECTIONS} value={section} onChange={setSection} />

      {section === 'Запити' ? <OwnerRentals /> : section === 'Шукають авто' ? <OwnerBoard /> : <OwnerOffers />}
    </Screen>
  );
}
