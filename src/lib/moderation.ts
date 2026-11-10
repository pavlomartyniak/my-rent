import { Alert } from 'react-native';

import { api, ApiError } from '@/lib/api';

export type ReportReason = 'spam' | 'fraud' | 'inappropriate' | 'fake' | 'abuse' | 'other';

export const REPORT_REASONS: { value: ReportReason; title: string; hint: string }[] = [
  { value: 'fraud', title: 'Шахрайство', hint: 'Просять гроші наперед, підозрілі умови' },
  { value: 'fake', title: 'Фальшиве оголошення', hint: 'Чужі фото, авто не існує чи дані неправдиві' },
  { value: 'abuse', title: 'Образи або погрози', hint: 'Некоректна поведінка в чаті' },
  { value: 'inappropriate', title: 'Недозволений вміст', hint: 'Відверті, образливі чи незаконні матеріали' },
  { value: 'spam', title: 'Спам', hint: 'Реклама або повторювані повідомлення' },
  { value: 'other', title: 'Інше', hint: 'Опишіть проблему нижче' },
];

/** На що скаржимось: оголошення, користувача чи повідомлення в чаті */
export type ReportTarget = { kind: 'listing'; carId: string } | { kind: 'user'; userId: string } | { kind: 'message'; messageId: string };

export const sendReport = (target: ReportTarget, reason: ReportReason, note: string) => api('POST', '/moderation/reports', { ...target, reason, note: note.trim() || undefined });

/** Кого блокуємо: користувача (з чату) або власника оголошення */
export type BlockTarget = { userId: string } | { carId: string };

export type BlockedUser = { userId: string; name: string; blockedAt: string };

/**
 * Підтвердження й блокування. Після блокування сторони не бачать оголошень одне одного й не можуть писати чи надсилати
 * запити; чинні угоди не скасовуються. `done` викликається, коли блокування збережено.
 */
export function confirmBlock(target: BlockTarget, name: string, done?: () => void) {
  Alert.alert(
    `Заблокувати ${name || 'користувача'}?`,
    'Ви більше не бачитимете оголошень одне одного й не зможете писати чи надсилати запити. Чинні угоди не скасовуються. Розблокувати можна в Налаштуваннях.',
    [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Заблокувати',
        style: 'destructive',
        onPress: () => {
          api('POST', '/moderation/blocks', target)
            .then(() => {
              Alert.alert('Готово', 'Користувача заблоковано.');
              done?.();
            })
            .catch((e) => Alert.alert('Не вдалося заблокувати', e instanceof ApiError ? e.message : 'Спробуйте ще раз'));
        },
      },
    ],
  );
}
