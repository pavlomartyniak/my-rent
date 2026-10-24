import { Controller, Header, HttpCode, Post, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { signUpload } from './signature';

@Controller('media')
export class MediaController {
  constructor(private readonly config: ConfigService) {}

  /**
   * Підпис для прямого завантаження фото з телефона в Cloudinary: файл не проходить через цей сервер,
   * а API-секрет ніколи не залишає його. Підпис дійсний годину.
   */
  @Roles('owner')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Post('upload-signature')
  signature(@CurrentUser() user: AuthUser) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) throw new ServiceUnavailableException('Завантаження фото не налаштоване на сервері');

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `my-rent/${user.id}`;
    return {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature: signUpload({ folder, timestamp }, apiSecret),
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }
}
