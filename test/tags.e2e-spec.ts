import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';

const prefix = `e2e_tags_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('tags (live e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const user = { username: `${prefix}_owner`, email: `${prefix}@example.com`, password: 'correct horse battery staple' };
    const registered = await request(app.getHttpServer()).post('/api/users').send({ user }).expect(201);
    await request(app.getHttpServer()).post('/api/articles').set('Authorization', `Token ${registered.body.user.token}`).send({ article: { title: `${prefix} article`, description: 'description', body: 'body', tagList: [`${prefix}_z`, `${prefix}_a`] } }).expect(201);
  });

  afterAll(async () => {
    await prisma.article.deleteMany({ where: { author: { username: { startsWith: prefix } } } });
    await prisma.tag.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await app.close();
  });

  it('returns generated tags sorted by name', async () => {
    const response = await request(app.getHttpServer()).get('/api/tags').expect(200);
    const generated = response.body.tags.filter((tag: string) => tag.startsWith(prefix));
    expect(generated).toEqual([`${prefix}_a`, `${prefix}_z`]);
  });
});
