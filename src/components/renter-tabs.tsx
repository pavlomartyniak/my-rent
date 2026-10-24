import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/** Вкладки орендаря: пошук авто, запити, моя оренда з обліком, звіт, налаштування */
export default function RenterTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs backgroundColor={colors.background} indicatorColor={colors.backgroundElement} // П'ять вкладок: дрібніший підпис, щоб назви не налазили одна на одну
      labelStyle={{ default: { fontSize: 10 }, selected: { fontSize: 10, color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Пошук</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="requests">
        <NativeTabs.Trigger.Label>Запити</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
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
        <NativeTabs.Trigger.Label>Налаштування</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
