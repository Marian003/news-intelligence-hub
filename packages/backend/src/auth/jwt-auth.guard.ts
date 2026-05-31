import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import type {Redis} from 'ioredis';
import {REDIS_CLIENT} from '../redis/redis.module';
import type {AuthedUser, VerifiedJwtPayload} from './auth.types';

/** Redis key under which a logged-out token id is denylisted until it expires. */
export function denylistKey(jti: string): string {
  return `auth:denylist:${jti}`;
}

interface AuthedRequest {
  headers: {authorization?: string};
  user?: AuthedUser;
  tokenPayload?: VerifiedJwtPayload;
}

/**
 * Protects routes by requiring a valid, non-denylisted Bearer JWT. On success it
 * attaches both the minimal identity (`user`) and the full verified payload
 * (`tokenPayload`, needed by logout) to the request. JWTs are stateless, so the
 * Redis denylist lookup is what makes logout actually end a session.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: VerifiedJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<VerifiedJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (await this.redis.exists(denylistKey(payload.jti))) {
      throw new UnauthorizedException('Session ended');
    }

    request.user = {userId: payload.sub, email: payload.email};
    request.tokenPayload = payload;
    return true;
  }

  private extractToken(header?: string): string | undefined {
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : undefined;
  }
}
