import { useState } from 'react';

import { OwnerBoard } from '@/components/requests/owner-board';
import { OwnerOffers } from '@/components/requests/owner-offers';
import { OwnerRentals } from '@/components/requests/owner-rentals';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';

const SECTIONS = ['Запити', 'Заявки орендарів', 'Мої пропозиції'] as const;

/** Усе, що стосується орендарів: запити на мої авто, їхні заявки «шукаю авто» й мої пропозиції */
export default function RequestsScreen() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>('Запити');

  return (
    <Screen tabs>
      <ThemedText type="subtitle">Оренда</ThemedText>
      <Segmented options={SECTIONS} value={section} onChange={setSection} />

      {section === 'Запити' ? <OwnerRentals /> : section === 'Заявки орендарів' ? <OwnerBoard /> : <OwnerOffers />}
    </Screen>
  );
}
