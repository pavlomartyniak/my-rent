const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
// Безкоштовний хостинг «засинає» без запитів і прокидається до хвилини, тому ліміт великий
const TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setApiToken = (value: string | null) => {
  token = value;
};

/** Викликається, коли сервер відхилив токен (сесія завершилась) */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

/** Перша зрозуміла фраза з відповіді сервера (NestJS віддає `message` рядком або масивом) */
function errorMessage(body: unknown, fallback: string) {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return String(message[0] ?? fallback);
  return typeof message === 'string' ? message : fallback;
}

/** Будить сервер заздалегідь: перший запит після простою на безкоштовному хостингу триває ~30–50 с */
export function wakeUpServer() {
  fetch(`${BASE_URL}/health`).catch(() => {});
}

export async function api<T = void>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  /** `text: true` — повернути відповідь як рядок (наприклад, CSV) замість JSON */
  options?: { text?: boolean },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  let res: Response;
  let timedOut = false;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      timedOut
        ? 'Сервер відповідає надто довго. Спробуйте ще раз за хвилину.'
        : 'Немає зв’язку із сервером. Перевірте інтернет і спробуйте ще раз.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  if (options?.text && res.ok) return (await res.text()) as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // 401 на авторизованому запиті — токен недійсний; на /auth/* це просто невірні дані
    if (res.status === 401 && token && !path.startsWith('/auth/')) onUnauthorized?.();
    throw new ApiError(errorMessage(data, 'Щось пішло не так. Спробуйте ще раз.'), res.status);
  }
  return data as T;
}
