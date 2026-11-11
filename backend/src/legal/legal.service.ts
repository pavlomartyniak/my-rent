import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { type CarLegal, carProblems, identityProblems, legalProblems, licenseCoversRental, licenseProblems } from '../common/legal';
import { todayUtc } from '../rentals/rentals.math';
import { Car } from '../schemas/car.schema';
import { User } from '../schemas/user.schema';

/** Недостатні дані для договору: клієнт за кодом відкриває екран «Дані для договору» */
export const legalIncomplete = (message: string, missing: string[], scope: 'me' | 'car' | 'license' | 'other') =>
  new HttpException({ statusCode: HttpStatus.CONFLICT, error: 'Conflict', code: 'LEGAL_INCOMPLETE', scope, missing, message }, HttpStatus.CONFLICT);

/**
 * Перевірки «дані для договору заповнені». Без них у договорі не визначені сторони й предмет, тому запит, пропозицію
 * й публікацію авто без них не приймаємо.
 */
@Injectable()
export class LegalService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
  ) {}

  /** Що ще треба заповнити користувачеві; орендарю додатково посвідчення водія */
  async userProblems(userId: string, role: 'owner' | 'renter'): Promise<string[]> {
    const user = await this.users.findById(userId, 'legal').lean().exec();
    return legalProblems(user?.legal, { needLicense: role === 'renter', today: todayUtc() });
  }

  /** Кидає помилку, якщо дані самого користувача неповні */
  async assertUserReady(userId: string, role: 'owner' | 'renter') {
    const missing = await this.userProblems(userId, role);
    if (missing.length) throw legalIncomplete('Заповніть дані для договору: без них він не буде дійсним', missing, 'me');
  }

  /**
   * Орендар перед запитом чи заявкою: дані для договору й посвідчення водія (номер, строк дії) заповнені, а посвідчення діє до
   * кінця оренди. Якщо бракує лише посвідчення, scope «license» веде на профіль, де його додають.
   */
  async assertRenterCanRent(userId: string, endDate: string) {
    const user = await this.users.findById(userId, 'legal').lean().exec();
    const today = todayUtc();
    const identity = identityProblems(user?.legal, today);
    const license = licenseProblems(user?.legal?.license, today);
    if (identity.length) {
      throw legalIncomplete(
        license.length ? 'Щоб надіслати запит чи створити заявку, ви зобов’язані заповнити дані для договору та посвідчення водія' : 'Щоб надіслати запит чи створити заявку, ви зобов’язані заповнити дані для договору',
        [...identity, ...license],
        'me',
      );
    }
    if (license.length) throw legalIncomplete('Щоб надіслати запит чи створити заявку, ви зобов’язані додати в профілі дані посвідчення водія: серію, номер, категорії та строк дії. Це потрібно для договору', license, 'license');
    const covers = licenseCoversRental(user?.legal, endDate);
    if (covers) throw legalIncomplete(covers, [covers], 'license');
  }

  /** Те саме для авто: держномер і свідоцтво про реєстрацію */
  assertCarReady(car: Partial<CarLegal>) {
    const missing = carProblems(car);
    if (missing.length) throw legalIncomplete('Вкажіть дані авто для договору: державний номер, свідоцтво про реєстрацію й колір', missing, 'car');
  }

  /**
   * Страховка при прийнятті: обидві сторони й авто мають бути готові до договору. Про те, чого бракує другій стороні,
   * кажемо загально, щоб не розкривати чужих даних.
   */
  async assertDealReady(ownerId: string, renterId: string, car: Partial<CarLegal>, acting: 'owner' | 'renter') {
    const [owner, renter] = await Promise.all([this.userProblems(ownerId, 'owner'), this.userProblems(renterId, 'renter')]);
    const mine = acting === 'owner' ? owner : renter;
    if (mine.length) throw legalIncomplete('Заповніть дані для договору: без них він не буде дійсним', mine, 'me');
    const theirs = acting === 'owner' ? renter : owner;
    if (theirs.length) throw legalIncomplete('Друга сторона ще не заповнила дані для договору. Спробуйте пізніше', [], 'other');
    this.assertCarReady(car);
  }
}
