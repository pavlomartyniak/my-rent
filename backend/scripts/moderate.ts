/**
 * Модерація скарг без адмін-панелі. Запуск з папки backend:
 *
 *   npm run moderate -- reports                    відкриті скарги (--all: усі)
 *   npm run moderate -- hide-listing <carId>       приховати оголошення (воно зникає з пошуку, власник не може його повернути)
 *   npm run moderate -- unhide-listing <carId>     повернути можливість публікації
 *   npm run moderate -- suspend <email|userId>     призупинити акаунт: вхід закрито, оголошення приховано
 *   npm run moderate -- unsuspend <email|userId>   зняти призупинення
 *   npm run moderate -- resolve <reportId> [коментар]   позначити скаргу розглянутою
 *
 * Середовище: APP_ENV=production npm run moderate -- ... (без APP_ENV береться development).
 * Команди, що змінюють дані, у production вимагають прапорця --yes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

import { parse } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

const appEnv = process.env.APP_ENV === 'production' ? 'production' : 'development';

/** Змінні з тих самих файлів, що й у сервера: `.env.<env>.local` важливіший за `.env.<env>` */
function loadEnv() {
  const vars: Record<string, string> = {};
  for (const name of [`.env.${appEnv}`, `.env.${appEnv}.local`]) {
    const path = resolvePath(process.cwd(), name);
    if (existsSync(path)) Object.assign(vars, parse(readFileSync(path)));
  }
  return { ...vars, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k === 'MONGODB_URI' || k === 'MONGODB_DB')) } as Record<string, string | undefined>;
}

const args = process.argv.slice(2).filter((a) => a !== '--yes' && a !== '--all');
const yes = process.argv.includes('--yes');
const all = process.argv.includes('--all');
const [command, target, ...rest] = args;

const WRITE = new Set(['hide-listing', 'unhide-listing', 'suspend', 'unsuspend', 'resolve']);

const oid = (value: string | undefined) => {
  if (!value || !ObjectId.isValid(value)) throw new Error(`«${value ?? ''}» не схоже на ідентифікатор`);
  return new ObjectId(value);
};

async function main() {
  if (!command) {
    console.log('Команди: reports | hide-listing <carId> | unhide-listing <carId> | suspend <email|userId> | unsuspend <email|userId> | resolve <reportId> [коментар]');
    return;
  }
  const env = loadEnv();
  if (!env.MONGODB_URI) throw new Error(`Немає MONGODB_URI: перевірте backend/.env.${appEnv}`);
  if (appEnv === 'production' && WRITE.has(command) && !yes) {
    throw new Error('Це PRODUCTION. Додайте --yes, якщо справді хочете змінити дані.');
  }

  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(env.MONGODB_DB ?? 'my-rent');
    console.log(`Середовище: ${appEnv}, база «${db.databaseName}»`);
    const users = db.collection('users');
    const cars = db.collection('cars');
    const reports = db.collection('reports');

    const findUser = async (key: string) => {
      const user = await users.findOne(ObjectId.isValid(key) ? { _id: new ObjectId(key) } : { email: key.toLowerCase() }, { projection: { email: 1 } });
      if (!user) throw new Error('Користувача не знайдено');
      return user;
    };

    if (command === 'reports') {
      const rows = await reports.find(all ? {} : { status: 'open' }).sort({ createdAt: -1 }).limit(100).toArray();
      if (!rows.length) console.log('Скарг немає.');
      for (const r of rows) {
        const reporter = await users.findOne({ _id: r.reporterId }, { projection: { email: 1 } });
        const accused = await users.findOne({ _id: r.targetUserId }, { projection: { email: 1 } });
        console.log(
          [
            `\n#${r._id}  [${r.status}]  ${new Date(r.createdAt).toISOString()}`,
            `  тип: ${r.kind}, причина: ${r.reason}${r.note ? `, коментар: ${r.note}` : ''}`,
            `  скаржник: ${reporter?.email ?? r.reporterId}`,
            `  на кого: ${accused?.email ?? r.targetUserId} (${r.targetUserId})${r.carId ? `, оголошення ${r.carId}` : ''}`,
            r.snapshot ? `  зміст: ${r.snapshot}` : '',
            r.resolution ? `  рішення: ${r.resolution}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        );
      }
    } else if (command === 'hide-listing' || command === 'unhide-listing') {
      const hide = command === 'hide-listing';
      const res = await cars.updateOne(
        { _id: oid(target) },
        hide
          ? { $set: { moderationHidden: true, 'listing.published': false }, $unset: { listingUnlock: '', listingFreeSlot: '' } }
          : { $unset: { moderationHidden: '' } },
      );
      console.log(res.matchedCount ? (hide ? 'Оголошення приховано.' : 'Приховування знято.') : 'Авто не знайдено.');
    } else if (command === 'suspend' || command === 'unsuspend') {
      const suspend = command === 'suspend';
      const user = await findUser(target ?? '');
      await users.updateOne({ _id: user._id }, { $set: { suspended: suspend } });
      const carsRes = await cars.updateMany(
        { userId: user._id },
        suspend ? { $set: { moderationHidden: true, 'listing.published': false }, $unset: { listingUnlock: '', listingFreeSlot: '' } } : { $unset: { moderationHidden: '' } },
      );
      console.log(`${suspend ? 'Акаунт призупинено' : 'Призупинення знято'}: ${user.email}. Авто оброблено: ${carsRes.modifiedCount}. Дія набуде чинності протягом хвилини.`);
    } else if (command === 'resolve') {
      const res = await reports.updateOne({ _id: oid(target) }, { $set: { status: 'resolved', resolution: rest.join(' '), resolvedAt: new Date() } });
      console.log(res.matchedCount ? 'Скаргу позначено розглянутою.' : 'Скаргу не знайдено.');
    } else {
      throw new Error(`Невідома команда «${command}»`);
    }
  } finally {
    await client.close();
  }
}

main().catch((e: Error) => {
  console.error(`Помилка: ${e.message}`);
  process.exit(1);
});
