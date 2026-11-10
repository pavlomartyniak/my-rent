import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Block, BlockSchema } from '../schemas/block.schema';
import { Report, ReportSchema } from '../schemas/report.schema';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Block.name, schema: BlockSchema },
      { name: Report.name, schema: ReportSchema },
    ]),
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService, MongooseModule],
})
export class ModerationModule {}
