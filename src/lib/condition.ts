import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { api } from './api';

export type Phase = 'handover' | 'return';

export type ConditionPhoto = { id: string; slot: string; label: string; url: string; by: 'owner' | 'renter'; byMe: boolean; at: string; note: string | null };
export type ConditionReportView = { photos: ConditionPhoto[]; odometer: { km: number; by: 'owner' | 'renter'; byMe: boolean; at: string } | null; missing: string[] };

/** Відповідь /condition/:dealId */
export type ConditionView = {
  dealStatus: 'awaiting' | 'active' | 'terminated';
  slots: { id: string; label: string; required: boolean }[];
  /** Хто дивиться: власник фіксує передачу, орендар перевіряє й підтверджує */
  role: 'owner' | 'renter';
  handover: ConditionReportView & { ready: boolean; confirmed: boolean; confirmedAt: string | null; canEdit: boolean; canAddDamage: boolean; canConfirm: boolean };
  return: ConditionReportView & { canEdit: boolean };
};

/** Фото стану авто лише з камери: так фото свіжі, а не з галереї (доказова сила для обох сторін) */
export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Немає доступу до камери', 'Дозвольте камеру для застосунку в налаштуваннях телефону.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  return res.canceled || !res.assets[0] ? null : res.assets[0].uri;
}

type Signature = { cloudName: string; apiKey: string; items: { publicId: string; timestamp: number; signature: string; uploadUrl: string }[] };

/** Завантажує фото в Cloudinary за підписом сервера й повертає https-посилання */
export async function uploadConditionPhoto(dealId: string, uri: string): Promise<string> {
  const sig = await api<Signature>('POST', `/condition/${dealId}/signature`, { count: 1 });
  const item = sig.items[0]!;
  const form = new FormData();
  form.append('file', new File(uri) as unknown as Blob);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(item.timestamp));
  form.append('public_id', item.publicId);
  form.append('signature', item.signature);
  const res = await fetch(item.uploadUrl, { method: 'POST', body: form });
  const data = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.secure_url) throw new Error(data?.error?.message ?? 'Не вдалося завантажити фото');
  return data.secure_url;
}

export const savePhoto = (dealId: string, phase: Phase, body: { slot: string; url: string; note?: string }) => api<ConditionView>('PUT', `/condition/${dealId}/${phase}/photo`, body);
export const removePhoto = (dealId: string, phase: Phase, photoId: string) => api<ConditionView>('DELETE', `/condition/${dealId}/${phase}/photo/${photoId}`);
/** Орендар погоджується зі станом авто при передачі: після цього відкривається підписання */
export const confirmCondition = (dealId: string) => api<ConditionView>('POST', `/condition/${dealId}/confirm`, {});
export const saveOdometer = (dealId: string, phase: Phase, km: number) => api<ConditionView>('PUT', `/condition/${dealId}/${phase}/odometer`, { km });
