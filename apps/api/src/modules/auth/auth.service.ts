import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Response, Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

const REFRESH_COOKIE_NAME = 'refresh_token';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new ForbiddenException('La cuenta está inactiva o suspendida');
    }

    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = this.generateTokens(user.id, user.email, user.role.name);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(tokens.refreshToken),
        expiresAt: new Date(tokens.refreshExpiresAt),
      },
    });

    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
      },
    };
  }

  async refresh(req: Request, res: Response) {
    const cookies = (req as { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[REFRESH_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException('Token de renovación no encontrado');
    }

    const tokenHash = this.hashRefreshToken(token);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });

    if (!stored) {
      throw new UnauthorizedException('Token de renovación inválido');
    }

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Token de renovación expirado');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const newTokens = this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role.name,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: stored.user.id,
        tokenHash: this.hashRefreshToken(newTokens.refreshToken),
        expiresAt: new Date(newTokens.refreshExpiresAt),
      },
    });

    res.cookie(REFRESH_COOKIE_NAME, newTokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });

    return { accessToken: newTokens.accessToken };
  }

  async logout(req: Request, res: Response) {
    const cookies = (req as { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[REFRESH_COOKIE_NAME];

    if (token) {
      const tokenHash = this.hashRefreshToken(token);
      await this.prisma.refreshToken
        .deleteMany({ where: { tokenHash } })
        .catch(() => {});
    }

    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth/refresh' });

    return { message: 'Sesión cerrada exitosamente' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, studentProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      documentNumber: user.documentNumber,
      role: user.role.name,
      isActive: user.isActive,
      studentProfile: user.studentProfile,
    };
  }

  private generateTokens(userId: string, email: string, role: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    const refreshToken = randomBytes(40).toString('hex');
    const refreshExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
