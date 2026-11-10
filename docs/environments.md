# Середовища: development і production

Два повністю окремі середовища: різні бази MongoDB, хмари Cloudinary, акаунти Resend і сервіси Render.
Нічого, що містить секрети, не потрапляє в git.

## Бекенд (`backend/`)

| Що | Development | Production |
|---|---|---|
| Файл зі змінними | `backend/.env.development` | `backend/.env.production` |
| Запуск | `npm run api` (з кореня) чи `npm run start:dev` | `npm run api:local-prod` чи `npm run start:local-prod` |
| На Render | не використовується | змінні задаються в панелі сервісу (файл не потрібен) |

- Вибір робить змінна `APP_ENV` (`development` чи `production`). Без неї на Render це production, локально development.
  Невідоме значення зупиняє запуск.
- Загального `.env` немає навмисно: пропущена змінна в production ніколи не візьметься з development.
- Для особистих перевизначень: `.env.development.local`, `.env.production.local` (мають вищий пріоритет).
- Під час старту в журналі видно: `Середовище: <env>, база «<назва>»`. Якщо production запущено локально, додається
  червоне попередження: усе, що ви робите, змінює справжні дані.
- Шаблон змінних: `backend/.env.example`.

## Застосунок (Expo)

Expo сам вибирає файл за режимом (SDK 58 читає лише `.env`, `.env.local`, `.env.development`, `.env.production` та їхні `.local`).

| Команда | Режим | Файл |
|---|---|---|
| `npm start` | development | `.env.development` (+ `.env.development.local`) |
| `npm run start:prod` (`expo start --no-dev`) | production | `.env.production` |
| `eas build`, `eas update` | production | `.env.production` |

- `EXPO_PUBLIC_API_URL`: адреса API. У production вона обов'язкова: без неї застосунок свідомо не запускається.
- У `.env.development.local` (не в git) тримайте свою адресу для розробки, наприклад IP комп'ютера в Wi-Fi.
- Не створюйте `.env.local`: він має вищий пріоритет за `.env.production` і підмінив би адресу проду в прод-збірці.
- У `EXPO_PUBLIC_*` не може бути секретів: вони видимі в застосунку.

## Чек-лист нового середовища (прод)

1. MongoDB Atlas: кластер, користувач бази, доступ з мережі, рядок підключення.
2. Cloudinary, Resend (домен для листів) під окремим акаунтом.
3. Render: сервіс із гілки `main`, змінні: `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET` (новий, від 32 символів),
   `CLOUDINARY_*`, `RESEND_API_KEY`, `MAIL_FROM`, `NODE_VERSION=22`, `DEMO_MODE=false`, `MEDIA_SWEEP=true`.
4. Адреса сервісу з Render у `.env.production` (корінь проєкту).
