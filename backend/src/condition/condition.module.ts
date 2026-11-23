import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { ConditionController } from './condition.controller';
import { ConditionService } from './condition.service';

@Module({ imports: [ChatModule], controllers: [ConditionController], providers: [ConditionService], exports: [ConditionService] })
export class ConditionModule {}
