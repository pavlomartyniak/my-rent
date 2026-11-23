import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

@Module({ imports: [ChatModule], controllers: [DealsController], providers: [DealsService], exports: [DealsService] })
export class DealsModule {}
