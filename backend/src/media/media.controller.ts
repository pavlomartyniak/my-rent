import { randomBytes } from 'node:crypto';

import { Body, Controller, Header, HttpCode, Post, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { MEDIA_PREFIX } from './cloudinary';
import { DiscardDto, UploadSignatureDto } from './media.dto';
import { MediaService } from './media.service';
import { signUpload } from './signature';

@Controller('media')
export class MediaController {
  constructor(
    private readonly config: ConfigService,
    private readonly media: MediaService,
  ) {}

  /**
   * Підпис для прямого завантаження фото з телефона в Cloudinary: файл не проходить через цей сервер,
   * а API-секрет ніколи не залишає його. Підпис дійсний годину. З `count` кожне фото отримує свій підпис і
   * публічний ідентифікатор my-rent/<користувач>/<випадковий рядок>: так видно, чиє фото, і його можна видалити.
   */
  @Roles('owner')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Post('upload-signature')
  signature(@CurrentUser() user: AuthUser, @Body() dto: UploadSignatureDto) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) throw new ServiceUnavailableException('Завантаження фото не налаштоване на сервері');

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `${MEDIA_PREFIX}${user.id}`;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    // Поля старого формату (одна папка на всі фото) лишаються для застосунків, що ще не оновились
    const legacy = { cloudName, apiKey, timestamp, folder, signature: signUpload({ folder, timestamp }, apiSecret), uploadUrl };
    if (!dto.count) return legacy;
    const items = Array.from({ length: dto.count }, () => {
      const publicId = `${folder}/${randomBytes(9).toString('hex')}`;
      return { publicId, timestamp, signature: signUpload({ public_id: publicId, timestamp }, apiSecret) };
    });
    return { ...legacy, items };
  }

  /** Прибрати щойно завантажене фото, яке користувач видалив із форми до збереження. Чужі й уже збережені фото не чіпаються */
  @Roles('owner')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(204)
  @Post('discard')
  async discard(@CurrentUser() user: AuthUser, @Body() dto: DiscardDto) {
    await this.media.discard(user.id, dto.urls);
  }
}
