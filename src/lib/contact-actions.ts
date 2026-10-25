import type { MenuAction } from '@/components/more-menu';

import { openChat, type ChatContext } from './chat';

/** Дії на картках: написати в чат і переглянути договір. Дзвонити можна лише зі сторінки чату */
export function contactActions(opts: { chat?: ChatContext | false; contract?: () => void }): MenuAction[] {
  const actions: MenuAction[] = [];
  if (opts.chat) {
    const ctx = opts.chat;
    actions.push({ title: 'Написати', short: 'Написати', icon: 'chatbubble-ellipses-outline', onPress: () => void openChat(ctx) });
  }
  if (opts.contract) actions.push({ title: 'Переглянути договір', short: 'Договір', icon: 'document-text-outline', onPress: opts.contract });
  return actions;
}
