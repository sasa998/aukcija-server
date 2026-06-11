/**
 * Auth E2E tests
 *
 * Requires a running PostgreSQL database. Configure via environment variables
 * or create a `.env.test` file. The test database will have its schema
 * dropped and recreated on each run.
 *
 * Required env vars (defaults shown):
 *   DB_HOST       = localhost
 *   DB_PORT       = 5432
 *   DB_USERNAME   = postgres
 *   DB_PASSWORD   = postgres
 *   TEST_DB_NAME  = aukcija_test
 *   JWT_SECRET    = (required)
 */

// Set test env vars before any module is imported
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'e2e-test-jwt-secret-key-32chars!!';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.RESEND_API_KEY = 're_test_placeholder';

// Mock Resend so no real emails are sent
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }) },
  })),
}));

import { Module } from '@nestjs/common';
import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import cookieParser from 'cookie-parser';

import { AuthModule } from '../src/auth/auth.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';

// ─── Lightweight test module (no AppController/AppService needed) ────────────
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.TEST_DB_NAME ?? 'aukcija_test',
      entities: [User, RefreshToken],
      synchronize: true,
      dropSchema: true, // fresh schema on every test run
    }),
    AuthModule,
  ],
})
class E2ETestModule {}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCookies(
  headers: string | string[] | undefined,
): Record<string, string> {
  if (!headers) return {};
  const list = Array.isArray(headers) ? headers : [headers];
  return Object.fromEntries(
    list.map((cookie) => {
      const [pair] = cookie.split(';');
      const [name, value] = pair.split('=');
      return [name.trim(), value?.trim() ?? ''];
    }),
  );
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;

  const TEST_USER = {
    email: 'e2e-user@example.com',
    firstName: 'E2E',
    lastName: 'Tester',
    password: 'SuperSecure123',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2ETestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();

    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    refreshTokenRepo = moduleFixture.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean DB state before each test
    await refreshTokenRepo.createQueryBuilder().delete().execute();
    await userRepo.createQueryBuilder().delete().execute();
  });

  // ─── Registration ─────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should return 201 and a success message', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER);

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Registration successful');

      const savedUser = await userRepo.findOne({
        where: { email: TEST_USER.email },
      });
      expect(savedUser).toBeDefined();
      expect(savedUser!.isEmailVerified).toBe(false);
      expect(savedUser!.emailVerifyToken).not.toBeNull();
    });

    it('should return 400 when email is already in use', async () => {
      // Register once
      await request(app.getHttpServer()).post('/auth/register').send(TEST_USER);

      // Register again with same email
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER);

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...TEST_USER, email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...TEST_USER, password: '123' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Email verification ───────────────────────────────────────────────────

  describe('GET /auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(TEST_USER);

      const user = await userRepo.findOne({
        where: { email: TEST_USER.email },
      });
      const token = user!.emailVerifyToken!;

      const res = await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Email verified successfully');

      const verified = await userRepo.findOne({
        where: { email: TEST_USER.email },
      });
      expect(verified!.isEmailVerified).toBe(true);
      expect(verified!.emailVerifyToken).toBeNull();
    });

    it('should return 400 for an invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token: 'completely-invalid-token' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Register and verify a fresh user
      await request(app.getHttpServer()).post('/auth/register').send(TEST_USER);
      const user = await userRepo.findOne({
        where: { email: TEST_USER.email },
      });
      await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token: user!.emailVerifyToken! });
    });

    it('should return 201, set cookies and return user on success', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.user.email).toBe(TEST_USER.email);

      const cookies = parseCookies(res.headers['set-cookie']);
      expect(cookies['access_token']).toBeTruthy();
      expect(cookies['refresh_token']).toBeTruthy();
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
    });

    it('should return 401 for non-existent user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: 'anything' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/login (unverified email)', () => {
    it('should return 401 when email is not verified', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(TEST_USER);
      // do NOT verify email

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });

      expect(res.status).toBe(401);
    });
  });

  // ─── Full auth flow ───────────────────────────────────────────────────────

  describe('Full auth flow', () => {
    let agent: ReturnType<(typeof request)['agent']>;

    beforeEach(async () => {
      // Set up a verified user
      await request(app.getHttpServer()).post('/auth/register').send(TEST_USER);
      const user = await userRepo.findOne({
        where: { email: TEST_USER.email },
      });
      await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token: user!.emailVerifyToken! });

      agent = request.agent(app.getHttpServer());

      // Login to seed cookies into agent
      await agent
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });
    });

    it('GET /auth/me should return current user', async () => {
      const res = await agent.get('/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_USER.email);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('POST /auth/refresh should rotate tokens', async () => {
      const before = await refreshTokenRepo.find();
      expect(before).toHaveLength(1);

      const res = await agent.post('/auth/refresh');

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Token refreshed successfully');

      // Old token was deleted, a new one created (still 1 total)
      const after = await refreshTokenRepo.find();
      expect(after).toHaveLength(1);
      expect(after[0].id).not.toBe(before[0].id);
    });

    it('POST /auth/logout should clear cookies and delete refresh token', async () => {
      const res = await agent.post('/auth/logout');

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Logged out successfully');

      const cookies = parseCookies(res.headers['set-cookie']);
      expect(cookies['access_token']).toBe('');
      expect(cookies['refresh_token']).toBe('');

      const remaining = await refreshTokenRepo.find();
      expect(remaining).toHaveLength(0);
    });

    it('GET /auth/me should return 401 after logout', async () => {
      await agent.post('/auth/logout');

      // Start a fresh non-agent request (no cookies)
      const res = await request(app.getHttpServer()).get('/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
