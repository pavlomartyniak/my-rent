import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { CarPhoto } from '@/components/car-photo';
import { RatingLine } from '@/components/rating-stars';
import { ReportSheet } from '@/components/report-sheet';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { InfoGrid } from '@/components/ui/info-rows';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { monthTitle } from '@/lib/date';
import { formatMoney, initials } from '@/lib/format';
import { confirmBlock, type ReportTarget } from '@/lib/moderation';
import type { ProfileView } from '@/lib/profiles';
import { useFleet } from '@/store/fleet';

/**
 * Профіль власника чи орендаря: ім'я, місто, рейтинг, статистика, контакти (лише стороні оренди) і вільні авто власника.
 * До домовленості видно лише «Ім'я П.», рейтинг і вільні авто: повне ім'я, телефон і пошта відкриваються після оренди.
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
  const since = data.memberSince ? monthTitle(data.memberSince.slice(0, 7)) : null;
  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => Alert.alert('Не вдалося відкрити набір номера', `Номер: ${phone}`));
  const mail = (email: string) => Linking.openURL(`mailto:${email}`).catch(() => Alert.alert('Не вдалося відкрити пошту', email));

  return (
    <Screen>
      <Stack.Screen options={{ title: owner ? 'Власник' : 'Орендар', headerBackTitle: 'Назад' }} />

      <Card style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
          <ThemedText style={styles.avatarText} themeColor="accent">
            {initials(data.name)}
          </ThemedText>
        </View>
        <ThemedText type="subtitle" style={styles.center}>
          {data.name}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {owner ? 'Власник авто' : 'Орендар'}
          </ThemedText>
        </View>
        <RatingLine rating={data.rating} size={18} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {[data.city, since ? `На Kolo з ${since.toLowerCase()}` : null].filter(Boolean).join(' · ')}
        </ThemedText>
      </Card>

      {data.rating.tags.length ? (
        <View style={styles.tags}>
          {data.rating.tags.map((t) => (
            <View key={t.tag} style={[styles.tag, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="smallBold" themeColor="accent">
                {t.tag} · {t.count}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      <InfoGrid
        items={[
          { label: 'Завершених оренд', value: String(data.stats.completedDeals) },
          { label: 'Активних оренд', value: String(data.stats.activeDeals) },
        ]}
      />

      <SectionHeader title="Контакти" />
      {data.contact ? (
        <Card style={styles.contacts}>
          {data.contact.phone ? (
            <Pressable accessibilityRole="button" onPress={() => call(data.contact!.phone!)} style={styles.contact}>
              <Icon name="call-outline" size={20} color="accent" />
              <View style={styles.flex}>
                <ThemedText type="small" themeColor="textSecondary">
                  Телефон
                </ThemedText>
                <ThemedText type="default" style={styles.bold}>
                  {data.contact.phone}
                </ThemedText>
              </View>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => mail(data.contact!.email)} style={styles.contact}>
            <Icon name="mail-outline" size={20} color="accent" />
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                Пошта
              </ThemedText>
              <ThemedText type="default" style={styles.bold}>
                {data.contact.email}
              </ThemedText>
            </View>
          </Pressable>
        </Card>
      ) : (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Повне ім’я, телефон і пошта відкриваються після домовленості: коли між вами з’явиться оренда.
          </ThemedText>
        </Card>
      )}

      {owner ? (
        <>
          <SectionHeader title="Вільні авто" />
          {data.cars.length === 0 ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Зараз немає вільних авто в оголошеннях.
              </ThemedText>
            </Card>
          ) : (
            <View style={{ gap: Spacing.two }}>
              {data.cars.map((c) => (
                <Card key={c.id} style={styles.carCard}>
                  <Pressable accessibilityRole={myRole === 'renter' ? 'button' : undefined} disabled={myRole !== 'renter'} onPress={() => router.push({ pathname: '/market/[id]', params: { id: c.id } })} style={styles.car}>
                    <CarPhoto uri={c.photoUri ?? undefined} style={styles.carPhoto} iconSize={24} />
                    <View style={styles.flex}>
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
                    {myRole === 'renter' ? <Icon name="chevron-forward" size={18} color="textSecondary" /> : null}
                  </Pressable>
                </Card>
              ))}
            </View>
          )}
        </>
      ) : null}

      {data.self ? null : (
        <View style={{ gap: Spacing.two }}>
          <Button title="Поскаржитись на користувача" icon="flag-outline" variant="secondary" onPress={() => setReporting({ kind: 'user', userId: data.id })} />
          <Button title="Заблокувати користувача" icon="ban-outline" variant="danger" onPress={() => confirmBlock({ userId: data.id }, data.name, () => router.back())} />
        </View>
      )}
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, lineHeight: 36, fontWeight: 700 },
  center: { textAlign: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.pill },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  contacts: { gap: Spacing.three },
  contact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  bold: { fontWeight: 600 },
  carCard: { padding: Spacing.two + 2 },
  car: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  carPhoto: { width: 64, height: 64, borderRadius: Radius.md },
});
