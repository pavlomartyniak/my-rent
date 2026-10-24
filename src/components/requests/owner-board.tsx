import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Hint } from '@/components/hint';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';
import { WantedCard } from '@/components/wanted-card';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { plural } from '@/lib/format';
import type { WantedBoard } from '@/lib/wanted';
import { useFleet } from '@/store/fleet';

/** Дошка заявок орендарів «шукаю авто»: власник пропонує своє вільне авто */
export function OwnerBoard() {
  const router = useRouter();
  const { cars } = useFleet();
  const [city, setCity] = useState('');
  const params = new URLSearchParams({ limit: '30' });
  if (city.trim()) params.set('city', city.trim());
  const { data, loading, error, retry } = useReport<WantedBoard>(`/wanted?${params}`, { refetchOnFocus: true, keepPrevious: true });

  const hasFree = cars.some((c) => c.status === 'Вільне');

  return (
    <>
      <Hint id="wanted-board">Орендарі публікують заявки: яке авто, де й на які дати їм потрібно. Запропонуйте своє вільне авто, а орендар вибере найкращу пропозицію.</Hint>

      <SearchInput value={city} onChangeText={setCity} placeholder="Місто, наприклад Київ" />

      {!data ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : data.items.length === 0 ? (
        <EmptyState icon="search-outline" title="Заявок немає" text={city ? 'У цьому місті поки немає відкритих заявок.' : 'Відкритих заявок орендарів зараз немає.'} />
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
