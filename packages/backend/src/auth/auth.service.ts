import {randomBytes, randomUUID} from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {hash, verify} from '@node-rs/argon2';
import type {Redis} from 'ioredis';
import {AxesRepository} from '../axes/axes.repository';
import {REDIS_CLIENT} from '../redis/redis.module';
import {UsersRepository} from '../users/users.repository';
import {denylistKey} from './jwt-auth.guard';
import type {JwtPayload, VerifiedJwtPayload} from './auth.types';
import type {LoginInput, RegisterInput} from './auth.schemas';

export interface RegisterResult {
  id: string;
  email: string;
  emailConfirmed: boolean;
  /** Present only outside production, standing in for a real confirmation email. */
  confirmationUrl?: string;
}

export interface LoginResult {
  accessToken: string;
  user: {id: string; email: string};
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly axes: AxesRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hash(input.password);
    const confirmationToken = randomBytes(32).toString('hex');
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      confirmationToken,
    });
    // Give the new account its starter set of classification axes.
    await this.axes.seedForUser(user.id);

    const baseUrl = this.config.getOrThrow<string>('APP_PUBLIC_URL');
    const confirmationUrl = `${baseUrl}/auth/confirm?token=${confirmationToken}`;
    // No SMTP in dev: the link is always written to the service log, tagged so
    // it is easy to find, and also returned (outside production) for the UI.
    this.logger.log(
      `DEV MODE confirmation link for ${user.email}: ${confirmationUrl}`
    );

    const isProduction =
      this.config.getOrThrow<string>('NODE_ENV') === 'production';
    return {
      id: user.id,
      email: user.email,
      emailConfirmed: user.emailConfirmed,
      confirmationUrl: isProduction ? undefined : confirmationUrl,
    };
  }

  async confirm(token: string): Promise<{confirmed: true}> {
    const user = await this.users.confirmByToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid confirmation token');
    }
    this.logger.log(`Email confirmed for ${user.email}`);
    return {confirmed: true};
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email);
    // Same message for unknown email and wrong password — don't reveal which.
    const invalid = new UnauthorizedException('Invalid credentials');
    if (!user) {
      throw invalid;
    }
    const passwordOk = await verify(user.passwordHash, input.password);
    if (!passwordOk) {
      throw invalid;
    }
    if (!user.emailConfirmed) {
      throw new UnauthorizedException('Email not confirmed');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      jti: randomUUID(),
    };
    const accessToken = await this.jwt.signAsync(payload);
    return {accessToken, user: {id: user.id, email: user.email}};
  }

  async logout(payload: VerifiedJwtPayload): Promise<void> {
    // Denylist the token id until it would expire anyway, so it can't be reused.
    const ttlSeconds = payload.exp - Math.floor(Date.now() / 1000);
    if (ttlSeconds > 0) {
      await this.redis.set(denylistKey(payload.jti), '1', 'EX', ttlSeconds);
    }
  }
}
