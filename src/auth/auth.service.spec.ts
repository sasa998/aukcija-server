import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';

type MockRefreshTokenRepo = {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  delete: jest.Mock;
};

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }) },
  })),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenRepo: MockRefreshTokenRepo;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: '$2a$12$hashedpassword',
    isEmailVerified: true,
    emailVerifyToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStoredToken = {
    id: 'rt-uuid-123',
    userId: mockUser.id,
    tokenHash: 'some-token-hash',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByEmailVerifyToken: jest.fn(),
            create: jest.fn().mockReturnValue(mockUser),
            save: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultVal?: string) => {
                const config: Record<string, string> = {
                  RESEND_API_KEY: 'test-resend-key',
                  JWT_REFRESH_EXPIRES_IN: '7d',
                };
                return config[key] ?? defaultVal;
              }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
              };
              if (!config[key])
                throw new Error(`Config key "${key}" not found`);
              return config[key];
            }),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            create: jest.fn().mockReturnValue(mockStoredToken),
            save: jest.fn().mockResolvedValue(mockStoredToken),
            findOne: jest.fn(),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'User',
      password: 'password123',
    };

    it('should create a user and send a verification email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.register(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
      expect(usersService.create).toHaveBeenCalled();
      expect(usersService.save).toHaveBeenCalled();
      expect(result.message).toContain('Registration successful');
    });

    it('should throw BadRequestException when email is already in use', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(
        new BadRequestException('Email already in use'),
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should mark the user as verified and clear the token', async () => {
      const unverified = {
        ...mockUser,
        isEmailVerified: false,
        emailVerifyToken: 'abc123',
      };
      usersService.findByEmailVerifyToken.mockResolvedValue(unverified);

      const result = await service.verifyEmail('abc123');

      expect(unverified.isEmailVerified).toBe(true);
      expect(unverified.emailVerifyToken).toBeNull();
      expect(usersService.save).toHaveBeenCalledWith(unverified);
      expect(result.message).toBe('Email verified successfully');
    });

    it('should throw BadRequestException when token is empty', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow(
        new BadRequestException('Token is required'),
      );
    });

    it('should throw BadRequestException when token is not found', async () => {
      usersService.findByEmailVerifyToken.mockResolvedValue(null);

      await expect(service.verifyEmail('nonexistent')).rejects.toThrow(
        new BadRequestException('Invalid or expired verification token'),
      );
    });
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'password123' };

    it('should return access token, refresh token and user on success', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual(mockUser);
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException when email is not verified', async () => {
      const unverified = { ...mockUser, isEmailVerified: false };
      usersService.findByEmail.mockResolvedValue(unverified);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Please verify your email before logging in'),
      );
    });
  });

  describe('refresh', () => {
    const rawToken = 'raw-refresh-token-value';

    it('should delete old token, issue new tokens and save new token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(mockStoredToken);
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.refresh(rawToken);

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith(mockStoredToken.id);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when raw token is empty string', async () => {
      await expect(service.refresh('')).rejects.toThrow(
        new UnauthorizedException('Refresh token is required'),
      );
    });

    it('should throw UnauthorizedException when token is not found in DB', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
    });

    it('should delete and throw when token is expired', async () => {
      const expired = {
        ...mockStoredToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      refreshTokenRepo.findOne.mockResolvedValue(expired);

      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith(expired.id);
    });

    it('should delete token and throw when user no longer exists', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(mockStoredToken);
      usersService.findById.mockResolvedValue(null);

      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith(mockStoredToken.id);
    });
  });

  describe('me', () => {
    it('should return user when access token is valid', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
      });
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.me('valid-access-token', undefined);

      expect(result).toEqual({ user: mockUser });
    });

    it('should throw UnauthorizedException when both tokens are absent', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.me(undefined, undefined)).rejects.toThrow(
        new UnauthorizedException('Authentication required'),
      );
    });

    it('should refresh and return new tokens when access token is invalid but refresh token is valid', async () => {
      // access token verification fails
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      const newStoredToken = {
        ...mockStoredToken,
        id: 'rt-new',
        tokenHash: 'new-hash',
      };

      // First findOne: called inside refresh() to look up old token
      // Second findOne: called in me() after refresh to retrieve the newly saved token
      refreshTokenRepo.findOne
        .mockResolvedValueOnce(mockStoredToken)
        .mockResolvedValueOnce(newStoredToken);

      // First findById: called inside refresh() to verify user still exists
      // Second findById: called in me() to retrieve freshUser
      usersService.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);

      jwtService.sign.mockReturnValue('new-access-token');

      const result = await service.me(undefined, 'old-raw-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should delete the stored token and return success', async () => {
      const result = await service.logout('some-refresh-token');

      expect(refreshTokenRepo.delete).toHaveBeenCalled();
      expect(result.message).toBe('Logged out successfully');
    });

    it('should return success immediately when no token is provided', async () => {
      const result = await service.logout(undefined);

      expect(refreshTokenRepo.delete).not.toHaveBeenCalled();
      expect(result.message).toBe('Logged out successfully');
    });
  });
});
