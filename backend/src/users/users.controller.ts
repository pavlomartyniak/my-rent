import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, Put } from '@nestjs/common';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { legalProblems, licenseProblems, normalizeLegal, normalizeLicense } from '../common/legal';
import { todayUtc } from '../rentals/rentals.math';
import { UpdateLegalDto, UpdateLicenseDto, UpdateMeDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() auth: AuthUser) {
    const user = await this.users.findById(auth.id);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.view(user);
  }

  /** Зберегти дані для договору. Неповні чи хибні дані не приймаються: у відповіді список того, що виправити */
  @Put('legal')
  async setLegal(@CurrentUser() auth: AuthUser, @Body() dto: UpdateLegalDto) {
    // Посвідчення водія зберігається окремо (PATCH /me/license), тому тут його не перевіряємо й не чіпаємо
    const legal = normalizeLegal({ ...dto, license: undefined } as never);
    const problems = legalProblems(legal, { needLicense: false, today: todayUtc() });
    if (problems.length) throw new BadRequestException(problems);
    const user = await this.users.setLegal(auth.id, legal);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.view(user);
  }

  /** Посвідчення водія орендаря. Порожні поля прибирають його; частково заповнене не приймається */
  @Roles('renter')
  @Put('license')
  async setLicense(@CurrentUser() auth: AuthUser, @Body() dto: UpdateLicenseDto) {
    const license = normalizeLicense(dto);
    if (license) {
      const problems = licenseProblems(license, todayUtc());
      if (problems.length) throw new BadRequestException(problems);
    }
    const user = await this.users.setLicense(auth.id, license ?? null);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.view(user);
  }

  @Patch()
  async update(@CurrentUser() auth: AuthUser, @Body() dto: UpdateMeDto) {
    const user = await this.users.update(auth.id, dto);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.view(user);
  }

  /** Профіль для самого користувача: з юридичними даними й переліком того, чого ще бракує для договору */
  private view(user: Parameters<UsersService['toPublic']>[0]) {
    const missing = legalProblems(user.legal, { needLicense: user.role === 'renter', today: todayUtc() });
    return { ...this.users.toPublic(user), legalMissing: missing };
  }
}
