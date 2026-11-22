import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';

@Module({ imports: [ChatModule], controllers: [CheckinController], providers: [CheckinService] })
export class CheckinModule {}
