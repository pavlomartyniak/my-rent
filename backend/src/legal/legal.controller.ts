import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Put } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IsBoolean, IsObject } from 'class-validator';
import type { Model } from 'mongoose';

import { type AuthUser, CurrentUser } from '../common/current-user';
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
  ) {}

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
    await syncUnsignedDeals(this.deals, user.id, user.role as 'owner' | 'renter', u.legalEnc);
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
