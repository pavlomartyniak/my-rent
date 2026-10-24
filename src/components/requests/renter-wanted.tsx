import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Hint } from '@/components/hint';
import { ReportStatus } from '@/components/report-status';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { WantedCard } from '@/components/wanted-card';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import type { WantedView } from '@/lib/wanted';

/** Мої заявки «шукаю авто»: тап відкриває пропозиції власників */
export function RenterWanted() {
  const router = useRouter();
  const { data, loading, error, retry } = useReport<WantedView[]>('/wanted/mine', { refetchOnFocus: true });

  if (!data) return <ReportStatus loading={loading} error={error} onRetry={retry} />;

  return (
    <>
      <Hint id="my-wanted">Опишіть, яке авто вам потрібно, і власники запропонують свої. Торкніться заявки, щоб переглянути пропозиції й прийняти найкращу.</Hint>
      <Button title="Створити заявку" icon="add" onPress={() => router.push('/wanted/new')} />
      {data.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Заявок ще немає" text="Не знайшли потрібне авто серед оголошень? Створіть заявку, і власники самі запропонують варіанти." />
      ) : (
        <View style={{ gap: Spacing.two }}>
          {data.map((w) => (
            <Pressable key={w.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/wanted/[id]', params: { id: w.id } })}>
              <WantedCard wanted={w} viewer="renter" />
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}
