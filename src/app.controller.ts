import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service.js';
import { PaginationQueryDto } from './common/dto/pagination-query.dto.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health/readiness')
  readiness(@Query() _pagination: PaginationQueryDto): Promise<{ status: 'ok' }> {
    return this.appService.readiness();
  }
}
