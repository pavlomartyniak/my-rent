import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

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

  // Виконана заявка з чинною орендою вже на «Головній»; тут лишаються відкриті, скасовані й завершені
  const live = (w: WantedView) => w.status === 'fulfilled' && (w.dealStage === 'signing' || w.dealStage === 'upcoming' || w.dealStage === 'active');
  const list = data.filter((w) => !live(w));

  return (
    <>
      <Button title="Шукаю авто" icon="add" onPress={() => router.push('/wanted/new')} />
      {list.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Ви ще нічого не шукаєте" text="Не знайшли потрібне авто серед оголошень? Створіть заявку, і власники самі запропонують варіанти." />
      ) : (
        <View style={{ gap: Spacing.three }}>
          {[...list].sort((a, b) => (b.offers?.pending ?? 0) - (a.offers?.pending ?? 0)).map((w) => (
            <Pressable key={w.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/wanted/[id]', params: { id: w.id } })}>
              <WantedCard wanted={w} viewer="renter" />
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}
