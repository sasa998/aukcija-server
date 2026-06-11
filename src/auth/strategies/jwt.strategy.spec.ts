import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-jwt-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user object with id and email from payload', () => {
      const payload: JwtPayload = {
        sub: 'user-id-123',
        email: 'test@example.com',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({ id: 'user-id-123', email: 'test@example.com' });
    });

    it('should map sub field to id', () => {
      const payload: JwtPayload = {
        sub: 'abc-uuid',
        email: 'another@example.com',
      };

      const result = strategy.validate(payload);

      expect(result.id).toBe('abc-uuid');
    });
  });

  describe('constructor', () => {
    it('should throw if JWT_SECRET is not configured', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            JwtStrategy,
            {
              provide: ConfigService,
              useValue: {
                getOrThrow: jest.fn().mockImplementation(() => {
                  throw new Error('JWT_SECRET is not defined');
                }),
              },
            },
          ],
        }).compile(),
      ).rejects.toThrow('JWT_SECRET is not defined');
    });
  });
});
