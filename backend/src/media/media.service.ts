import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { Car } from '../schemas/car.schema';
import type { Conversation } from '../schemas/conversation.schema';
import type { Deal } from '../schemas/deal.schema';
import type { Offer } from '../schemas/offer.schema';
import type { RentalRequest } from '../schemas/rental-request.schema';
import { chunk, MEDIA_PREFIX, ORPHAN_GRACE_HOURS, publicIdFromUrl } from './cloudinary';

const HOUR_MS = 3_600_000;
const DELETE_BATCH = 100;

/**
 * Моделі підключаються за назвою (збігається з назвою класу схеми), а типи схем імпортуються лише для перевірки типів:
 * так сервіс не тягне за собою схеми й тестується без бази.
 *
 * Прибирання фото в Cloudinary, щоб не платити за зайве. Фото можна видалити, лише коли на нього більше ніхто не
 * посилається: копії посилань тримають авто, оренди, запити, пропозиції й чати. Тому:
 * — `release` видаляє фото одразу після заміни чи видалення (best-effort, помилки лише в журналі);
 * — `discard` видаляє щойно завантажене, але прибране з форми фото користувача;
 * — `sweep` раз на добу видаляє «сиріт»: фото, завантажені понад добу тому, на які ніхто не посилається.
 * Збирач вимкнений за замовчуванням і вмикається лише змінною MEDIA_SWEEP=true: dev і прод можуть ділити одну хмару,
 * а база dev не знає про фото проду й видалила б їх як чужі.
 */
