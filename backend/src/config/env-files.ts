/** Середовища, між якими перемикається локальний запуск бекенду */
export const APP_ENVS = ['development', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/**
 * Яке середовище вибрано. Явно змінною APP_ENV; без неї на Render (там завжди задана RENDER) це production, а локально development.
 * Невідоме значення — помилка, щоб одруківка не запустила сервер із чужими налаштуваннями.
 */
export function resolveAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const value = env.APP_ENV?.trim();
  if (!value) return env.RENDER ? 'production' : 'development';
  if (!(APP_ENVS as readonly string[]).includes(value)) throw new Error(`APP_ENV має бути ${APP_ENVS.join(' або ')}, а не «${value}»`);
  return value as AppEnv;
}

/**
 * Файли зі змінними для вибраного середовища, від найвищого пріоритету до найнижчого. Загального `.env` навмисно немає:
 * інакше пропущена змінна в production тихо брала б значення з development (і навпаки).
 * На Render файлів немає, змінні приходять із панелі.
 */
export const envFilePaths = (appEnv: AppEnv): string[] => [`.env.${appEnv}.local`, `.env.${appEnv}`];

/** Назва бази без паролів: для рядка в журналі при старті */
export const describeTarget = (env: NodeJS.ProcessEnv): string => `база «${env.MONGODB_DB ?? '?'}»`;
