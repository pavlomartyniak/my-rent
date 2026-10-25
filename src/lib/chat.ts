import { router } from 'expo-router';
import { Alert } from 'react-native';

import { api, ApiError } from './api';

/** Відповіді ендпоінтів /chats і події сокета */

export type ChatSummary = {
  id: string;
  counterpart: { id: string; name: string };
  /** Авто й умови, про які розмова (знімок на момент початку): показуються в шапці чату */
  context: { title: string; photoUri: string | null; city: string; pricePerDay: number; startDate: string; endDate: string; carId: string | null } | null;
  /** Етап домовленості: pending/accepted/declined/…, а після оренди upcoming/active/finished/terminated; closed — запит уже видалено */
  stage: string;
  /** Оренда, що виросла з цієї розмови (якщо вже є) */
  dealId: string | null;
  /** Звідки розмова: запит на оголошення (request) чи пропозиція на заявку (offer; wantedId — її заявка) */
  source: { kind: 'request' | 'offer'; wantedId: string | null } | null;
  lastMessage: { text: string; mine: boolean; at: string } | null;
  unread: number;
  /** Коли співрозмовник востаннє читав чат */
  otherReadAt: string | null;
  /** false — активної домовленості вже немає, чат лише для читання */
  canSend: boolean;
  lastActivityAt: string;
};

export type ChatMessage = {
  id: string;
  text: string;
  mine: boolean;
  createdAt: string;
  clientId: string | null;
  /** Лише для локальних повідомлень: ще надсилається чи не вдалося надіслати */
  status?: 'sending' | 'failed';
};

export type MessagesPage = { items: ChatMessage[]; hasMore: boolean };

export type ChatEvent =
  | { type: 'message'; conversationId: string; senderId: string; message: ChatMessage }
  | { type: 'read'; conversationId: string; by: 'owner' | 'renter'; at: string }
  | { type: 'typing'; conversationId: string; userId: string }
  | { type: 'removed'; conversationId: string }
  | { type: 'resume' };

/** Контекст, з якого відкривається чат: запит, пропозиція або оренда */
export type ChatContext = { rentalId: string } | { offerId: string } | { dealId: string };

/** Відкриває (або створює) чат з людиною, з якою є запит, пропозиція чи оренда, і переходить до нього */
export async function openChat(context: ChatContext) {
  try {
    const chat = await api<ChatSummary>('POST', '/chats', context);
    router.push({ pathname: '/chats/[id]', params: { id: chat.id } });
  } catch (e) {
    Alert.alert('Не вдалося відкрити чат', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
  }
}

/** Унікальний id повідомлення, який створює застосунок: повторна відправка не дублює його на сервері */
export const newClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** Година й хвилини повідомлення: 14:05 */
export const clock = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Час у списку чатів: сьогодні — година, раніше — число й місяць */
export function listTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? clock(iso) : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

/** Розділювач днів у розмові: «Сьогодні», «Вчора» або повна дата */
export function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Сьогодні';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Вчора';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Чи з різних днів ці два повідомлення (для розділювача) */
export const differentDays = (a: string, b: string) => new Date(a).toDateString() !== new Date(b).toDateString();
