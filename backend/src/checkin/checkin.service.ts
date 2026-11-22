import { randomBytes } from 'node:crypto';

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ChatService } from '../chat/chat.service';
import type { AuthUser } from '../common/current-user';
import { type ContractTerms, contractHash } from '../contract/contract.terms';
import { cloudRefFromUrl, MEDIA_PREFIX } from '../media/cloudinary';
import { signUpload } from '../media/signature';
import { todayUtc } from '../rentals/rentals.math';
import { Deal, type DealDocument } from '../schemas/deal.schema';
import { checkinStatus, type CheckinReport, type CheckinSettings, type CheckinState, describeRequirement, requiredSlots, SLOT_LABELS } from './checkin.rules';
import type { SettingsDto, SubmitDto } from './checkin.dto';

/** Не частіше ніж раз на стільки годин власник може нагадати про звіт */
const REMIND_EVERY_HOURS = 12;
const fmt = (iso: string) => iso.split('-').reverse().join('.');

@Injectable()
export class CheckinService {
  constructor(
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    private readonly config: ConfigService,
    private readonly chat: ChatService,
  ) {}

  private async partyDeal(user: AuthUser, dealId: string) {
    const deal = await this.deals.findOne({ _id: dealId, $or: [{ ownerId: user.id }, { renterId: user.id }] }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    const role: 'owner' | 'renter' = String(deal.ownerId) === user.id ? 'owner' : 'renter';
    return { deal, role };
  }

  private stateOf(deal: DealDocument) {
    return deal.checkin as CheckinState | undefined;
  }

  /** Пробіг, від якого рахується зміна: останній звіт, а якщо їх ще немає — показник при передачі чи пробіг із умов договору */
  private startKm(deal: DealDocument): number | null {
    const handover = (deal.condition?.handover as { odometer?: { km: number } } | undefined)?.odometer?.km;
    return typeof handover === 'number' ? handover : (deal.contract?.terms.car?.mileage ?? null);
  }

  private view(deal: DealDocument, role: 'owner' | 'renter') {
    const st = this.stateOf(deal);
    const status = checkinStatus(deal, st, todayUtc());
    const start = this.startKm(deal);
    const chronological = [...(st?.reports ?? [])].sort((a, b) => a.at.getTime() - b.at.getTime());
    let prev = start;
    const withDelta = chronological.map((r) => {
      const deltaKm = prev === null ? null : r.km - prev;
      prev = r.km;
      return { id: r.id, due: r.due, at: r.at, km: r.km, deltaKm, photos: r.photos.map((p) => ({ slot: p.slot, label: SLOT_LABELS[p.slot] ?? p.slot, url: p.url })) };
    });
    const settings = st?.settings;
    const lastKm = chronological.at(-1)?.km ?? start;
    const remindedAgo = st?.lastRemindAt ? Date.now() - st.lastRemindAt.getTime() : Infinity;
    return {
      role,
      dealStatus: deal.status,
      title: deal.title,
      settings: settings ? { enabled: settings.enabled, every: settings.every, weekday: settings.weekday, body: settings.body, interior: settings.interior } : { enabled: false, every: 'weekly', weekday: new Date(`${deal.startDate}T00:00:00Z`).getUTCDay(), body: true, interior: true },
      requirement: settings?.enabled ? describeRequirement(settings) : null,
      slots: settings?.enabled ? requiredSlots(settings).map((id) => ({ id, label: SLOT_LABELS[id] })) : [],
      status: { state: status.state, due: status.due, overdueDays: status.overdueDays, overdueCount: status.overdueCount },
      reports: withDelta.reverse(),
      startKm: start,
      lastKm,
      totalKm: start !== null && lastKm !== null ? Math.max(0, lastKm - start) : null,
      canConfigure: role === 'owner' && ['awaiting', 'active'].includes(deal.status),
      canSubmit: role === 'renter' && status.openDues.length > 0,
      canRemind: role === 'owner' && (status.state === 'open' || status.state === 'overdue') && remindedAgo > REMIND_EVERY_HOURS * 3_600_000,
    };
  }

  /**
   * Оренди зі звітом, де щось відбувається: для орендаря всі активні (щоб застосунок поставив нагадування й показав «час надіслати»),
   * для власника ті, де звіт уже прострочено. Рядки для блоку «Потрібна ваша увага»
   */
  async attention(user: AuthUser) {
    const side = user.role === 'owner' ? { ownerId: user.id } : { renterId: user.id };
    const deals = await this.deals.find({ ...side, status: 'active', 'checkin.settings.enabled': true }, 'title startDate endDate status checkin').exec();
    const today = todayUtc();
    return deals
      .map((d) => ({ dealId: String(d._id), title: d.title, ...checkinStatus(d, this.stateOf(d), today) }))
      .filter((x) => x.state !== 'none' && (user.role === 'renter' || x.state === 'overdue'))
      .map((x) => ({ dealId: x.dealId, title: x.title, state: x.state, due: x.due, overdueDays: x.overdueDays }));
  }

  async get(user: AuthUser, dealId: string) {
    const { deal, role } = await this.partyDeal(user, dealId);
    return this.view(deal, role);
  }

  /** Власник вмикає чи змінює вимогу; зміну орендар бачить повідомленням у чаті */
  async setSettings(user: AuthUser, dealId: string, dto: SettingsDto) {
    const { deal, role } = await this.partyDeal(user, dealId);
    if (role !== 'owner') throw new ForbiddenException('Налаштовує звіт власник');
    if (!['awaiting', 'active'].includes(deal.status)) throw new ConflictException('Оренду завершено: звіт уже не налаштувати');
    const before = this.stateOf(deal)?.settings;
    const today = todayUtc();
    const next: CheckinSettings = { enabled: dto.enabled, every: dto.every as CheckinSettings['every'], weekday: dto.weekday, body: dto.body, interior: dto.interior, since: before?.enabled ? before.since : today };
    const changed = !before || before.enabled !== next.enabled || before.every !== next.every || before.weekday !== next.weekday || before.body !== next.body || before.interior !== next.interior;
    deal.checkin = { ...(this.stateOf(deal) ?? {}), settings: next };
    deal.markModified('checkin');
    await deal.save();
    await this.syncContract(deal, next);
    if (changed && (next.enabled || before?.enabled)) {
      const text = next.enabled ? `Власник вимагає звіт про авто ${describeRequirement(next)}. Фото треба зробити в застосунку.` : 'Власник вимкнув регулярний звіт про авто.';
      void this.chat.autoStart({ id: user.id, role: 'owner' }, { dealId }, text, `checkin-settings-${dealId}-${Date.now()}`, { kind: 'checkin', dealId });
    }
    return this.view(deal, role);
  }

  /**
   * Поки договір ніхто не підписав, умови звіту записуються в його текст (а за вимкнення прибираються), відбиток перераховується.
   * Підписаний договір не змінюється: там діє загальний пункт про звіти, а конкретні умови видно в застосунку.
   */
  private async syncContract(deal: DealDocument, s: CheckinSettings) {
    if (!deal.contract || deal.contract.mode === 'none' || deal.status !== 'awaiting') return;
    const terms = JSON.parse(JSON.stringify(deal.contract.terms)) as ContractTerms;
    if (s.enabled) terms.checkin = { every: s.every, weekday: s.weekday, body: s.body, interior: s.interior };
    else delete terms.checkin;
    await this.deals
      .updateOne({ _id: deal._id, status: 'awaiting', 'contract.signatures.owner': { $exists: false }, 'contract.signatures.renter': { $exists: false } }, { $set: { 'contract.terms': terms, 'contract.hash': contractHash(terms) } }, { timestamps: false })
      .exec();
  }

  /** Підписи для прямого завантаження фото звіту в Cloudinary: ідентифікатор my-rent/<користувач>/chk/<оренда>/<випадковий рядок> */
  async signature(user: AuthUser, dealId: string, count: number) {
    const { deal, role } = await this.partyDeal(user, dealId);
    if (role !== 'renter') throw new ForbiddenException('Звіт надсилає орендар');
    if (deal.status !== 'active') throw new ConflictException('Звіт можна надсилати лише в активній оренді');
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) throw new ServiceUnavailableException('Завантаження фото не налаштоване на сервері');
    const timestamp = Math.floor(Date.now() / 1000);
    const items = Array.from({ length: count }, () => {
      const publicId = `${MEDIA_PREFIX}${user.id}/chk/${dealId}/${randomBytes(9).toString('hex')}`;
      return { publicId, timestamp, signature: signUpload({ public_id: publicId, timestamp }, apiSecret), uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` };
    });
    return { cloudName, apiKey, items };
  }

  /** Орендар надсилає звіт: усі потрібні фото й пробіг. Закриває найближчі строки й дописує службове повідомлення в чат */
  async submit(user: AuthUser, dealId: string, dto: SubmitDto) {
    const { deal, role } = await this.partyDeal(user, dealId);
    if (role !== 'renter') throw new ForbiddenException('Звіт надсилає орендар');
    const st = this.stateOf(deal);
    const settings = st?.settings;
    const status = checkinStatus(deal, st, todayUtc());
    if (!settings?.enabled || !status.openDues.length) throw new ConflictException('Зараз звіт не потрібен');

    const need = requiredSlots(settings);
    const got = dto.photos.map((p) => p.slot);
    if (new Set(got).size !== got.length || need.some((s) => !got.includes(s)) || got.some((s) => !need.includes(s))) throw new BadRequestException('Додайте всі потрібні фото звіту');
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    for (const p of dto.photos) {
      const ref = cloudRefFromUrl(p.url, cloudName);
      if (!ref || ref.type !== 'image' || !ref.publicId.startsWith(`${MEDIA_PREFIX}${user.id}/chk/${dealId}/`)) throw new BadRequestException('Невірне фото');
    }
    const prev = [...(st?.reports ?? [])].sort((a, b) => b.at.getTime() - a.at.getTime())[0]?.km ?? this.startKm(deal);
    if (prev !== null && dto.km < prev) throw new BadRequestException(`Пробіг не може бути меншим за попередній (${prev} км)`);

    const report: CheckinReport = { id: randomBytes(6).toString('hex'), due: status.openDues.at(-1)!, at: new Date(), km: dto.km, photos: dto.photos.map((p) => ({ slot: p.slot, url: p.url })), by: user.id };
    deal.checkin = { ...(st ?? {}), reports: [...(st?.reports ?? []), report] };
    deal.markModified('checkin');
    await deal.save();

    const delta = prev === null ? null : dto.km - prev;
    const text = `Звіт про авто: пробіг ${dto.km.toLocaleString('uk-UA')} км${delta !== null && delta >= 0 ? ` (+${delta.toLocaleString('uk-UA')} км)` : ''}, ${dto.photos.length} фото.`;
    void this.chat.autoStart({ id: user.id, role: 'renter' }, { dealId }, text, `checkin-${dealId}-${report.id}`, { kind: 'checkin', dealId, reportId: report.id });
    return this.view(deal, role);
  }

  /** Власник нагадує орендарю про звіт: службове повідомлення в чат, не частіше ніж раз на 12 годин */
  async remind(user: AuthUser, dealId: string) {
    const { deal, role } = await this.partyDeal(user, dealId);
    if (role !== 'owner') throw new ForbiddenException('Нагадує власник');
    const st = this.stateOf(deal);
    const status = checkinStatus(deal, st, todayUtc());
    if (status.state !== 'open' && status.state !== 'overdue') throw new ConflictException('Нагадувати поки нема про що');
    if (st?.lastRemindAt && Date.now() - st.lastRemindAt.getTime() < REMIND_EVERY_HOURS * 3_600_000) throw new ConflictException('Нагадування вже надсилали нещодавно. Спробуйте пізніше');
    deal.checkin = { ...(st ?? {}), lastRemindAt: new Date() };
    deal.markModified('checkin');
    await deal.save();
    const text = status.state === 'overdue' ? `Нагадування: звіт про авто прострочено (строк був ${fmt(status.due!)}). Надішліть його, будь ласка.` : `Нагадування: час надіслати звіт про авто (до ${fmt(status.due!)}).`;
    void this.chat.autoStart({ id: user.id, role: 'owner' }, { dealId }, text, `checkin-remind-${dealId}-${Date.now()}`, { kind: 'checkin', dealId });
    return this.view(deal, role);
  }
}
