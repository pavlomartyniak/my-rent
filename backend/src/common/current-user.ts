import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

export type AuthUser = { id: string };

/** Автентифікований користувач із JWT */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export const IS_PUBLIC = 'isPublic';
/** Маршрут без авторизації (реєстрація, вхід, health) */
export const Public = () => SetMetadata(IS_PUBLIC, true);
