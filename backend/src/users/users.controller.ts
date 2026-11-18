import { BadRequestException, Body, Controller, Get, NotFoundException, Patch } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { MEDIA_PREFIX, publicIdFromUrl } from '../media/cloudinary';
import { MediaService } from '../media/media.service';
import { UpdateMeDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly media: MediaService,
  ) {}

  @Get()
  async me(@CurrentUser() auth: AuthUser) {
    const user = await this.users.findById(auth.id);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.users.toPublic(user);
  }

  @Patch()
  async update(@CurrentUser() auth: AuthUser, @Body() dto: UpdateMeDto) {
    // Фото профілю має лежати в папці самого користувача в нашій хмарі: чужі й сторонні посилання не приймаємо
    if (dto.photoUri) {
      const cloud = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
      const id = publicIdFromUrl(dto.photoUri, cloud);
      if (!cloud || !id?.startsWith(`${MEDIA_PREFIX}${auth.id}/`)) throw new BadRequestException({ message: 'Невірне фото профілю', fields: { photoUri: 'Невірне фото профілю' } });
    }
    const before = dto.photoUri !== undefined ? await this.users.findById(auth.id) : null;
    const user = await this.users.update(auth.id, dto);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    // Замінене чи прибране фото більше нікому не потрібне
    if (before?.photoUri && before.photoUri !== dto.photoUri) void this.media.release([before.photoUri]);
    return this.users.toPublic(user);
  }
}
