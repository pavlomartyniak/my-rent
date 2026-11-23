import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import { api, ApiError } from './api';
import { mimeFor, postForm } from './upload';

export type CheckinState = 'none' | 'upcoming' | 'open' | 'overdue';
export type Every = 'weekly' | 'biweekly' | 'monthly';

export const EVERY_OPTIONS: { value: Every; label: string }[] = [
  { value: 'weekly', label: 'Щотижня' },
  { value: 'biweekly', label: '2 тижні' },
  { value: 'monthly', label: 'Щомісяця' },
];
/** Дні тижня від понеділка (значення — як у JS: 0 — неділя) */
export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Нд' },
];

/** Вимога фотозвіту в оголошенні авто: копіюється в оренду при прийнятті запиту */
export type ListingCheckin = { every: Every; weekday: number; body: boolean; interior: boolean; requirement?: string };

export type CheckinSettings = { enabled: boolean; every: Every; weekday: number; body: boolean; interior: boolean };

export type CheckinReport = { id: string; due: string; at: string; km: number; deltaKm: number | null; photos: { slot: string; label: string; url: string }[] };

/** Відповідь /checkin/:dealId */
export type CheckinView = {
  role: 'owner' | 'renter';
  dealStatus: 'awaiting' | 'active' | 'terminated';
  title: string;
  settings: CheckinSettings;
  /** Текст вимоги («щотижня (понеділок): панель приладів…»); null — звіт вимкнено */
  requirement: string | null;
  /** Фото, які треба зробити */
  slots: { id: string; label: string }[];
  status: { state: CheckinState; due: string | null; overdueDays: number; overdueCount: number };
  reports: CheckinReport[];
  startKm: number | null;
  lastKm: number | null;
  totalKm: number | null;
  canConfigure: boolean;
  canSubmit: boolean;
  canRemind: boolean;
};

/** Рядок блоку «Потрібна ваша увага» */
export type CheckinAttention = { dealId: string; title: string; state: CheckinState; due: string | null; overdueDays: number };

/** Підказка на екрані: що робити з фото. Для кожного кроку звіту */
export const SLOT_HINTS: Record<string, string> = {
  dashboard: 'Панель приладів: щоб було видно пробіг, паливо й відсутність помилок',
  front: 'Авто спереду, цілком у кадрі',
  rear: 'Авто ззаду, цілком у кадрі',
  left: 'Ліва сторона авто',
  right: 'Права сторона авто',
  seatsFront: 'Передні сидіння й салон',
  seatsRear: 'Задні сидіння',
};

/**
 * Фото для звіту лише з камери: звіт має показувати стан авто зараз, а не старий знімок. У симуляторі камери немає, тому в
 * розробці дозволяємо галерею. Скасування повертає null.
 */
export async function takeFreshPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Немає доступу до камери', 'Щоб зробити фото для звіту, дозвольте доступ до камери для застосунку в налаштуваннях телефону.', [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Відкрити налаштування', onPress: () => void Linking.openSettings() },
    ]);
    return null;
  }
  try {
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    return res.canceled || !res.assets[0] ? null : res.assets[0].uri;
  } catch {
    if (!__DEV__) {
      Alert.alert('Камера недоступна', 'Не вдалося відкрити камеру на цьому пристрої.');
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    return res.canceled || !res.assets[0] ? null : res.assets[0].uri;
  }
}

type Signature = { cloudName: string; apiKey: string; items: { publicId: string; timestamp: number; signature: string; uploadUrl: string }[] };

/** Завантажує фото звіту в Cloudinary за підписами сервера по черзі; `onProgress(i, f)` — частка відправленого фото з номером i */
export async function uploadCheckinPhotos(dealId: string, items: { slot: string; uri: string }[], onProgress: (index: number, fraction: number) => void): Promise<{ slot: string; url: string }[]> {
  const sig = await api<Signature>('POST', `/checkin/${dealId}/signature`, { count: items.length });
  const out: { slot: string; url: string }[] = [];
  for (const [i, it] of items.entries()) {
    const s = sig.items[i]!;
    const name = it.uri.split('/').pop() || 'photo.jpg';
    const res = await postForm(s.uploadUrl, {
      fields: { api_key: sig.apiKey, timestamp: String(s.timestamp), public_id: s.publicId, signature: s.signature },
      file: { uri: it.uri, name, type: mimeFor(name, 'image/jpeg') },
      onProgress: (f) => onProgress(i, f),
    });
    const url = (res.json as { secure_url?: string } | null)?.secure_url;
    if (!res.ok || !url) throw new Error('Не вдалося завантажити фото');
    out.push({ slot: it.slot, url });
  }
  return out;
}

export const submitCheckin = (dealId: string, photos: { slot: string; url: string }[], km: number) => api<CheckinView>('POST', `/checkin/${dealId}/submit`, { photos, km });
export const saveCheckinSettings = (dealId: string, settings: CheckinSettings) => api<CheckinView>('PUT', `/checkin/${dealId}/settings`, settings);
export const remindCheckin = (dealId: string) => api<CheckinView>('POST', `/checkin/${dealId}/remind`, {});

export const errorText = (e: unknown, fallback = 'Спробуйте ще раз') => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

/** Короткий опис строку: «Сьогодні», «Завтра», «Прострочено на 3 дн.», «Через 5 дн.» */
export function dueText(state: CheckinState, days: number, overdueDays: number) {
  if (state === 'overdue') return `Прострочено на ${overdueDays} дн.`;
  if (days <= 0) return 'Сьогодні';
  if (days === 1) return 'Завтра';
  return `Через ${days} дн.`;
}
