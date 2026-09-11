import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async readiness(): Promise<{ status: 'ok' }> {
    if (!(await this.prisma.isReady())) {
      throw new ServiceUnavailableException({ errors: { database: ['unavailable'] } });
    }
    return { status: 'ok' };
  }
}
