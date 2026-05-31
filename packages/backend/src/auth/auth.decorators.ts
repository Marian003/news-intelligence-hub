import {createParamDecorator, ExecutionContext} from '@nestjs/common';
import type {AuthedUser, VerifiedJwtPayload} from './auth.types';

/** Injects the authenticated identity the guard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    const request = ctx.switchToHttp().getRequest<{user: AuthedUser}>();
    return request.user;
  }
);

/** Injects the full verified JWT payload (used by logout for the token id/exp). */
export const TokenPayload = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): VerifiedJwtPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<{tokenPayload: VerifiedJwtPayload}>();
    return request.tokenPayload;
  }
);
