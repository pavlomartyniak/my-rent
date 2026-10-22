import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { UsersService } from '../users/users.service';
import type { LoginDto, RegisterDto } from './auth.dto';

const ROUNDS = 12;
// Хеш для вирівнювання часу відповіді, коли користувача немає (захист від перебору email)
const DUMMY_HASH = bcrypt.hashSync('dummy-password', ROUNDS);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Користувач з таким email уже існує');
    }
    const user = await this.users.create(dto.email.toLowerCase().trim(), await bcrypt.hash(dto.password, ROUNDS));
    return this.session(user.id, this.users.toPublic(user));
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Невірний email або пароль');
    return this.session(user.id, this.users.toPublic(user));
  }

  private async session(userId: string, user: unknown) {
    return { token: await this.jwt.signAsync({ sub: userId }), user };
  }
}
