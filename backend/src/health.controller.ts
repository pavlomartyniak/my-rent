import { Controller, Get } from '@nestjs/common';

import { Public } from './common/current-user';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
