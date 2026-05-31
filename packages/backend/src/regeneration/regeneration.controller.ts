import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {CurrentUser} from '../auth/auth.decorators';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthedUser} from '../auth/auth.types';
import {RegenerationService} from './regeneration.service';

/** Triggers and reports on re-analysis of the current user's articles. */
@Controller('regenerate')
@UseGuards(JwtAuthGuard)
export class RegenerationController {
  constructor(private readonly regeneration: RegenerationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  start(@CurrentUser() user: AuthedUser): Promise<{enqueued: number}> {
    return this.regeneration.start(user.userId);
  }

  @Get('status')
  status(@CurrentUser() user: AuthedUser): Promise<{inProgress: number}> {
    return this.regeneration.status(user.userId);
  }
}
