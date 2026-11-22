/** Файл для відправки: так React Native читає його з пристрою й відправляє частинами, тож видно прогрес */
type FormFile = { uri: string; name: string; type: string };

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', pdf: 'application/pdf',
};

/** Тип файлу за розширенням назви (або запасний, якщо розширення невідоме) */
export const mimeFor = (name: string, fallback = 'application/octet-stream') => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? fallback;

export class UploadCancelled extends Error {
  constructor() {
    super('Завантаження скасовано');
  }
}

export type UploadResponse = { status: number; ok: boolean; json: Record<string, unknown> | null };

type Options = {
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  fields?: Record<string, string>;
  file: FormFile;
  /** Скільки вже відправлено: від 0 до 1 */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/**
 * Відправляє файл із полями формою й повідомляє про прогрес. Окремо від fetch, бо fetch не показує, скільки вже відправлено:
 * XMLHttpRequest дає події прогресу відправки.
 */
export function postForm(url: string, { method = 'POST', headers, fields, file, onProgress, signal }: Options): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadCancelled());
    const form = new FormData();
    for (const [k, v] of Object.entries(fields ?? {})) form.append(k, v);
    form.append('file', file as unknown as Blob);

    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      onProgress?.(1);
      let json: UploadResponse['json'] = null;
      try {
        json = JSON.parse(xhr.responseText) as UploadResponse['json'];
      } catch {
        // Відповідь не JSON: лишаємо null
      }
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, json });
    };
    xhr.onerror = () => reject(new Error('Немає зв’язку із сервером'));
    xhr.ontimeout = () => reject(new Error('Сервер не відповів вчасно'));
    xhr.onabort = () => reject(new UploadCancelled());
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/** Текст помилки з відповіді сервера (NestJS: message — рядок чи масив) */
export const serverMessage = (json: UploadResponse['json']) => {
  const m = (json as { message?: string | string[] } | null)?.message;
  return Array.isArray(m) ? String(m[0]) : m;
};
