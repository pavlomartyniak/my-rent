import { useState } from 'react';
import { View } from 'react-native';

import { useReport } from '@/hooks/use-report';
import type { ReviewState } from '@/lib/profiles';
import { useFleet } from '@/store/fleet';

import { RatingStars } from './rating-stars';
import { ReviewSheet } from './review-sheet';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';

/**
 * Оцінка другої сторони завершеної чи розірваної оренди: кнопка «Оцінити…», а після оцінки — ваша оцінка зірками.
 * Поки оцінити не можна (оренда триває), нічого не показується.
 */
export function ReviewButton({ dealId }: { dealId: string }) {
  const { invalidate } = useFleet();
  const { data, retry } = useReport<ReviewState>(`/reviews/deal/${dealId}`, { refetchOnFocus: true });
  const [open, setOpen] = useState(false);
  if (!data) return null;

  if (data.mine) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ThemedText type="small" themeColor="textSecondary">
          Ваша оцінка: {data.target.role === 'owner' ? 'власник' : 'орендар'}
        </ThemedText>
        <RatingStars value={data.mine.rating} size={16} />
      </View>
    );
  }
  if (!data.eligible) return null;

  return (
    <>
      <Button title={data.target.role === 'owner' ? 'Оцінити власника' : 'Оцінити орендаря'} icon="star-outline" variant="secondary" onPress={() => setOpen(true)} />
      <ReviewSheet
        dealId={dealId}
        state={data}
        visible={open}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          invalidate();
          retry();
        }}
      />
    </>
  );
}
