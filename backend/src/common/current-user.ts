import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

import type { Role } from './constants';

export type AuthUser = { id: string; role: Role };

/** Автентифікований користувач із JWT */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export const ROLES_KEY = 'roles';
/** Лише для вказаних типів акаунта (власник або орендар) */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC = 'isPublic';
/** Маршрут без авторизації (реєстрація, вхід, health) */
export const Public = () => SetMetadata(IS_PUBLIC, true);
