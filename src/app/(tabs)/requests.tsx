import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CurrentRentals } from '@/components/current-rentals';
import { OwnerArchive } from '@/components/requests/owner-archive';
import { OwnerBoard } from '@/components/requests/owner-board';
import { OwnerOffers } from '@/components/requests/owner-offers';
import { OwnerRentals } from '@/components/requests/owner-rentals';
import { ScreenTitle } from '@/components/screen-title';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented } from '@/components/ui/segmented';
import { useAttention } from '@/hooks/use-attention';

const SECTIONS = ['Активні', 'Запити', 'Заявки орендарів', 'Архів'] as const;
type Section = (typeof SECTIONS)[number];
const FROM_PARAM: Record<string, Section> = { requests: 'Запити', wanted: 'Заявки орендарів', offers: 'Заявки орендарів', archive: 'Архів' };

/**
 * «Оренди» власника: усе про здачу авто в одному місці. Активні оренди, нові запити, заявки орендарів
 * «шукаю авто» з моїми пропозиціями й архів. Гроші — у «Доходах», авто — у «Авто».
 */
export default function RentalsScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const { requests } = useAttention('owner');
  // `?section=` відкриває потрібний сегмент (з чату чи з блоку «Потрібна ваша увага»); власний вибір діє, доки параметр той самий
  const [pick, setPick] = useState<{ param?: string; section: Section }>();
  const section: Section = pick && pick.param === params.section ? pick.section : (FROM_PARAM[params.section ?? ''] ?? 'Активні');

  return (
    <Screen tabs>
      <ScreenTitle>Оренди</ScreenTitle>
      <Segmented scroll options={SECTIONS} value={section} onChange={(s) => setPick({ param: params.section, section: s })} badges={{ Запити: requests }} />

      {section === 'Активні' ? (
        <CurrentRentals />
      ) : section === 'Запити' ? (
        <OwnerRentals />
      ) : section === 'Заявки орендарів' ? (
        <>
          <OwnerBoard />
          <SectionHeader title="Мої пропозиції" />
          <OwnerOffers />
        </>
      ) : (
        <OwnerArchive />
      )}
    </Screen>
  );
}
