import { BadRequestException, ConflictException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { isIsoDay } from '../common/is-iso-day';
import { todayUtc } from '../rentals/rentals.math';
import { Car } from '../schemas/car.schema';
import { Deal } from '../schemas/deal.schema';
import { InsuranceFile } from '../schemas/insurance-file.schema';
import { cleanFileName, fixMulterName, MAX_POLICY_BYTES, policyExpired, sniffPolicy } from './insurance.files';

export type UploadedFile = { originalname: string; size: number; buffer: Buffer };

@Injectable()
export class InsuranceService {
  constructor(
    @InjectModel(InsuranceFile.name) private readonly files: Model<InsuranceFile>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
  ) {}

  /** Власник авто чи орендар, у якого з цим авто чинна (чи така, що чекає підписання) оренда */
  private async access(user: AuthUser, carId: string): Promise<'owner' | 'renter'> {
    if (await this.cars.exists({ _id: carId, userId: user.id })) return 'owner';
    if (user.role === 'renter' && (await this.deals.exists({ carId, renterId: user.id, status: { $in: ['awaiting', 'active'] }, endDate: { $gte: todayUtc() } }))) return 'renter';
    throw new NotFoundException('Авто не знайдено');
  }

  private async ownerOnly(user: AuthUser, carId: string) {
    if ((await this.access(user, carId).catch(() => null)) !== 'owner') throw new NotFoundException('Авто не знайдено');
  }

  private meta(f: Pick<InsuranceFile, 'name' | 'mime' | 'size' | 'validUntil'> & { uploadedAt: Date }) {
    return { hasPolicy: true as const, name: f.name, mime: f.mime, size: f.size, validUntil: f.validUntil ?? null, expired: policyExpired(f.validUntil, todayUtc()), uploadedAt: f.uploadedAt };
  }

  /** Відомості про поліс без самого файлу; `canEdit` — чи це власник авто */
  async info(user: AuthUser, carId: string) {
    const role = await this.access(user, carId);
    const f = await this.files.findOne({ carId }, '-data').lean().exec();
    return { canEdit: role === 'owner', ...(f ? this.meta(f as never) : { hasPolicy: false as const }) };
  }

  async upload(user: AuthUser, carId: string, file: UploadedFile | undefined, validUntil?: string) {
    await this.ownerOnly(user, carId);
    if (!file?.buffer?.length) throw new BadRequestException('Додайте файл полісу');
    if (file.size > MAX_POLICY_BYTES) throw new PayloadTooLargeException(`Файл завеликий (до ${MAX_POLICY_BYTES / 1024 / 1024} МБ)`);
    const mime = sniffPolicy(file.buffer);
    if (!mime) throw new BadRequestException(`Підтримуються PDF і фото (JPEG, PNG, WebP, HEIC). Отримано файл ${file.buffer.length} Б, початок: ${file.buffer.subarray(0, 6).toString('hex') || 'порожньо'}`);
    if (validUntil && !isIsoDay(validUntil)) throw new BadRequestException('Дата має бути у форматі РРРР-ММ-ДД');
    const ownerId = (await this.cars.findById(carId, 'userId').lean().exec())!.userId;
    const saved = await this.files
      .findOneAndUpdate(
        { carId },
        { $set: { carId, ownerId, name: cleanFileName(fixMulterName(file.originalname)), mime, size: file.buffer.length, data: file.buffer, validUntil: validUntil || undefined, uploadedAt: new Date() }, ...(validUntil ? {} : { $unset: { validUntil: 1 } }) },
        { upsert: true, returnDocument: 'after', projection: '-data' },
      )
      .lean()
      .exec();
    return { canEdit: true, ...this.meta(saved as never) };
  }

  /** Змінити лише дату, до якої діє поліс; порожня прибирає її */
  async setValidUntil(user: AuthUser, carId: string, validUntil: string | null) {
    await this.ownerOnly(user, carId);
    if (validUntil && !isIsoDay(validUntil)) throw new BadRequestException('Дата має бути у форматі РРРР-ММ-ДД');
    const f = await this.files.findOneAndUpdate({ carId }, validUntil ? { $set: { validUntil } } : { $unset: { validUntil: 1 } }, { returnDocument: 'after', projection: '-data' }).lean().exec();
    if (!f) throw new ConflictException('Поліс ще не завантажено');
    return { canEdit: true, ...this.meta(f as never) };
  }

  async remove(user: AuthUser, carId: string) {
    await this.ownerOnly(user, carId);
    await this.files.deleteOne({ carId }).exec();
  }

  /** Сам файл для завантаження: власнику й орендарю з орендою цього авто */
  async download(user: AuthUser, carId: string) {
    await this.access(user, carId);
    const f = await this.files.findOne({ carId }).lean().exec();
    if (!f) throw new NotFoundException('Власник ще не додав страховий поліс');
    return { data: Buffer.from(f.data as unknown as Buffer), mime: f.mime, name: f.name };
  }

  /** Прибрати поліс разом з авто чи акаунтом власника */
  async dropForCars(carIds: string[]) {
    if (carIds.length) await this.files.deleteMany({ carId: { $in: carIds } }).exec();
  }
}
