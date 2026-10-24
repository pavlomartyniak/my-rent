import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { usePendingRequests, useTerminationRequests } from '@/hooks/use-pending-requests';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  // Нові запити орендарів і пропозиції розірвати оренду, що чекають відповіді
  const pending = usePendingRequests() + useTerminationRequests().length;

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      // П'ять вкладок у плаваючому таб-барі: дрібніший підпис і короткі назви, щоб вони не налазили одна на одну
      labelStyle={{ default: { fontSize: 11 }, selected: { fontSize: 11, color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Авто</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'car', selected: 'car.fill' }} md="directions_car" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Label>Звіт</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="requests">
        <NativeTabs.Trigger.Label>Запити</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
        {/* Без запитів бейдж не рендериться взагалі: порожній текст або hidden на частині платформ лишає кружечок */}
        {pending > 0 ? <NativeTabs.Trigger.Badge>{pending > 99 ? '99+' : String(pending)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reminders">
        <NativeTabs.Trigger.Label>Терміни</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} md="notifications" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Профіль</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
