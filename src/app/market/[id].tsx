import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroButton } from '@/components/hero-button';
import { ReportSheet } from '@/components/report-sheet';
import { PhotoGallery } from '@/components/photo-gallery';
import { PhotoViewer } from '@/components/photo-viewer';
import { ReportStatus } from '@/components/report-status';
import { SpecChip } from '@/components/spec-chip';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { formatKm, formatMoney, initials } from '@/lib/format';
import { confirmBlock } from '@/lib/moderation';
import type { MarketCar } from '@/lib/rentals';

/** Оголошення: фото, умови й закріплена внизу кнопка «Надіслати запит» */
export default function MarketCarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [viewer, setViewer] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { data: car, loading, error, retry } = useReport<MarketCar>(`/market/cars/${id}`, { useCache: false });

  if (!car) {
    return (
      <Screen>
        {error?.includes('недоступне') || error?.includes('не знайдено') ? (
          <EmptyState icon="car-outline" title="Оголошення вже недоступне" text="Власник зняв його з публікації або авто здали." action="До пошуку" onAction={() => router.dismissTo('/renter/search')} />
        ) : (
          <ReportStatus loading={loading} error={error} onRetry={retry} />
        )}
      </Screen>
    );
  }

  const photos = car.photos?.length ? car.photos : car.photoUri ? [car.photoUri] : [];
  const hasDeposit = car.deposit > 0;

  return (
    <View style={styles.root}>
      {/* Фото йде під прозорий хедер на всю ширину, тож системні відступи й бічні поля Screen скасовуємо; знизу місце під закріплену кнопку */}
      <Screen contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 0, paddingBottom: 200 + insets.bottom }}>
        <Stack.Screen
          options={{
            title: '',
            headerTransparent: true,
            headerBackVisible: false,
            headerLeft: () => <HeroButton icon="chevron-back" label="Назад" onPress={() => router.back()} />,
            headerRight: () => (photos.length > 0 ? <HeroButton icon="expand-outline" label="Фото на весь екран" onPress={() => setViewer(true)} /> : null),
          }}
        />

        <View style={styles.hero}>
          <PhotoGallery photos={photos} bleed />
        </View>

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle" style={[styles.title, styles.flex]} numberOfLines={2}>
              {car.brand} {car.model}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {car.year}
            </ThemedText>
          </View>
          <View style={styles.chips}>
            {car.city ? <SpecChip white icon="location-outline" text={car.city} /> : null}
            {car.fuel ? <SpecChip white icon="color-fill-outline" text={car.fuel} /> : null}
            {car.mileage ? <SpecChip white icon="speedometer-outline" text={formatKm(car.mileage)} /> : null}
          </View>
        </View>

        <Card style={styles.card}>
          <View style={styles.price}>
            <ThemedText style={styles.priceValue} themeColor="accent">
              {formatMoney(car.pricePerDay)}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              за добу
            </ThemedText>
          </View>

          <View style={[styles.deposit, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.depositIcon, { backgroundColor: theme.backgroundElement }]}>
              <Icon name={hasDeposit ? 'shield-outline' : 'shield-checkmark-outline'} size={22} color="accent" />
            </View>
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.bold}>
                {hasDeposit ? `Застава ${formatMoney(car.deposit)}` : 'Без застави'}
              </ThemedText>
              {hasDeposit ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Вноситься разом із першою оплатою й повертається після оренди
                </ThemedText>
              ) : null}
            </View>
          </View>

          <View style={styles.owner}>
            <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="smallBold" themeColor="accent">
                {initials(car.owner)}
              </ThemedText>
            </View>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                Власник
              </ThemedText>
              <ThemedText type="default" style={styles.bold}>
                {car.owner}
              </ThemedText>
            </View>
          </View>
        </Card>

        {car.description ? (
          <Card style={styles.card}>
            <ThemedText type="default" style={styles.heading}>
              Опис
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {car.description}
            </ThemedText>
          </Card>
        ) : null}

        <View style={styles.safety}>
          <Pressable accessibilityRole="button" onPress={() => setReporting(true)} style={({ pressed }) => [styles.safetyLink, pressed && { opacity: 0.6 }]}>
            <Icon name="flag-outline" size={16} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary">
              Поскаржитись на оголошення
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => confirmBlock({ carId: car.id }, car.owner, () => router.back())}
            style={({ pressed }) => [styles.safetyLink, pressed && { opacity: 0.6 }]}>
            <Icon name="ban-outline" size={16} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary">
              Заблокувати власника
            </ThemedText>
          </Pressable>
        </View>

        {car.myRequest ? (
          <Card style={styles.card}>
            <ThemedText type="default" style={styles.bold} themeColor="positive">
              ✓ Запит уже надіслано
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Власник ще не відповів. Повторно надсилати запит не потрібно. Відповідь і контакти з’являться у вкладці «Запити». Якщо передумали, скасуйте запит там.
            </ThemedText>
          </Card>
        ) : null}
      </Screen>

      <View style={[styles.footer, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
        {car.myRequest ? (
          <Button title="Мої запити" icon="file-tray-outline" variant="secondary" onPress={() => router.navigate('/renter/requests')} />
        ) : (
          <>
            <Button title="Надіслати запит на оренду" icon="paper-plane-outline" onPress={() => router.push({ pathname: '/market/request', params: { carId: car.id } })} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Запит нічого не бронює: власник прийме його або відхилить. Контакти відкриються після підтвердження.
            </ThemedText>
          </>
        )}
      </View>

      <ReportSheet target={reporting ? { kind: 'listing', carId: car.id } : null} onClose={() => setReporting(false)} />
      {viewer ? <PhotoViewer photos={photos} startIndex={0} onClose={() => setViewer(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Фото на всю ширину екрана: скасовуємо бічні поля Screen
  hero: { marginHorizontal: -20 },
  // Лист із назвою заходить на фото закругленим верхом (мінус проміжок між блоками й сам захід)
  sheet: { marginHorizontal: -20, marginTop: -48, paddingHorizontal: 20, paddingTop: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 30, lineHeight: 36 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  safety: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, justifyContent: 'center', paddingVertical: Spacing.two },
  safetyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.one },
  card: { gap: Spacing.three, padding: Spacing.four, borderRadius: 28 },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  priceValue: { fontSize: 36, lineHeight: 44, fontWeight: 700, letterSpacing: -0.5 },
  deposit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.md, padding: Spacing.three },
  depositIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  owner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  heading: { fontWeight: 700, fontSize: 20 },
  // Кнопка закріплена внизу, щоб головна дія завжди була під рукою
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: Spacing.three, gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  note: { textAlign: 'center' },
});
