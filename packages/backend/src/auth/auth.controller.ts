import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {ZodValidationPipe} from '../common/zod-validation.pipe';
import {CurrentUser, TokenPayload} from './auth.decorators';
import {AuthService} from './auth.service';
import {JwtAuthGuard} from './jwt-auth.guard';
import {
  LoginInput,
  loginSchema,
  RegisterInput,
  registerSchema,
} from './auth.schemas';
import type {AuthedUser, VerifiedJwtPayload} from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Get('confirm')
  confirm(@Query('token') token?: string) {
    if (!token) {
      throw new BadRequestException('Missing confirmation token');
    }
    return this.auth.confirm(token);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@TokenPayload() payload: VerifiedJwtPayload): Promise<void> {
    await this.auth.logout(payload);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthedUser): AuthedUser {
    return user;
  }
}
