import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';

describe('AuthController (integration)', () => {
  let app: INestApplication;
  let authService: jest.Mocked<
    Pick<
      AuthService,
      'register' | 'verifyEmail' | 'login' | 'me' | 'refresh' | 'logout'
    >
  >;

  const mockUser: User = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: '$2a$12$hashedpassword',
    isEmailVerified: true,
    emailVerifyToken: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      verifyEmail: jest.fn(),
      login: jest.fn(),
      me: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    authService = moduleRef.get(AuthService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should return 201 with a success message', async () => {
      authService.register.mockResolvedValue({
        message:
          'Registration successful. Please check your email to verify your account.',
      });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Registration successful');
      expect(authService.register).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
      );
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          firstName: 'Test',
          lastName: 'User',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: '123',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/verify-email', () => {
    it('should return 200 and verify email', async () => {
      authService.verifyEmail.mockResolvedValue({
        message: 'Email verified successfully',
      });

      const res = await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token: 'valid-token-hex' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Email verified successfully');
      expect(authService.verifyEmail).toHaveBeenCalledWith('valid-token-hex');
    });
  });

  describe('POST /auth/login', () => {
    it('should return 201 and set access_token and refresh_token cookies', async () => {
      authService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: mockUser,
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Login successful');

      const cookies: string[] = [res.headers['set-cookie']].flat();
      expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bad', password: 'password123' });

      expect(res.status).toBe(400);
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('should return 200 with user when access token cookie is present', async () => {
      authService.me.mockResolvedValue({ user: mockUser });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'access_token=valid-token');

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        ...mockUser,
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(authService.me).toHaveBeenCalledWith('valid-token', undefined);
    });

    it('should set new cookies when token pair is rotated', async () => {
      authService.me.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: mockUser,
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'refresh_token=old-refresh-token');

      expect(res.status).toBe(200);

      const cookies: string[] = [res.headers['set-cookie']].flat();
      expect(
        cookies.some((c) => c.startsWith('access_token=new-access-token')),
      ).toBe(true);
      expect(
        cookies.some((c) => c.startsWith('refresh_token=new-refresh-token')),
      ).toBe(true);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 201 and set rotated cookies', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: mockUser,
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=old-refresh-token');

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Token refreshed successfully');
      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');

      const cookies: string[] = [res.headers['set-cookie']].flat();
      expect(
        cookies.some((c) => c.startsWith('access_token=new-access-token')),
      ).toBe(true);
      expect(
        cookies.some((c) => c.startsWith('refresh_token=new-refresh-token')),
      ).toBe(true);
    });

    it('should return 401 when refresh_token cookie is absent', async () => {
      const res = await request(app.getHttpServer()).post('/auth/refresh');

      expect(res.status).toBe(401);
      expect(authService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 201 and clear both cookies', async () => {
      authService.logout.mockResolvedValue({
        message: 'Logged out successfully',
      });

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', 'access_token=token; refresh_token=refresh');

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Logged out successfully');

      const cookies: string[] = [res.headers['set-cookie']].flat();
      // clearCookie sets value to empty string with past expiry
      expect(cookies.some((c) => c.startsWith('access_token=;'))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refresh_token=;'))).toBe(true);
    });

    it('should return 201 even without cookies (already logged out)', async () => {
      authService.logout.mockResolvedValue({
        message: 'Logged out successfully',
      });

      const res = await request(app.getHttpServer()).post('/auth/logout');

      expect(res.status).toBe(201);
    });
  });
});
