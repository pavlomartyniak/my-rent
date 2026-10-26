import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAttention } from '@/hooks/use-attention';

/** Вкладки орендаря: головна з моїми орендами, пошук авто, запити, звіт, профіль */
export default function RenterTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  // Число на «Головній» збігається з числом у блоці «Потрібна ваша увага», на «Запитах» — нові запити чи пропозиції
  const { urgent: home, requests } = useAttention('renter');

  return (
    <NativeTabs backgroundColor={colors.background}
      tintColor={colors.accent} indicatorColor={colors.backgroundElement} // П'ять вкладок: дрібніший підпис, щоб назви не налазили одна на одну
      labelStyle={{ default: { fontSize: 11 }, selected: { fontSize: 11, color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Головна</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        {home > 0 ? <NativeTabs.Trigger.Badge>{home > 99 ? '99+' : String(home)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Пошук</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="requests">
        <NativeTabs.Trigger.Label>Запити</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
        {/* Без пропозицій бейдж не рендериться взагалі */}
        {requests > 0 ? <NativeTabs.Trigger.Badge>{requests > 99 ? '99+' : String(requests)}</NativeTabs.Trigger.Badge> : null}
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