@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MediaService.name);
  private timer?: NodeJS.Timeout;
  private first?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly config: ConfigService,
    @InjectModel('Car') private readonly cars: Model<Car>,
    @InjectModel('Deal') private readonly deals: Model<Deal>,
    @InjectModel('RentalRequest') private readonly rentals: Model<RentalRequest>,
    @InjectModel('Offer') private readonly offers: Model<Offer>,
    @InjectModel('Conversation') private readonly conversations: Model<Conversation>,
  ) {}

  onModuleInit() {
    if (this.config.get('MEDIA_SWEEP') !== 'true') return;
    // Перший прохід із запізненням, щоб не навантажувати старт сервера; далі раз на добу
    this.first = setTimeout(() => void this.sweep(), 10 * 60_000);
    this.timer = setInterval(() => void this.sweep(), 24 * HOUR_MS);
    this.first.unref();
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  private get creds() {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const key = this.config.get<string>('CLOUDINARY_API_KEY');
    const secret = this.config.get<string>('CLOUDINARY_API_SECRET');
    return cloudName && key && secret ? { cloudName, key, secret } : null;
  }

  /** Видаляє фото, на які більше ніхто не посилається. Ніколи не кидає помилку: це прибирання, а не частина запиту */
  async release(urls: (string | undefined | null)[]): Promise<number> {
    try {
      const creds = this.creds;
      if (!creds) return 0;
      const wanted = [...new Set(urls.filter((u): u is string => !!u))].filter((u) => publicIdFromUrl(u, creds.cloudName));
      if (!wanted.length) return 0;
      const used = await this.referencedAmong(wanted);
      const ids = wanted.filter((u) => !used.has(u)).map((u) => publicIdFromUrl(u, creds.cloudName)!);
      return await this.destroy(ids);
    } catch (e) {
      this.log.warn(`Не вдалося прибрати фото: ${(e as Error).message}`);
      return 0;
    }
  }

  /** Видаляє фото з папки користувача, якщо воно ніде не збережене (користувач прибрав його з форми до збереження) */
  async discard(userId: string, urls: string[]): Promise<number> {
    const creds = this.creds;
    if (!creds) return 0;
    const own = urls.filter((u) => publicIdFromUrl(u, creds.cloudName)?.startsWith(`${MEDIA_PREFIX}${userId}/`));
    return this.release(own);
  }

  /** Які з переданих посилань досі використовуються в базі */
  private async referencedAmong(urls: string[]): Promise<Set<string>> {
    const hit = (u: string[]) => ({ $in: u });
    const [cars, deals, rentals, offers, chats] = await Promise.all([
      this.cars.find({ $or: [{ photoUri: hit(urls) }, { photos: hit(urls) }] }, 'photoUri photos').lean().exec(),
      this.deals.find({ photoUri: hit(urls) }, 'photoUri').lean().exec(),
      this.rentals.find({ 'car.photoUri': hit(urls) }, 'car.photoUri').lean().exec(),
      this.offers.find({ $or: [{ 'car.photoUri': hit(urls) }, { 'car.photos': hit(urls) }] }, 'car.photoUri car.photos').lean().exec(),
      this.conversations.find({ 'context.photoUri': hit(urls) }, 'context.photoUri').lean().exec(),
    ]);
    const used = new Set<string>();
    const add = (u?: string | null) => u && used.add(u);
    for (const c of cars) [c.photoUri, ...(c.photos ?? [])].forEach(add);
    for (const d of deals) add(d.photoUri);
    for (const r of rentals) add(r.car?.photoUri);
    for (const o of offers) [o.car?.photoUri, ...(o.car?.photos ?? [])].forEach(add);
    for (const c of chats) add(c.context?.photoUri);
    return used;
  }

  /** Ідентифікатори всіх фото, що згадуються в базі (для пошуку сиріт) */
  private async allReferencedIds(cloudName: string): Promise<Set<string>> {
    const ids = new Set<string>();
    const add = (u?: string | null) => {
      const id = publicIdFromUrl(u, cloudName);
      if (id) ids.add(id);
    };
    for await (const c of this.cars.find({}, 'photoUri photos').lean().cursor()) [c.photoUri, ...(c.photos ?? [])].forEach(add);
    for await (const d of this.deals.find({}, 'photoUri').lean().cursor()) add(d.photoUri);
    for await (const r of this.rentals.find({}, 'car.photoUri').lean().cursor()) add(r.car?.photoUri);
    for await (const o of this.offers.find({}, 'car.photoUri car.photos').lean().cursor()) [o.car?.photoUri, ...(o.car?.photos ?? [])].forEach(add);
    for await (const c of this.conversations.find({}, 'context.photoUri').lean().cursor()) add(c.context?.photoUri);
    return ids;
  }

  /** Знаходить і видаляє фото-сироти. Повертає, скільки видалено */
  async sweep(): Promise<number> {
    const creds = this.creds;
    if (!creds || this.sweeping) return 0;
    this.sweeping = true;
    try {
      const used = await this.allReferencedIds(creds.cloudName);
      const cutoff = Date.now() - ORPHAN_GRACE_HOURS * HOUR_MS;
      const orphans: string[] = [];
      let cursor: string | undefined;
      let scanned = 0;
      do {
        const page = await this.admin<{ resources?: { public_id: string; created_at: string }[]; next_cursor?: string }>('GET', 'resources/image/upload', { prefix: MEDIA_PREFIX, max_results: '500', ...(cursor ? { next_cursor: cursor } : {}) });
        for (const r of page.resources ?? []) {
          scanned += 1;
          if (!used.has(r.public_id) && new Date(r.created_at).getTime() < cutoff) orphans.push(r.public_id);
        }
        cursor = page.next_cursor;
      } while (cursor);
      const deleted = await this.destroy(orphans);
      this.log.log(`Прибирання Cloudinary: переглянуто ${scanned}, сиріт ${orphans.length}, видалено ${deleted}`);
      return deleted;
    } catch (e) {
      this.log.warn(`Прибирання Cloudinary не вдалося: ${(e as Error).message}`);
      return 0;
    } finally {
      this.sweeping = false;
    }
  }

  private async destroy(publicIds: string[]): Promise<number> {
    let deleted = 0;
    for (const batch of chunk(publicIds, DELETE_BATCH)) {
      const res = await this.admin<{ deleted?: Record<string, string> }>('DELETE', 'resources/image/upload', {}, batch);
      deleted += Object.values(res.deleted ?? {}).filter((s) => s === 'deleted').length;
    }
    return deleted;
  }

  /** Виклик Admin API Cloudinary з базовою авторизацією (ключ і секрет) */
  private async admin<T>(method: 'GET' | 'DELETE', path: string, params: Record<string, string> = {}, publicIds: string[] = []): Promise<T> {
    const creds = this.creds;
    if (!creds) throw new Error('Cloudinary не налаштований');
    const query = new URLSearchParams(params);
    for (const id of publicIds) query.append('public_ids[]', id);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/${path}?${query}`, {
      method,
      headers: { Authorization: `Basic ${Buffer.from(`${creds.key}:${creds.secret}`).toString('base64')}` },
    });
    if (!res.ok) throw new Error(`Cloudinary відповів ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return (await res.json()) as T;
  }
}
