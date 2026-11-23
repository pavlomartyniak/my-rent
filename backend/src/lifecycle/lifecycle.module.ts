import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { ConditionModule } from '../condition/condition.module';
import { DealsModule } from '../deals/deals.module';
import { LifecycleService } from './lifecycle.service';

@Module({ imports: [ChatModule, ConditionModule, DealsModule], providers: [LifecycleService] })
export class LifecycleModule {}
