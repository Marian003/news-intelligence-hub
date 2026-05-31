import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {ZodValidationPipe} from '../common/zod-validation.pipe';
import {CurrentUser} from '../auth/auth.decorators';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthedUser} from '../auth/auth.types';
import {FeedsService, FeedView} from './feeds.service';
import {
  CreateFeedInput,
  createFeedSchema,
  UpdateFeedInput,
  updateFeedSchema,
} from './feeds.schemas';

/** Feed CRUD. Every route is authenticated and scoped to the current user. */
@Controller('feeds')
@UseGuards(JwtAuthGuard)
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser): Promise<FeedView[]> {
    return this.feeds.list(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createFeedSchema)) body: CreateFeedInput
  ): Promise<FeedView> {
    return this.feeds.create(user.userId, body);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<FeedView> {
    return this.feeds.getOne(id, user.userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateFeedSchema)) body: UpdateFeedInput
  ): Promise<FeedView> {
    return this.feeds.update(id, user.userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    return this.feeds.remove(id, user.userId);
  }
}
