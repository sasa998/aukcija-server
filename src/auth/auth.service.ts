import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly resend: Resend;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {
    this.resend = new Resend(configService.get<string>('RESEND_API_KEY'));
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    const user = this.usersService.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      emailVerifyToken,
      isEmailVerified: false,
    });

    await this.usersService.save(user);

    const frontendUrl = 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${emailVerifyToken}`;

    await this.resend.emails.send({
      from: 'Aukcija Tim <onboarding@resend.dev>',
      to: dto.email,
      subject: 'Verify your email address',
      html: `<p>Poštovani ${dto.firstName},</p>
             <p>Molimo vas da potvrdite svoju email adresu klikom na link ispod:</p>
             <p><a href="${verifyUrl}">${verifyUrl}</a></p>
              <p>Hvala vam,<br/>Aukcija Team</p>`,
    });

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    const user = await this.usersService.findByEmailVerifyToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerifyToken = null;
    await this.usersService.save(user);

    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    await this.refreshTokenRepository.delete({ userId: user.id });

    const accessToken = this.generateAccessToken(user.id, user.email);
    const { refreshToken, expiresAt } = this.generateRefreshToken();
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const rt = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await this.refreshTokenRepository.save(rt);

    return { accessToken, refreshToken, user };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    return this.refreshTokenRepository.manager.transaction(async (em) => {
      // Pessimistic write lock: only one concurrent request can process
      // this token at a time, preventing duplicate token creation.
      // Later for better security and scaling switch to Token rotation + transaction
      const storedToken = await em.findOne(RefreshToken, {
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      if (storedToken.expiresAt < new Date()) {
        await em.delete(RefreshToken, { id: storedToken.id });
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = await this.usersService.findById(storedToken.userId);
      if (!user) {
        await em.delete(RefreshToken, { id: storedToken.id });
        throw new UnauthorizedException('User not found');
      }

      // Rotate: delete old token, issue new one atomically
      await em.delete(RefreshToken, { id: storedToken.id });

      const accessToken = this.generateAccessToken(user.id, user.email);
      const { refreshToken: newRefreshToken, expiresAt } =
        this.generateRefreshToken();
      const newTokenHash = crypto
        .createHash('sha256')
        .update(newRefreshToken)
        .digest('hex');

      const rt = em.create(RefreshToken, {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt,
      });
      await em.save(RefreshToken, rt);

      return { accessToken, refreshToken: newRefreshToken, user };
    });
  }

  async me(accessToken: string | undefined, refreshToken: string | undefined) {
    const user = await this.findUserByAccessToken(accessToken);
    if (user) {
      return { user };
    }

    if (!refreshToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: freshUser,
    } = await this.refresh(refreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: freshUser,
    };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return { message: 'Logged out successfully' };
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.refreshTokenRepository.delete({ tokenHash });

    return { message: 'Logged out successfully' };
  }

  private generateAccessToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }

  private async findUserByAccessToken(accessToken: string | undefined) {
    if (!accessToken) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(accessToken);

      return await this.usersService.findById(payload.sub);
    } catch {
      return null;
    }
  }

  private generateRefreshToken(): { refreshToken: string; expiresAt: Date } {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const expiresAt = new Date(Date.now() + this.parseDuration(expiresIn));
    return { refreshToken, expiresAt };
  }

  private parseDuration(duration: string): number {
    const match = /^(\d+)([dhm])$/.exec(duration);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
