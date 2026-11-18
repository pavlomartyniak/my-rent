import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors, Type } from '@/constants/theme';
import { useAttention } from '@/hooks/use-attention';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  // Число на «Головній» збігається з числом у блоці «Потрібна ваша увага», на «Запитах» — нові запити чи пропозиції
  const { urgent: home, requests } = useAttention('owner');

  return (
    <NativeTabs
      backgroundColor={colors.background}
      tintColor={colors.accent}
      indicatorColor={colors.backgroundElement}
      // Чотири вкладки: підпис 12 pt читається без напруги й не налазить на сусідні
      labelStyle={{ default: { fontSize: Type.caption.fontSize }, selected: { fontSize: Type.caption.fontSize, color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Авто</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'car', selected: 'car.fill' }} md="directions_car" />
        {home > 0 ? <NativeTabs.Trigger.Badge>{home > 99 ? '99+' : String(home)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="requests">
        <NativeTabs.Trigger.Label>Оренди</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'key', selected: 'key.fill' }} md="key" />
        {/* Без запитів бейдж не рендериться взагалі: порожній текст або hidden на частині платформ лишає кружечок */}
        {requests > 0 ? <NativeTabs.Trigger.Badge>{requests > 99 ? '99+' : String(requests)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Label>Доходи</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Профіль</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
