import { randomInt } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import type { LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';

const ROUNDS = 12;
// Хеш для вирівнювання часу відповіді, коли користувача немає (захист від перебору email)
const DUMMY_HASH = bcrypt.hashSync('dummy-password', ROUNDS);
const RESET_MINUTES = 15;
const RESET_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Користувач з таким email уже існує');
    }
    const user = await this.users.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(dto.password, ROUNDS),
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ?? '',
      role: dto.role ?? 'owner',
    });
    return this.session(user.id, user.role, this.users.toPublic(user));
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Невірний email або пароль');
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
