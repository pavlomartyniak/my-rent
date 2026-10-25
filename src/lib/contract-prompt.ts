import { router } from 'expo-router';
import { Alert } from 'react-native';

/**
 * Одразу після прийняття домовленості пропонуємо переглянути договір. Підписувати його не треба зараз:
 * це робиться під час зустрічі, коли сторони передають авто, ключі й гроші.
 */
export function promptContract(dealId: string | null | undefined) {
  if (!dealId) return;
  Alert.alert('Договір сформовано', 'Перегляньте його умови зараз. Підписувати договір потрібно під час зустрічі, коли ви передаєте авто, ключі й гроші: підписання відкриється за добу до початку оренди.', [
    { text: 'Пізніше', style: 'cancel' },
    { text: 'Переглянути договір', onPress: () => router.push({ pathname: '/contracts/[id]', params: { id: dealId } }) },
  ]);
}
