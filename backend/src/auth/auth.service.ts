import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';

import { generateCode, OTP_MAX_ATTEMPTS, OTP_MINUTES, OTP_RESEND_SECONDS, resendWait } from '../contract/contract.otp';
import { MailService } from '../mail/mail.service';
import { SUSPENDED_MESSAGE } from '../moderation/moderation.constants';
import { PendingRegistration, type PendingRegistrationDocument } from '../schemas/pending-registration.schema';
import { conflictField } from '../common/field-errors';
import { PHONE_TAKEN } from '../common/profile';
import { UsersService } from '../users/users.service';
import type { LoginDto, RegisterDto, ResetPasswordDto, VerifyRegistrationDto } from './auth.dto';

const ROUNDS = 12;
// Хеш для вирівнювання часу відповіді, коли користувача немає (захист від перебору email)
const DUMMY_HASH = bcrypt.hashSync('dummy-password', ROUNDS);
const RESET_MINUTES = 15;
const RESET_MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60_000;

/** Хеш коду реєстрації прив'язаний до адреси: код, надісланий на одну пошту, не підійде до іншої */
export const registrationHash = (email: string, code: string) => createHash('sha256').update(`register:${email}:${code}`).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @InjectModel(PendingRegistration.name) private readonly pending: Model<PendingRegistration>,
  ) {}

  /**
   * Перший крок реєстрації: зберігає дані як очікувані й надсилає код на пошту. Акаунта ще немає: він з'явиться лише після
   * введення коду, тож адресу, до якої користувач не має доступу, зареєструвати не вийде.
   */
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) throw conflictField('email', 'Користувач з таким email уже існує');
    if (await this.users.phoneTaken(dto.phone)) throw conflictField('phone', PHONE_TAKEN);

    const now = new Date();
    const existing = await this.pending.findOne({ email }).exec();
    this.requireResendAllowed(existing, now);
    const code = this.newCode();
    const inWindow = !!existing && now.getTime() - existing.windowStart.getTime() < HOUR_MS;
    await this.pending.updateOne(
      { email },
      {
        $set: {
          passwordHash: await bcrypt.hash(dto.password, ROUNDS),
          firstName: dto.firstName,
          lastName: dto.lastName,
          middleName: dto.middleName,
          phone: dto.phone,
          role: dto.role ?? 'owner',
          codeHash: registrationHash(email, code),
          expiresAt: new Date(now.getTime() + OTP_MINUTES * 60_000),
          attempts: 0,
          sentAt: now,
          sends: inWindow ? existing.sends + 1 : 1,
          windowStart: inWindow ? existing.windowStart : now,
        },
      },
      { upsert: true },
    );
    await this.deliver(email, code);
    return { email, expiresInMinutes: OTP_MINUTES, resendInSeconds: OTP_RESEND_SECONDS };
  }

  /** Надсилає код ще раз тим, хто вже заповнив форму реєстрації */
  async resendRegistration(emailRaw: string) {
    const email = emailRaw.toLowerCase().trim();
    const existing = await this.pending.findOne({ email }).exec();
    if (!existing) throw new BadRequestException('Спершу заповніть форму реєстрації');
    const now = new Date();
    this.requireResendAllowed(existing, now);
    const code = this.newCode();
    const inWindow = now.getTime() - existing.windowStart.getTime() < HOUR_MS;
    await this.pending.updateOne(
      { email },
      { $set: { codeHash: registrationHash(email, code), expiresAt: new Date(now.getTime() + OTP_MINUTES * 60_000), attempts: 0, sentAt: now, sends: inWindow ? existing.sends + 1 : 1, windowStart: inWindow ? existing.windowStart : now } },
    );
    await this.deliver(email, code);
    return { email, expiresInMinutes: OTP_MINUTES, resendInSeconds: OTP_RESEND_SECONDS };
  }

  /** Другий крок: перевіряє код, створює акаунт і одразу входить. Код одноразовий, спроб обмежена кількість */
  async verifyRegistration(dto: VerifyRegistrationDto) {
    const email = dto.email.toLowerCase().trim();
    const doc = await this.pending.findOne({ email }).exec();
    if (!doc) throw new BadRequestException('Спершу заповніть форму реєстрації');
    if (doc.attempts >= OTP_MAX_ATTEMPTS) throw new BadRequestException('Забагато невдалих спроб. Запросіть новий код');
    if (doc.expiresAt.getTime() < Date.now()) throw new BadRequestException('Код прострочено. Запросіть новий');

    const a = Buffer.from(registrationHash(email, dto.code), 'hex');
    const b = Buffer.from(doc.codeHash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await this.pending.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
      throw new BadRequestException(`Невірний код. Залишилось спроб: ${Math.max(0, OTP_MAX_ATTEMPTS - doc.attempts - 1)}`);
    }
    // Атомарно списуємо код: два паралельні запити не створять два акаунти
    const consumed = await this.pending.findOneAndDelete({ _id: doc._id, codeHash: doc.codeHash }).exec();
    if (!consumed) throw new ConflictException('Код уже використано. Запросіть новий');
    if (await this.users.findByEmail(email)) throw conflictField('email', 'Користувач з таким email уже існує');

    const user = await this.users.create({ email, passwordHash: doc.passwordHash, firstName: doc.firstName, lastName: doc.lastName, middleName: doc.middleName, phone: doc.phone, role: doc.role });
    return this.session(user.id, user.role, this.users.toPublic(user));
  }

  private requireResendAllowed(existing: PendingRegistrationDocument | null, now: Date) {
    const wait = resendWait(existing ? { hash: '', expiresAt: existing.expiresAt, attempts: existing.attempts, sentAt: existing.sentAt } : undefined, now);
    if (wait > 0) throw new HttpException(`Код уже надіслано. Новий можна попросити через ${wait} с`, HttpStatus.TOO_MANY_REQUESTS);
    if (existing && now.getTime() - existing.windowStart.getTime() < HOUR_MS && existing.sends >= MAX_SENDS_PER_HOUR) throw new HttpException('Забагато запитів коду. Спробуйте за годину', HttpStatus.TOO_MANY_REQUESTS);
  }

  private newCode() {
    return generateCode();
  }

  /**
   * Надсилає лист із кодом. Якщо лист не пішов, «надіслано» скасовується: інакше користувач, який бачить помилку, не міг би
   * повторити спробу ще хвилину, хоча жодного коду не отримав.
   */
  private async deliver(email: string, code: string) {
    const sent = await this.mail.send(email, `Kolo: код підтвердження пошти ${code}`, `Ваш код для підтвердження пошти в Kolo: ${code}\n\nКод дійсний ${OTP_MINUTES} хвилин. Нікому його не повідомляйте. Якщо ви не реєструвались у Kolo, просто проігноруйте цей лист.`);
    // Локально (DEMO_MODE) лист лише потрапляє в журнал сервера, тож відсутність пошти там не є помилкою
    if (!sent && this.config.get('DEMO_MODE') !== 'true') {
      await this.pending.updateOne({ email }, { $set: { sentAt: new Date(0) }, $inc: { sends: -1 } });
      throw new ServiceUnavailableException('Не вдалося надіслати лист із кодом. Перевірте адресу й спробуйте ще раз');
    }
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException({ statusCode: 401, error: 'Unauthorized', message: 'Невірний email або пароль', fields: { password: 'Невірний email або пароль' } });
    if (user.suspended) throw new UnauthorizedException(SUSPENDED_MESSAGE);
    return this.session(user.id, user.role, this.users.toPublic(user));
  }

  /** Шестизначний код на пошту, дійсний 15 хвилин. Невідомий email ігноруємо мовчки */
  async forgot(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.users.setReset(user.id, await bcrypt.hash(code, 10), new Date(Date.now() + RESET_MINUTES * 60_000));
    await this.mail.send(
      user.email,
      'Kolo: код для відновлення пароля',
      `Ваш код для відновлення пароля: ${code}\n\nКод дійсний ${RESET_MINUTES} хвилин. Якщо ви не просили відновлення, просто проігноруйте цей лист.`,
    );
  }

  /** Перевіряє код і задає новий пароль; після 5 невдалих спроб код анулюється */
  async reset(dto: ResetPasswordDto) {
    const invalid = new BadRequestException('Невірний або застарілий код');
    const user = await this.users.findByEmail(dto.email);
    if (!user?.resetCodeHash || !user.resetExpires || user.resetExpires.getTime() < Date.now() || (user.resetAttempts ?? 0) >= RESET_MAX_ATTEMPTS) throw invalid;
    if (!(await bcrypt.compare(dto.code, user.resetCodeHash))) {
      await this.users.failReset(user.id, (user.resetAttempts ?? 0) + 1 >= RESET_MAX_ATTEMPTS);
      throw invalid;
    }
    await this.users.finishReset(user.id, await bcrypt.hash(dto.password, ROUNDS));
    return this.session(user.id, user.role, this.users.toPublic(user));
  }

  private async session(userId: string, role: string, user: unknown) {
    return { token: await this.jwt.signAsync({ sub: userId, role }), user };
  }
}
