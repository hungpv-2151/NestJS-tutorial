import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './database/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: { isReady: vi.fn().mockResolvedValue(true) } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('readiness', () => {
    it('returns operational status', async () => {
      await expect(appController.readiness({})).resolves.toEqual({ status: 'ok' });
    });
  });
});
