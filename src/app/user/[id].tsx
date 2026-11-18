import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { CarPhoto } from '@/components/car-photo';
import { RatingLine } from '@/components/rating-stars';
import { ReportSheet } from '@/components/report-sheet';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, plural } from '@/lib/format';
import { confirmBlock, type ReportTarget } from '@/lib/moderation';
import { PURPOSE_LABELS } from '@/lib/profile';
import type { ProfileView } from '@/lib/profiles';
import { useFleet } from '@/store/fleet';

const BADGE_ICON: Record<ProfileView['badges'][number]['key'], IconName> = { top: 'ribbon', experienced: 'shield-checkmark', new: 'sparkles' };

/** Плитка підсумку: велике значення й підпис */
function Stat({ value, label, icon }: { value: string; label: string; icon?: IconName }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.statValue}>
        {icon ? <Icon name={icon} size={18} color="#F5A623" /> : null}
        <ThemedText style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Рядок «іконка — підпис — значення» в картці відомостей */
function Detail({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.detail}>
      <View style={[styles.detailIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} size={18} color="accent" />
      </View>
      <View style={styles.flex}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        {children}
      </View>
    </View>
  );
}

/**
 * Профіль власника чи орендаря: фото, ім'я, позначки, рейтинг, про себе, відомості (стаж, місто, мета оренди),
 * що кажуть інші (теги), контакти (лише стороні оренди) і вільні авто власника.
 * До домовленості видно лише «Ім'я П.»: повне ім'я, телефон і пошта відкриваються після оренди.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { role: myRole } = useFleet();
  const { data, loading, error, retry } = useReport<ProfileView>(`/users/${id}/profile`, { refetchOnFocus: true });
  const [reporting, setReporting] = useState<ReportTarget | null>(null);

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Профіль', headerBackTitle: 'Назад' }} />
        {error ? <EmptyState icon="person-outline" title="Профіль недоступний" text={error} /> : <ReportStatus loading={loading} error={error} onRetry={retry} />}
      </Screen>
    );
  }

  const owner = data.role === 'owner';
  const years = data.drivingSince ? new Date().getFullYear() - data.drivingSince : null;
  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => Alert.alert('Не вдалося відкрити набір номера', `Номер: ${phone}`));
  const mail = (email: string) => Linking.openURL(`mailto:${email}`).catch(() => Alert.alert('Не вдалося відкрити пошту', email));
  const hasDetails = !!data.city || years !== null || data.purposes.length > 0;

  return (
    <Screen contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 0 }}>
      <Stack.Screen options={{ title: '', headerTransparent: true, headerBackTitle: 'Назад' }} />

      {/* Шапка на всю ширину: м'який фон, фото, ім'я, позначки й рейтинг */}
      <View style={[styles.hero, { backgroundColor: theme.accentSoft }]}>
        <Avatar uri={data.photoUri} name={data.name} size={112} />
        <ThemedText type="subtitle" style={styles.center}>
          {data.name}
        </ThemedText>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {owner ? 'Власник авто' : 'Орендар'}
            </ThemedText>
          </View>
          {data.badges.map((b) => (
            <View key={b.key} style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
              <Icon name={BADGE_ICON[b.key]} size={14} color="accent" />
              <ThemedText type="smallBold" themeColor="accent">
                {b.title}
              </ThemedText>
            </View>
          ))}
        </View>
        <RatingLine rating={data.rating} size={18} />
        {data.city ? (
          <View style={styles.badges}>
            <Icon name="location-outline" size={15} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary">
              {data.city}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat value={data.rating.avg !== null ? data.rating.avg.toFixed(1).replace('.', ',') : '—'} label={data.rating.count ? `${data.rating.count} ${plural(data.rating.count, 'оцінка', 'оцінки', 'оцінок')}` : 'Оцінок немає'} icon="star" />
        <Stat value={String(data.stats.completedDeals)} label={plural(data.stats.completedDeals, 'оренда', 'оренди', 'оренд')} />
        <Stat value={data.memberSince ? data.memberSince.slice(0, 4) : '—'} label="На Kolo з" />
      </View>

      {data.about ? (
        <>
          <SectionHeader title="Про себе" />
          <Card>
            <ThemedText type="default">{data.about}</ThemedText>
          </Card>
        </>
      ) : null}

      {hasDetails ? (
        <>
          <SectionHeader title="Відомості" />
          <Card style={styles.details}>
            {years !== null ? (
              <Detail icon="speedometer-outline" label="Стаж водіння">
                <ThemedText type="default" style={styles.bold}>
                  {years > 0 ? `${years} ${plural(years, 'рік', 'роки', 'років')}` : 'Менше року'} · з {data.drivingSince}
                </ThemedText>
              </Detail>
            ) : null}
            {data.city ? (
              <Detail icon="location-outline" label="Місто">
                <ThemedText type="default" style={styles.bold}>
                  {data.city}
                </ThemedText>
              </Detail>
            ) : null}
            {data.purposes.length ? (
              <Detail icon="car-sport-outline" label="Орендує для">
                <View style={styles.chips}>
                  {data.purposes.map((p) => (
                    <View key={p} style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="smallBold">{PURPOSE_LABELS[p]}</ThemedText>
                    </View>
                  ))}
                </View>
              </Detail>
            ) : null}
          </Card>
        </>
      ) : null}

      {data.rating.tags.length ? (
        <>
          <SectionHeader title="Що кажуть інші" />
          <View style={styles.chips}>
            {data.rating.tags.map((t) => (
              <View key={t.tag} style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t.tag} · {t.count}
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Контакти" />
      {data.contact ? (
        <Card style={styles.details}>
          {data.contact.phone ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Зателефонувати: ${data.contact.phone}`} onPress={() => call(data.contact!.phone!)} style={styles.detail}>
              <View style={[styles.detailIcon, { backgroundColor: theme.positiveSoft }]}>
                <Icon name="call" size={18} color="positive" />
              </View>
              <View style={styles.flex}>
                <ThemedText type="small" themeColor="textSecondary">
                  Телефон
                </ThemedText>
                <ThemedText type="default" style={styles.bold}>
                  {data.contact.phone}
                </ThemedText>
              </View>
              <Icon name="chevron-forward" size={18} color="textSecondary" />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Написати листа: ${data.contact.email}`} onPress={() => mail(data.contact!.email)} style={styles.detail}>
            <View style={[styles.detailIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="mail" size={18} color="accent" />
            </View>
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                Пошта
              </ThemedText>
              <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                {data.contact.email}
              </ThemedText>
            </View>
            <Icon name="chevron-forward" size={18} color="textSecondary" />
          </Pressable>
        </Card>
      ) : (
        <Card style={styles.locked}>
          <Icon name="lock-closed-outline" size={20} color="textSecondary" />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Повне ім’я, телефон і пошта відкриваються після домовленості: коли між вами з’явиться оренда.
          </ThemedText>
        </Card>
      )}

      {owner ? (
        <>
          <SectionHeader title={data.cars.length ? `Вільні авто · ${data.cars.length}` : 'Вільні авто'} />
          {data.cars.length === 0 ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Зараз немає вільних авто в оголошеннях.
              </ThemedText>
            </Card>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carRow} style={styles.carScroll}>
              {data.cars.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole={myRole === 'renter' ? 'button' : undefined}
                  disabled={myRole !== 'renter'}
                  onPress={() => router.push({ pathname: '/market/[id]', params: { id: c.id } })}
                  style={[styles.car, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <CarPhoto uri={c.photoUri ?? undefined} style={styles.carPhoto} iconSize={32} />
                  <View style={styles.carBody}>
                    <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                      {c.title} {c.year}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {c.city}
                      {c.deposit ? ` · застава ${formatMoney(c.deposit)}` : ' · без застави'}
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor="positive">
                      {formatMoney(c.pricePerDay)} <ThemedText type="small" themeColor="textSecondary">/доба</ThemedText>
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </>
      ) : null}

      {data.self ? null : (
        <View style={styles.safety}>
          <Pressable accessibilityRole="button" onPress={() => setReporting({ kind: 'user', userId: data.id })} style={styles.safetyItem}>
            <Icon name="flag-outline" size={18} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary">
              Поскаржитись
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => confirmBlock({ userId: data.id }, data.name, () => router.back())} style={styles.safetyItem}>
            <Icon name="ban-outline" size={18} color="negative" />
            <ThemedText type="small" themeColor="negative">
              Заблокувати
            </ThemedText>
          </Pressable>
        </View>
      )}
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Шапка на всю ширину екрана: скасовуємо бічні поля Screen і заходимо під прозорий хедер
  hero: { marginHorizontal: -20, alignItems: 'center', gap: Spacing.two, paddingTop: 110, paddingBottom: Spacing.four, paddingHorizontal: Spacing.four, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  center: { textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.pill },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.three, paddingHorizontal: Spacing.two, alignItems: 'center', gap: 2 },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNumber: { ...Type.title },
  details: { gap: Spacing.three },
  detail: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  detailIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: 600 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  locked: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  // Горизонтальна стрічка авто виходить за бічні поля екрана, щоб прокручуватись до краю
  carScroll: { marginHorizontal: -20 },
  carRow: { paddingHorizontal: 20, gap: Spacing.three },
  car: { width: 240, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  carPhoto: { width: '100%', height: 140, borderRadius: 0 },
  carBody: { padding: Spacing.three, gap: 2 },
  safety: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.five, paddingVertical: Spacing.three },
  safetyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
