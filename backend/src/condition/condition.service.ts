import { randomBytes } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { type CheckinState, checkinUrls } from '../checkin/checkin.rules';
import type { AuthUser } from '../common/current-user';
import { cloudRefFromUrl, MEDIA_PREFIX } from '../media/cloudinary';
import { MediaService } from '../media/media.service';
import { signUpload } from '../media/signature';
import { todayUtc } from '../rentals/rentals.math';
import { Deal, type DealDocument } from '../schemas/deal.schema';
import {
  canChange,
  type ConditionPhoto,
  type ConditionReport,
  handoverReady,
  MAX_DAMAGE_PHOTOS,
  missingSlots,
  type Phase,
  permissions,
  PHASES,
  REQUIRED_SLOTS,
  SINGLE_SLOTS,
  SLOT_LABELS,
} from './condition.rules';

@Injectable()
export class ConditionService {
  constructor(
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    private readonly config: ConfigService,
    private readonly media: MediaService,
  ) {}

  private async partyDeal(user: AuthUser, dealId: string) {
    const deal = await this.deals.findOne({ _id: dealId, $or: [{ ownerId: user.id }, { renterId: user.id }] }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    const role: 'owner' | 'renter' = String(deal.ownerId) === user.id ? 'owner' : 'renter';
    return { deal, role };
  }

  private perms(deal: DealDocument) {
    return permissions(deal, todayUtc(), new Date());
  }

  private reportOf(deal: DealDocument, phase: Phase): ConditionReport {
    return (deal.condition?.[phase] as ConditionReport | undefined) ?? { photos: [] };
  }

  private view(report: ConditionReport, role: 'owner' | 'renter') {
    return {
      photos: report.photos.map((p) => ({ id: p.id, slot: p.slot, label: SLOT_LABELS[p.slot] ?? 'Пошкодження', url: p.url, by: p.by, byMe: p.by === role, at: p.at, note: p.note ?? null })),
      odometer: report.odometer ? { km: report.odometer.km, by: report.odometer.by, byMe: report.odometer.by === role, at: report.odometer.at } : null,
      missing: missingSlots(report),
    };
  }

  async get(user: AuthUser, dealId: string) {
    const { deal, role } = await this.partyDeal(user, dealId);
    const p = this.perms(deal);
    const handover = this.reportOf(deal, 'handover');
    return {
      dealStatus: deal.status,
      slots: [...REQUIRED_SLOTS.map((id) => ({ id, label: SLOT_LABELS[id], required: true })), ...SINGLE_SLOTS.filter((s) => !(REQUIRED_SLOTS as readonly string[]).includes(s)).map((id) => ({ id, label: SLOT_LABELS[id], required: false }))],
      role,
      handover: {
        ...this.view(handover, role),
        ready: handoverReady(handover),
        // Підтвердив орендар: без цього договір не підписати
        confirmed: !!deal.condition?.renterAck,
        confirmedAt: deal.condition?.renterAck?.at ?? null,
        // Обов'язкові фото й одометр передачі фіксує лише власник
        canEdit: p.handoverEdit && role === 'owner',
        canAddDamage: p.handoverEdit || p.handoverLateDamage,
        canConfirm: role === 'renter' && p.handoverEdit && handoverReady(handover) && !deal.condition?.renterAck,
      },
      return: { ...this.view(this.reportOf(deal, 'return'), role), canEdit: p.returnEdit },
    };
  }

  /** Підписи для прямого завантаження фото в Cloudinary: ідентифікатор my-rent/<користувач>/cond/<оренда>/<випадковий рядок> */
  async signature(user: AuthUser, dealId: string, count: number) {
    const { deal } = await this.partyDeal(user, dealId);
    const p = this.perms(deal);
    if (!p.handoverEdit && !p.handoverLateDamage && !p.returnEdit) throw new ConflictException('Зараз додавати фото стану авто не можна');
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) throw new ServiceUnavailableException('Завантаження фото не налаштоване на сервері');
    const timestamp = Math.floor(Date.now() / 1000);
    const items = Array.from({ length: count }, () => {
      const publicId = `${MEDIA_PREFIX}${user.id}/cond/${dealId}/${randomBytes(9).toString('hex')}`;
      return { publicId, timestamp, signature: signUpload({ public_id: publicId, timestamp }, apiSecret), uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` };
    });
    return { cloudName, apiKey, items };
  }

  async putPhoto(user: AuthUser, dealId: string, phase: Phase, dto: { slot: string; url: string; note?: string }) {
    const { deal, role } = await this.partyDeal(user, dealId);
    if (!PHASES.includes(phase)) throw new BadRequestException('Невідомий етап');
    if (phase === 'handover' && role === 'renter' && dto.slot !== 'damage' && this.perms(deal).handoverEdit) throw new ConflictException('Фото стану авто при передачі робить власник. Якщо щось не збігається, додайте пошкодження з описом');
    if (!canChange(phase, dto.slot, this.perms(deal), role)) throw new ConflictException(phase === 'handover' ? 'Фото при передачі вже зафіксовані: тепер можна лише додати пошкодження протягом двох діб після початку оренди' : 'Фіксація при поверненні зараз закрита: вона відкривається за добу до кінця оренди');
    const ref = cloudRefFromUrl(dto.url, this.config.get<string>('CLOUDINARY_CLOUD_NAME'));
    if (!ref || ref.type !== 'image' || !ref.publicId.startsWith(`${MEDIA_PREFIX}${user.id}/cond/${dealId}/`)) throw new BadRequestException('Невірне фото');
    const damage = dto.slot === 'damage';
    if (damage && !(dto.note ?? '').trim()) throw new BadRequestException('Опишіть пошкодження');

    const report = this.reportOf(deal, phase);
    let replaced: string | undefined;
    if (damage) {
      if (report.photos.filter((p) => p.slot === 'damage').length >= MAX_DAMAGE_PHOTOS) throw new ConflictException(`Можна додати до ${MAX_DAMAGE_PHOTOS} фото пошкоджень`);
      report.photos.push({ id: randomBytes(6).toString('hex'), slot: 'damage', url: dto.url, by: role, at: new Date(), note: dto.note!.trim() });
    } else {
      const existing = report.photos.find((p) => p.slot === dto.slot);
      if (existing && existing.by !== role) throw new ConflictException('Це фото вже додала друга сторона. Додайте пошкодження чи зауваження, якщо з ним не погоджуєтесь');
      if (existing) {
        replaced = existing.url;
        report.photos = report.photos.filter((p) => p.slot !== dto.slot);
      }
      const photo: ConditionPhoto = { id: dto.slot, slot: dto.slot, url: dto.url, by: role, at: new Date(), ...(dto.note?.trim() ? { note: dto.note.trim() } : {}) };
      report.photos.push(photo);
    }
    await this.save(deal, phase, report, role);
    if (replaced) void this.media.release([replaced]);
    return this.get(user, dealId);
  }

  async deletePhoto(user: AuthUser, dealId: string, phase: Phase, photoId: string) {
    const { deal, role } = await this.partyDeal(user, dealId);
    const report = this.reportOf(deal, phase);
    const photo = report.photos.find((p) => p.id === photoId);
    if (!photo) throw new NotFoundException('Фото не знайдено');
    if (photo.by !== role) throw new ConflictException('Видалити можна лише своє фото');
    if (!canChange(phase, photo.slot, this.perms(deal), role)) throw new ConflictException('Зараз фото змінювати не можна');
    report.photos = report.photos.filter((p) => p.id !== photoId);
    await this.save(deal, phase, report, role);
    void this.media.release([photo.url]);
    return this.get(user, dealId);
  }

  async setOdometer(user: AuthUser, dealId: string, phase: Phase, km: number) {
    const { deal, role } = await this.partyDeal(user, dealId);
    if (phase === 'handover' && role === 'renter' && this.perms(deal).handoverEdit) throw new ConflictException('Показник одометра при передачі вказує власник');
    if (!canChange(phase, 'dashboard', this.perms(deal), role)) throw new ConflictException('Зараз показник одометра змінювати не можна');
    const report = this.reportOf(deal, phase);
    if (report.odometer && report.odometer.by !== role) throw new ConflictException('Показник одометра вже вказала друга сторона');
    report.odometer = { km, by: role, at: new Date() };
    await this.save(deal, phase, report, role);
    return this.get(user, dealId);
  }

  /**
   * Орендар підтверджує, що переглянув фото власника й погоджується зі станом авто при передачі. Лише для орендаря, поки
   * угоду не активовано й коли власник уже зафіксував усе обов'язкове.
   */
  async confirm(user: AuthUser, dealId: string) {
    const { deal, role } = await this.partyDeal(user, dealId);
    if (role !== 'renter') throw new ConflictException('Стан авто підтверджує орендар');
    if (!this.perms(deal).handoverEdit) throw new ConflictException('Стан авто вже не підтвердити: угоду активовано або скасовано');
    if (!handoverReady(this.reportOf(deal, 'handover'))) throw new ConflictException('Власник ще не зафіксував усі обов’язкові фото й одометр');
    if (deal.condition?.renterAck) return this.get(user, dealId);
    deal.condition = { ...(deal.condition ?? {}), renterAck: { at: new Date() } };
    deal.markModified('condition');
    await deal.save();
    return this.get(user, dealId);
  }

  /** Зберігає звіт. Зміна власником фото чи одометра при передачі скидає підтвердження орендаря: він погоджувався з іншим станом */
  private async save(deal: DealDocument, phase: Phase, report: ConditionReport, role?: 'owner' | 'renter') {
    const keep = { ...(deal.condition ?? {}) };
    if (phase === 'handover' && role === 'owner') delete keep.renterAck;
    deal.condition = { ...keep, [phase]: report };
    deal.markModified('condition');
    await deal.save();
  }

  /** Усі посилання на фото стану авто в оренді: щоб прибрати їх із хмари, коли оренду видалено */
  static urlsOf(deal: { condition?: { handover?: ConditionReport; return?: ConditionReport }; checkin?: CheckinState }) {
    return [...(deal.condition?.handover?.photos ?? []), ...(deal.condition?.return?.photos ?? [])].map((p) => p.url).concat(checkinUrls(deal.checkin));
  }
}
