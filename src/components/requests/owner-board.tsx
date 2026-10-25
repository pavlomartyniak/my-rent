import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { PlaceFilter } from '@/components/place-field';
import type { Place } from '@/lib/places';
import { WantedCard } from '@/components/wanted-card';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { plural } from '@/lib/format';
import type { WantedBoard } from '@/lib/wanted';
import { useFleet } from '@/store/fleet';

const SCOPES = ['Підходять мені', 'Усі'] as const;

/** Дошка заявок орендарів «шукаю авто»: власник пропонує своє вільне авто */
export function OwnerBoard() {
  const router = useRouter();
  const { cars } = useFleet();
  const [place, setPlace] = useState<Place | null>(null);
  const [scope, setScope] = useState<(typeof SCOPES)[number]>(SCOPES[0]);
  const params = new URLSearchParams({ limit: '30' });
  if (scope === SCOPES[1]) params.set('matching', 'false');
  if (place?.city) params.set('city', place.city);
  else if (place?.regionId !== undefined) params.set('regionId', String(place.regionId));
  const { data, loading, error, retry } = useReport<WantedBoard>(`/wanted?${params}`, { refetchOnFocus: true, keepPrevious: true });

  const hasFree = cars.some((c) => c.status === 'Вільне');

  return (
    <>
      <Segmented options={SCOPES} value={scope} onChange={setScope} />
      <PlaceFilter value={place} onChange={setPlace} />

      {!data ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : data.items.length === 0 ? (
        scope === SCOPES[0] ? (
          <EmptyState
            icon="search-outline"
            title="Немає заявок для ваших авто"
            text={
              hasFree
                ? 'Зараз ніхто не шукає авто, яке у вас вільне. Відкрийте всі заявки, щоб побачити попит.'
                : 'Щоб бачити заявки, потрібно мати вільне авто (статус «Вільне»). Відкрийте всі заявки, щоб побачити попит.'
            }
            action="Показати всі заявки"
            onAction={() => setScope(SCOPES[1])}
          />
        ) : (
          <EmptyState icon="search-outline" title="Заявок немає" text={place ? 'У цьому місці поки немає відкритих заявок.' : 'Відкритих заявок орендарів зараз немає.'} />
        )
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Знайдено {data.total} {plural(data.total, 'заявка', 'заявки', 'заявок')}
          </ThemedText>
          <View style={{ gap: Spacing.two }}>
            {data.items.map((w) => (
              <WantedCard key={w.id} wanted={w} viewer="owner">
                {w.myOffer ? (
                  <ThemedText type="smallBold" themeColor="positive">
                    ✓ Ви вже запропонували авто
                  </ThemedText>
                ) : (
                  <Button
                    title="Запропонувати авто"
                    icon="car-sport-outline"
                    disabled={!hasFree}
                    onPress={() => router.push({ pathname: '/wanted/offer', params: { wantedId: w.id } })}
                  />
                )}
              </WantedCard>
            ))}
          </View>
          {!hasFree ? (
            <ThemedText type="small" themeColor="textSecondary">
              Щоб запропонувати авто, воно має мати статус «Вільне».
            </ThemedText>
          ) : null}
        </>
      )}
    </>
  );
}
