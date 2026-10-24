import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { usePendingOffers, useTerminationRequests } from '@/hooks/use-pending-requests';

/** Вкладки орендаря: пошук авто, запити, моя оренда з обліком, звіт, налаштування */
export default function RenterTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  // Пропозиції власників і пропозиції розірвати оренду, що чекають відповіді
  const offers = usePendingOffers() + useTerminationRequests().length;

  return (
    <NativeTabs backgroundColor={colors.background} indicatorColor={colors.backgroundElement} // П'ять вкладок: дрібніший підпис, щоб назви не налазили одна на одну
      labelStyle={{ default: { fontSize: 11 }, selected: { fontSize: 11, color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Пошук</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="requests">
        <NativeTabs.Trigger.Label>Запити</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
        {/* Без пропозицій бейдж не рендериться взагалі */}
        {offers > 0 ? <NativeTabs.Trigger.Badge>{offers > 99 ? '99+' : String(offers)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="rentals">
        <NativeTabs.Trigger.Label>Оренда</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'car', selected: 'car.fill' }} md="directions_car" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="report">
        <NativeTabs.Trigger.Label>Звіт</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Профіль</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
