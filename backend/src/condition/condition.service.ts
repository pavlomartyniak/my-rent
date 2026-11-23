import { randomBytes } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ChatService } from '../chat/chat.service';
import { signingState, signingWindow } from '../contract/contract.window';
import { claimFlow, dmy } from '../deals/flow';
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
  regularPhotos,
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
    private readonly chat: ChatService,
  ) {}

  /** Службове повідомлення в чат оренди від імені того, хто діє. Збій чату не ламає саму дію */
  private notify(user: AuthUser, dealId: string, kind: string, text: string, link: 'condition' | 'condition-confirm' | 'contract' = 'condition', step?: string) {
    void this.chat.autoStart(user, { dealId }, text, `condition-${kind}-${dealId}-${Date.now()}`, { kind: link, dealId, ...(step ? { step } : {}) });
  }

  private readyText(report: ConditionReport) {
    return `${regularPhotos(report)} фото, пробіг ${(report.odometer?.km ?? 0).toLocaleString('uk-UA')} км`;
  }

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
    const wasReady = handoverReady(report);
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
    const ackReset = await this.save(deal, phase, report, role);
    if (replaced) void this.media.release([replaced]);
    if (damage) {
      const who = role === 'owner' ? 'Власник' : 'Орендар';
      const reconfirm = ackReset ? ' Потрібне повторне підтвердження стану авто.' : '';
      this.notify(user, dealId, 'damage', `${who} додав зауваження до стану авто (${phase === 'handover' ? 'при передачі' : 'при поверненні'}): «${dto.note!.trim()}».${reconfirm}`, ackReset ? 'condition-confirm' : 'condition', ackReset ? 'confirm' : undefined);
    } else {
      this.afterChange(user, deal, phase, role, wasReady, ackReset, report);
    }
    return this.get(user, dealId);
  }

  async deletePhoto(user: AuthUser, dealId: string, phase: Phase, photoId: string) {
    const { deal, role } = await this.partyDeal(user, dealId);
    const report = this.reportOf(deal, phase);
    const photo = report.photos.find((p) => p.id === photoId);
    if (!photo) throw new NotFoundException('Фото не знайдено');
    if (photo.by !== role) throw new ConflictException('Видалити можна лише своє фото');
    if (!canChange(phase, photo.slot, this.perms(deal), role)) throw new ConflictException('Зараз фото змінювати не можна');
    const wasReady = handoverReady(report);
    report.photos = report.photos.filter((p) => p.id !== photoId);
    const ackReset = await this.save(deal, phase, report, role);
    void this.media.release([photo.url]);
    if (photo.slot !== 'damage') this.afterChange(user, deal, phase, role, wasReady, ackReset, report);
    return this.get(user, dealId);
  }

  async setOdometer(user: AuthUser, dealId: string, phase: Phase, km: number) {
    const { deal, role } = await this.partyDeal(user, dealId);
    if (phase === 'handover' && role === 'renter' && this.perms(deal).handoverEdit) throw new ConflictException('Показник одометра при передачі вказує власник');
    if (!canChange(phase, 'dashboard', this.perms(deal), role)) throw new ConflictException('Зараз показник одометра змінювати не можна');
    const report = this.reportOf(deal, phase);
    if (report.odometer && report.odometer.by !== role) throw new ConflictException('Показник одометра вже вказала друга сторона');
    const wasReady = handoverReady(report);
    report.odometer = { km, by: role, at: new Date() };
    const ackReset = await this.save(deal, phase, report, role);
    this.afterChange(user, deal, phase, role, wasReady, ackReset, report);
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
    void this.announceAgreed(user, deal);
    return this.get(user, dealId);
  }

  /** Стан узгоджено: орендар підтвердив. Далі договір: прочитати й підписати, коли відкриється підписання */
  private async announceAgreed(user: AuthUser, deal: DealDocument) {
    const id = String(deal._id);
    const hasContract = !!deal.contract && deal.contract.mode !== 'none';
    const link = hasContract ? 'contract' : 'condition';
    if (!hasContract) return this.notify(user, id, 'confirm', 'Орендар підтвердив стан авто при передачі.', link);
    const legalBoth = !!deal.contract?.terms?.owner?.legal && !!deal.contract?.terms?.renter?.legal;
    const state = signingState(todayUtc(), deal.startDate);
    let text = 'Орендар підтвердив стан авто: стан узгоджено.';
    if (!legalBoth) text += ' Далі: обом сторонам потрібно заповнити дані для договору, тоді відкриється підписання.';
    else if (state === 'open') {
      text += ' Договір готовий: прочитайте його, підписання вже відкрито.';
      await claimFlow(this.deals, id, 'sign-open');
    } else if (state === 'early') text += ` Далі: прочитайте договір. Підписання відкриється ${dmy(signingWindow(deal.startDate).opensAt)}: підпишете його під час зустрічі, коли передаватимете авто.`;
    this.notify(user, id, 'confirm', text, link, hasContract && legalBoth && state === 'open' ? 'sign-both' : undefined);
  }

  /**
   * Повідомлення в чат після зміни фото чи одометра: власник скинув підтвердження орендаря (потрібне нове), звіт передачі став повним
   * (час переглянути й підтвердити) або звіт при поверненні став повним. Проміжні зміни мовчать, щоб не засмічувати чат.
   */
  private afterChange(user: AuthUser, deal: DealDocument, phase: Phase, role: 'owner' | 'renter', wasReady: boolean, ackReset: boolean, report: ConditionReport) {
    const id = String(deal._id);
    const ready = handoverReady(report);
    if (phase === 'handover') {
      if (ackReset) return this.notify(user, id, 'reset', 'Власник змінив стан авто при передачі: потрібне повторне підтвердження.', 'condition-confirm', 'confirm');
      if (role === 'owner' && ready && !wasReady) this.notify(user, id, 'ready', `Власник зафіксував стан авто при передачі: ${this.readyText(report)}. Перегляньте й підтвердіть його, щоб відкрилось підписання договору.`, 'condition-confirm', 'confirm');
      return;
    }
    if (ready && !wasReady) this.notify(user, id, 'return-done', `${role === 'owner' ? 'Власник' : 'Орендар'} зафіксував стан авто при поверненні: ${this.readyText(report)}.`);
  }

  /** Раз на прохід: оренди, де відкрилась фіксація при поверненні, а повідомлення ще не надсилали. Повертає, скільком надіслано */
  async notifyReturnOpen(): Promise<number> {
    const candidates = await this.deals.find({ status: { $in: ['active', 'terminated'] }, 'condition.returnNotifiedAt': { $exists: false }, endDate: { $lte: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10) } }).limit(200).exec();
    let sent = 0;
    for (const deal of candidates) {
      if (!this.perms(deal).returnEdit) continue;
      const claimed = await this.deals.updateOne({ _id: deal._id, 'condition.returnNotifiedAt': { $exists: false } }, { $set: { 'condition.returnNotifiedAt': new Date() } }).exec();
      if (!claimed.modifiedCount) continue;
      this.notify({ id: String(deal.ownerId), role: 'owner' }, String(deal._id), 'return-open', `Відкрилась фіксація стану авто при поверненні (до ${deal.endDate.split('-').reverse().join('.')} і ще 14 днів після). Зробіть фото й вкажіть пробіг: це спільний доказ для обох сторін.`);
      sent += 1;
    }
    return sent;
  }

  /** Зберігає звіт. Зміна власником фото чи одометра при передачі скидає підтвердження орендаря: він погоджувався з іншим станом */
  /** Повертає, чи скинуто підтвердження орендаря */
  private async save(deal: DealDocument, phase: Phase, report: ConditionReport, role?: 'owner' | 'renter'): Promise<boolean> {
    const keep = { ...(deal.condition ?? {}) };
    if (phase === 'handover' && role === 'owner') delete keep.renterAck;
    const ackReset = !!deal.condition?.renterAck && !keep.renterAck;
    deal.condition = { ...keep, [phase]: report };
    deal.markModified('condition');
    await deal.save();
    return ackReset;
  }

  /** Усі посилання на фото стану авто в оренді: щоб прибрати їх із хмари, коли оренду видалено */
  static urlsOf(deal: { condition?: { handover?: ConditionReport; return?: ConditionReport }; checkin?: CheckinState }) {
    return [...(deal.condition?.handover?.photos ?? []), ...(deal.condition?.return?.photos ?? [])].map((p) => p.url).concat(checkinUrls(deal.checkin));
  }
}
