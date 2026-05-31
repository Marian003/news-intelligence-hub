import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {IMPORTANCE_LEVELS, Importance} from '@nih/shared';
import {CurrentUser} from '../auth/auth.decorators';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthedUser} from '../auth/auth.types';
import {ArticleStatusValue, articleStatus} from '../database/schema';
import {
  ArticleCard,
  ArticleListItem,
  ArticlesRepository,
} from './articles.repository';

function asImportance(raw?: string): Importance | undefined {
  if (!raw) return undefined;
  if (!IMPORTANCE_LEVELS.includes(raw as Importance)) {
    throw new BadRequestException(`Invalid importance: ${raw}`);
  }
  return raw as Importance;
}

function asStatus(raw?: string): ArticleStatusValue | undefined {
  if (!raw) return undefined;
  if (!articleStatus.enumValues.includes(raw as ArticleStatusValue)) {
    throw new BadRequestException(`Invalid status: ${raw}`);
  }
  return raw as ArticleStatusValue;
}

/** Article feed (list + filters) and the article detail card. */
@Controller('articles')
@UseGuards(JwtAuthGuard)
export class ArticlesController {
  constructor(private readonly articles: ArticlesRepository) {}

  @Get()
  list(
    @CurrentUser() user: AuthedUser,
    @Query('status') status?: string,
    @Query('feedId') feedId?: string,
    @Query('importance') importance?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0
  ): Promise<ArticleListItem[]> {
    return this.articles.listForUser(user.userId, {
      status: asStatus(status),
      feedId: feedId || undefined,
      importance: asImportance(importance),
      categoryId: categoryId || undefined,
      q: q?.trim() || undefined,
      limit: Math.min(Math.max(limit, 1), 200),
      offset: Math.max(offset, 0),
    });
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ArticleCard> {
    const card = await this.articles.cardForUser(id, user.userId);
    if (!card) {
      throw new NotFoundException('Article not found');
    }
    return card;
  }
}
