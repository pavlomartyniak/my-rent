import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFleet } from '@/store/fleet';

type State<T> = { key: string | null; version: number; data?: T; error?: string };

// Остання відповідь для кожного запиту: показуємо її одразу, поки сервер віддає свіжу
const cache = new Map<string, unknown>();

/**
 * Завантажує звіт із сервера й оновлює його після кожної зміни авто чи записів.
 * `path` — адреса звіту з параметрами; null — не завантажувати.
 */
export function useReport<T>(
  path: string | null,
  options: {
    /** Показувати попередню відповідь, поки вантажиться нова (для «Показати ще» без блимання) */
    keepPrevious?: boolean;
    /** false — завжди чекати свіжу відповідь, не показуючи збережену (для форм редагування) */
    useCache?: boolean;
    /** Завантажувати наново щоразу, коли екран знову стає активним (списки, що змінюються іншими користувачами) */
    refetchOnFocus?: boolean;
  } = {},
) {
  const { keepPrevious = false, useCache = true, refetchOnFocus = false } = options;
  const { token } = useAuth();
  const { dataVersion } = useFleet();
  const [state, setState] = useState<State<T>>({ key: null, version: -1 });
  const [attempt, setAttempt] = useState(0);
  const [focusTick, setFocusTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus) setFocusTick((t) => t + 1);
    }, [refetchOnFocus]),
  );

  // Кеш прив'язаний до токена, щоб після виходу чужі цифри не показувались
  const key = path && token ? `${token}:${path}` : null;

  useEffect(() => {
    if (!path || !key) return;
    let cancelled = false;
    api<T>('GET', path)
      .then((data) => {
        cache.set(key, data);
        if (!cancelled) setState({ key, version: dataVersion, data });
      })
      .catch((e) => {
        if (!cancelled) setState({ key, version: dataVersion, error: e instanceof ApiError ? e.message : 'Не вдалося завантажити звіт' });
      });
    return () => {
      cancelled = true;
    };
  }, [path, key, dataVersion, attempt, focusTick]);

  const current = state.key === key;
  const settled = current && state.version === dataVersion;
  // Без кешу беремо лише відповідь цього ж екрана; пізніші оновлення вже не прибирають її (форма не блимає при збереженні)
  const data = !useCache
    ? current
      ? state.data
      : undefined
    : (current ? state.data : undefined) ?? (key ? (cache.get(key) as T | undefined) : undefined) ?? (keepPrevious ? state.data : undefined);

  const retry = useCallback(() => {
    setState({ key: null, version: -1 });
    setAttempt((n) => n + 1);
  }, []);

  return {
    data,
    /** Показуємо помилку, лише якщо нічого показати */
    error: !data && settled ? state.error : undefined,
    loading: !data && !(settled && state.error),
    retry,
  };
}
