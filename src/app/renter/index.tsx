import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { ActiveDealCard } from '@/components/active-deal-card';
import { AttentionList } from '@/components/attention-list';
import { RenterArchive } from '@/components/requests/renter-archive';
import { RenterRentals } from '@/components/requests/renter-rentals';
import { RenterWanted } from '@/components/requests/renter-wanted';
import { ReportStatus } from '@/components/report-status';
import { ScreenTitle } from '@/components/screen-title';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Spacing } from '@/constants/theme';
import { usePendingOffers } from '@/hooks/use-pending-requests';
import { useReport } from '@/hooks/use-report';
import { dealStage, type DealView } from '@/lib/deals';
import { useFleet } from '@/store/fleet';

const SECTIONS = ['Активні', 'Запити', 'Шукаю авто', 'Архів'] as const;
type Section = (typeof SECTIONS)[number];
const FROM_PARAM: Record<string, Section> = { requests: 'Запити', wanted: 'Шукаю авто', archive: 'Архів' };

/**
 * «Оренди» орендаря: усе про авто, які я беру, в одному місці. Активні оренди, мої запити власникам,
 * заявки «шукаю авто» й архів — сегменти одного екрана. Гроші — у «Доходах».
 */
export default function RenterRentalsScreen() {
  const router = useRouter();
  const { invalidate } = useFleet();
  const offers = usePendingOffers();
  const params = useLocalSearchParams<{ section?: string }>();
  // `?section=` відкриває потрібний сегмент (після створення запиту, з чату); власний вибір діє, доки параметр той самий
  const [pick, setPick] = useState<{ param?: string; section: Section }>();
  const section: Section = pick && pick.param === params.section ? pick.section : (FROM_PARAM[params.section ?? ''] ?? 'Активні');
  const deals = useReport<DealView[]>('/deals', { refetchOnFocus: true });

  const current = (deals.data ?? []).filter((d) => dealStage(d) !== 'finished' && dealStage(d) !== 'terminated');
  const hasPast = (deals.data?.length ?? 0) > current.length;

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={false} onRefresh={invalidate} />}>
      <ScreenTitle>Оренди</ScreenTitle>

      <AttentionList role="renter" />

      <Segmented scroll options={SECTIONS} value={section} onChange={(s) => setPick({ param: params.section, section: s })} badges={{ 'Шукаю авто': offers }} />

      {section === 'Активні' ? (
        !deals.data ? (
          <ReportStatus loading={deals.loading} error={deals.error} onRetry={deals.retry} />
        ) : current.length === 0 ? (
          <EmptyState
            icon="car-outline"
            title="Оренди ще немає"
            text="Знайдіть вільне авто й надішліть запит. Коли власник його прийме, оренда з’явиться тут: з договором, платежами й чатом."
            action="Знайти авто"
            onAction={() => router.navigate('/renter/search')}
          />
        ) : (
          <>
            <View style={{ gap: Spacing.three }}>
              {current.map((d) => (
                <ActiveDealCard key={d.id} deal={d} />
              ))}
            </View>
            <Button title="Знайти ще авто" icon="search" variant="soft" onPress={() => router.navigate('/renter/search')} />
          </>
        )
      ) : section === 'Запити' ? (
        <RenterRentals />
      ) : section === 'Шукаю авто' ? (
        <RenterWanted />
      ) : (
        <RenterArchive />
      )}

      {section === 'Активні' && hasPast ? <Button title="Завершені оренди" icon="albums-outline" variant="tertiary" onPress={() => router.push('/rentals/archive')} /> : null}
    </Screen>
  );
}
