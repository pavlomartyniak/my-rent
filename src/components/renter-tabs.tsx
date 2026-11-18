import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors, Type } from '@/constants/theme';
import { useAttention } from '@/hooks/use-attention';
import { useChat } from '@/store/chat';

/** Вкладки орендаря: оренди (активні, запити, заявки, архів), пошук авто, доходи, профіль */
export default function RenterTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  // Одне число на «Орендах»: усе, що чекає на дію (договори, платежі, пропозиції)
  const { urgent: home } = useAttention('renter');
  const { unread } = useChat();

  return (
    <NativeTabs backgroundColor={colors.background}
      tintColor={colors.accent} indicatorColor={colors.backgroundElement} labelStyle={{ default: { fontSize: Type.caption.fontSize }, selected: { fontSize: Type.caption.fontSize, color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Оренди</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'key', selected: 'key.fill' }} md="key" />
        {home > 0 ? <NativeTabs.Trigger.Badge>{home > 99 ? '99+' : String(home)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Пошук</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Label>Чати</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.message', selected: 'ellipsis.message.fill' }} md="forum" />
        {unread > 0 ? <NativeTabs.Trigger.Badge>{unread > 99 ? '99+' : String(unread)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="report">
        <NativeTabs.Trigger.Label>Доходи</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Профіль</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
