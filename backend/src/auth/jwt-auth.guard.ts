import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type { Role } from '../common/constants';
import { type AuthUser, IS_PUBLIC, ROLES_KEY } from '../common/current-user';

/** Глобальний guard: усі маршрути закриті, крім позначених @Public() */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Потрібна авторизація');

    let user: AuthUser;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role?: Role }>(token);
      // Токени, видані до появи ролей, належать власникам
      user = { id: payload.sub, role: payload.role ?? 'owner' };
    } catch {
      throw new UnauthorizedException('Сесія завершилась, увійдіть знову');
    }
    req.user = user;

    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (allowed && !allowed.includes(user.role)) throw new ForbiddenException('Ця дія недоступна для вашого типу акаунта');
    return true;
  }
}
