import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { ApiError } from './api';

/**
 * Сервер не приймає запит, пропозицію чи публікацію, поки не заповнені дані для договору (code LEGAL_INCOMPLETE).
 * Показує, чого бракує, і веде на потрібний екран. Повертає true, якщо помилку оброблено.
 */
export function handleLegalGate(e: unknown, router: ReturnType<typeof useRouter>, carId?: string): boolean {
  if (!(e instanceof ApiError) || e.code !== 'LEGAL_INCOMPLETE') return false;
  const list = e.details?.length ? `\n\n• ${e.details.join('\n• ')}` : '';
  if (e.scope === 'other') {
    Alert.alert('Поки що неможливо', e.message);
    return true;
  }
  // Бракує лише посвідчення водія: веде на профіль, де його додають
  if (e.scope === 'license') {
    Alert.alert('Потрібне посвідчення водія', `${e.message}.${list}`, [
      { text: 'Пізніше', style: 'cancel' },
      { text: 'Додати в профілі', onPress: () => router.push('/profile') },
    ]);
    return true;
  }
  const open = () => (e.scope === 'car' && carId ? router.push({ pathname: '/car/edit', params: { id: carId } }) : router.push('/legal'));
  Alert.alert(e.scope === 'car' ? 'Дані авто для договору' : 'Дані для договору', `${e.message}.${list}`, [
    { text: 'Пізніше', style: 'cancel' },
    { text: 'Заповнити', onPress: open },
  ]);
  return true;
}
