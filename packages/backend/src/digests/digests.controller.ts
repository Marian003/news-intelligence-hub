import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {CurrentUser} from '../auth/auth.decorators';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthedUser} from '../auth/auth.types';
import {ZodValidationPipe} from '../common/zod-validation.pipe';
import {DigestRow} from '../database/schema';
import {DigestsService} from './digests.service';
import {CreateDigestBody, createDigestSchema} from './digests.schemas';

/** Period digests (US-11): request a build, list, and read one. */
@Controller('digests')
@UseGuards(JwtAuthGuard)
export class DigestsController {
  constructor(private readonly digests: DigestsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createDigestSchema)) body: CreateDigestBody
  ): Promise<DigestRow> {
    return this.digests.request(user.userId, body);
  }

  @Get()
  list(@CurrentUser() user: AuthedUser): Promise<DigestRow[]> {
    return this.digests.list(user.userId);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<DigestRow> {
    const digest = await this.digests.get(id, user.userId);
    if (!digest) {
      throw new NotFoundException('Digest not found');
    }
    return digest;
  }
}
