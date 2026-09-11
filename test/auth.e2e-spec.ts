import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';

const prefix = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const password = 'correct horse battery staple';
type User = { username: string; email: string; password: string; token: string };

describe('authentication and users (live e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await app.close();
  });

  async function register(suffix: string): Promise<User> {
    const user = { username: `${prefix}_${suffix}`, email: `${prefix}_${suffix}@example.com`, password };
    const response = await request(app.getHttpServer()).post('/api/users').send({ user }).expect(201);
    return response.body.user;
  }

  it('registers, logs in, and reads the current user', async () => {
    const created = await register('current');
    const login = await request(app.getHttpServer()).post('/api/users/login').send({ user: { email: created.email, password } }).expect(201);
    expect(login.body.user.username).toBe(created.username);
    await request(app.getHttpServer()).get('/api/user').set('Authorization', `Token ${login.body.user.token}`).expect(200).expect(({ body }) => {
      expect(body.user.email).toBe(created.email);
      expect(body.user).not.toHaveProperty('password');
    });
  });

  it('updates settings and returns a fresh token', async () => {
    const created = await register('settings');
    const updatedName = `${prefix}_settings_updated`;
    const response = await request(app.getHttpServer()).put('/api/user').set('Authorization', `Token ${created.token}`).send({ user: { username: updatedName, bio: '', image: null } }).expect(200);
    expect(response.body.user.username).toBe(updatedName);
    expect(response.body.user.bio).toBeNull();
    await request(app.getHttpServer()).get('/api/user').set('Authorization', `Token ${response.body.user.token}`).expect(200);
  });

  it('rejects malformed Token authorization', async () => {
    await register('malformed');
    await request(app.getHttpServer()).get('/api/user').set('Authorization', 'Bearer definitely-not-a-token').expect(401).expect({ errors: { token: ['is invalid'] } });
  });

  it('invalidates the previous token after a password update', async () => {
    const created = await register('password');
    const nextPassword = 'new correct horse battery staple';
    const update = await request(app.getHttpServer()).put('/api/user').set('Authorization', `Token ${created.token}`).send({ user: { password: nextPassword } }).expect(200);
    await request(app.getHttpServer()).get('/api/user').set('Authorization', `Token ${created.token}`).expect(401);
    await request(app.getHttpServer()).post('/api/users/login').send({ user: { email: created.email, password: nextPassword } }).expect(201);
    expect(update.body.user.token).not.toBe(created.token);
  });

  it('maps duplicate email and username to conflict responses', async () => {
    const created = await register('duplicate');
    await request(app.getHttpServer()).post('/api/users').send({ user: { username: `${prefix}_other_email`, email: created.email, password } }).expect(409).expect({ errors: { email: ['has already been taken'] } });
    await request(app.getHttpServer()).post('/api/users').send({ user: { username: created.username, email: `${prefix}_other_username@example.com`, password } }).expect(409).expect({ errors: { username: ['has already been taken'] } });
  });

  it.each([undefined, null])('rejects a %s user wrapper', async (user) => {
    const body = user === undefined ? {} : { user };
    await request(app.getHttpServer()).post('/api/users').send(body).expect(422).expect(({ body: response }) => {
      expect(response.errors.user).toBeDefined();
    });
    await request(app.getHttpServer()).post('/api/users/login').send(body).expect(422).expect(({ body: response }) => {
      expect(response.errors.user).toBeDefined();
    });
  });

  it('rejects an empty user update wrapper', async () => {
    const created = await register('empty_update');
    await request(app.getHttpServer()).put('/api/user').set('Authorization', `Token ${created.token}`).send({ user: {} }).expect(422).expect(({ body: response }) => {
      expect(response.errors.user).toBeDefined();
    });
  });

  it('throttles distinct registrations from one client address', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) await register(`throttle_${attempt}`);
    await request(app.getHttpServer()).post('/api/users').send({ user: { username: `${prefix}_throttle_3`, email: `${prefix}_throttle_3@example.com`, password } }).expect(429).expect({ errors: { request: ['rate limit exceeded'] } });
  });
});
