import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Put } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IsBoolean, IsObject } from 'class-validator';
import type { Model } from 'mongoose';

import { ChatService } from '../chat/chat.service';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { handoverAgreed, handoverReady } from '../condition/condition.rules';
import { claimFlow } from '../deals/flow';
import { Deal, type DealDocument } from '../schemas/deal.schema';
import { User, type UserDocument } from '../schemas/user.schema';
import { syncUnsignedDeals } from './legal.sync';
import { EMPTY_LEGAL, LEGAL_CONSENT_VERSION, type LegalData, legalProblems, normalizeLegal, seal, unseal } from './legal.data';

class SaveLegalDto {
  @IsObject()
  data: Record<string, unknown>;

  /** Згода на обробку персональних даних для договору */
  @IsBoolean()
  consent: boolean;
}

@Controller('legal')
export class LegalController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Deal.name) private readonly deals: Model<DealDocument>,
    private readonly chat: ChatService,
  ) {}

  /**
   * Службові повідомлення в чат оренд, де людина щойно вперше внесла дані: другій стороні пора заповнити свої, а коли заповнили обидві,
   * названо наступний крок. Повторне редагування даних мовчить.
   */
  private async announce(user: AuthUser, items: Awaited<ReturnType<typeof syncUnsignedDeals>>) {
    const role = user.role as 'owner' | 'renter';
    for (const it of items) {
      const first = await claimFlow(this.deals, it.id, `legal-${role}`);
      if (!first) continue;
      const send = (text: string, kind: 'legal' | 'condition' | 'condition-confirm' | 'contract', step?: string) => void this.chat.autoStart(user, { dealId: it.id }, text, `flow-legal-${it.id}-${role}`, { kind, dealId: it.id, ...(step ? { step } : {}) });
      if (!(it.owner && it.renter)) {
        send(`${role === 'owner' ? 'Власник' : 'Орендар'} заповнив дані для договору. Заповніть свої: без цього договір не підписати.`, 'legal', 'legal');
      } else if (await claimFlow(this.deals, it.id, 'legal-both')) {
        const c = it.condition;
        if (!handoverReady(c?.handover as never)) send('Дані для договору заповнено обома сторонами. Далі: власник фіксує стан авто (фото й показник одометра).', 'condition', 'fix');
        else if (!handoverAgreed(c as never)) send('Дані для договору заповнено обома сторонами. Далі: орендар переглядає й підтверджує стан авто.', 'condition-confirm', 'confirm');
        else send('Дані для договору заповнено обома сторонами. Далі: прочитайте договір, а підпишете його під час зустрічі.', 'contract');
      }
    }
  }

  private view(u: UserDocument, role: string) {
    const data: LegalData | null = unseal(u.legalEnc);
    return {
      data: data ?? EMPTY_LEGAL,
      saved: !!data,
      complete: !!data && Object.keys(legalProblems(data, role)).length === 0,
      consent: !!u.legalConsentAt,
      consentVersion: LEGAL_CONSENT_VERSION,
    };
  }

  /** Свої дані для договору (розшифровані, лише власнику) */
  @Header('Cache-Control', 'no-store')
  @Get('me')
  async mine(@CurrentUser() user: AuthUser) {
    const u = await this.users.findById(user.id).exec();
    if (!u) throw new BadRequestException('Користувача не знайдено');
    return this.view(u, user.role);
  }

  /** Зберегти дані: перевіряємо повністю, помилки повертаємо по полях */
  @HttpCode(200)
  @Put('me')
  async save(@CurrentUser() user: AuthUser, @Body() dto: SaveLegalDto) {
    if (!dto.consent) throw new BadRequestException('Потрібна згода на обробку даних для договору');
    const data = normalizeLegal(dto.data);
    const problems = legalProblems(data, user.role);
    if (Object.keys(problems).length) throw new BadRequestException({ message: Object.values(problems)[0], fields: problems });
    const u = await this.users
      .findByIdAndUpdate(user.id, { legalEnc: seal(data), legalConsentAt: new Date(), legalConsentVersion: LEGAL_CONSENT_VERSION }, { returnDocument: 'after' })
      .exec();
    if (!u) throw new BadRequestException('Користувача не знайдено');
    const synced = await syncUnsignedDeals(this.deals, user.id, user.role as 'owner' | 'renter', u.legalEnc);
    void this.announce(user, synced);
    return this.view(u, user.role);
  }

  /** Видалити свої дані для договору (у вже сформованих договорах вони лишаються як частина документа) */
  @HttpCode(200)
  @Delete('me')
  async remove(@CurrentUser() user: AuthUser) {
    const u = await this.users.findByIdAndUpdate(user.id, { $unset: { legalEnc: 1, legalConsentAt: 1, legalConsentVersion: 1 } }, { returnDocument: 'after' }).exec();
    if (!u) throw new BadRequestException('Користувача не знайдено');
    await syncUnsignedDeals(this.deals, user.id, user.role as 'owner' | 'renter', undefined);
    return this.view(u, user.role);
  }
}
