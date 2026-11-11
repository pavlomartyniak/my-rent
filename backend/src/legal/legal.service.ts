import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { type CarLegal, carProblems, identityProblems, licenseCoversRental, licenseProblems } from '../common/legal';
import { todayUtc } from '../rentals/rentals.math';
import { User } from '../schemas/user.schema';

/** Недостатні дані для договору: клієнт за кодом відкриває екран «Дані для договору» */
export const legalIncomplete = (message: string, missing: string[], scope: 'me' | 'car' | 'license' | 'other') =>
  new HttpException({ statusCode: HttpStatus.CONFLICT, error: 'Conflict', code: 'LEGAL_INCOMPLETE', scope, missing, message }, HttpStatus.CONFLICT);

/**
 * Перевірка «дані для договору заповнені». Вимагається лише тоді, коли сторона натискає «Укласти договір»: до цього
 * публікувати авто, надсилати запити й домовлятись можна без паспортних даних, РНОКПП і посвідчення.
 */
@Injectable()
export class LegalService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  /**
   * Сторона хоче укласти договір: її дані мають бути заповнені. Орендарю додатково потрібне посвідчення водія, чинне до
   * кінця оренди; власнику — державний номер авто. Бракуватиме лише посвідчення — scope «license» (веде на профіль),
   * лише номера авто — «car»; інакше «me» (екран «Дані для договору»).
   */
  async assertReadyToContract(userId: string, role: 'owner' | 'renter', car: Partial<CarLegal>, endDate: string) {
    const user = await this.users.findById(userId, 'legal').lean().exec();
    const today = todayUtc();
    const identity = identityProblems(user?.legal, today);
    const license = role === 'renter' ? licenseProblems(user?.legal?.license, today) : [];
    const plate = role === 'owner' ? carProblems(car) : [];
    const covers = role === 'renter' && !license.length ? licenseCoversRental(user?.legal, endDate) : null;
    const lead = 'Щоб укласти договір, ви зобов’язані';

    if (identity.length) {
      const what = license.length ? 'заповнити дані для договору та посвідчення водія' : plate.length ? 'заповнити дані для договору та вказати державний номер авто' : 'заповнити дані для договору';
      throw legalIncomplete(`${lead} ${what}`, [...identity, ...license, ...plate], 'me');
    }
    if (license.length) throw legalIncomplete(`${lead} додати в профілі дані посвідчення водія: серію, номер і строк дії. Це потрібно для договору`, license, 'license');
    if (covers) throw legalIncomplete(covers, [covers], 'license');
    if (plate.length) throw legalIncomplete(`${lead} вказати державний номер авто. Це потрібно для договору`, plate, 'car');
  }
}
