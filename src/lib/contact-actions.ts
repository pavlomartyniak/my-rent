import { Linking } from 'react-native';

import type { MenuAction } from '@/components/more-menu';

import { openChat, type ChatContext } from './chat';

/** Дії зв'язку зі співрозмовником для меню «···»: чат, дзвінок і договір */
export function contactActions(opts: { chat?: ChatContext | false; phone?: string; contract?: () => void }): MenuAction[] {
  const actions: MenuAction[] = [];
  if (opts.chat) {
    const ctx = opts.chat;
    actions.push({ title: 'Написати', short: 'Написати', icon: 'chatbubble-ellipses-outline', onPress: () => void openChat(ctx) });
  }
  if (opts.phone) {
    const phone = opts.phone;
    actions.push({ title: `Зателефонувати: ${phone}`, short: 'Дзвінок', icon: 'call-outline', onPress: () => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`) });
  }
  if (opts.contract) actions.push({ title: 'Переглянути договір', short: 'Договір', icon: 'document-text-outline', onPress: opts.contract });
  return actions;
}
