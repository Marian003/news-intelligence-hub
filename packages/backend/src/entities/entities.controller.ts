import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {CurrentUser} from '../auth/auth.decorators';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthedUser} from '../auth/auth.types';
import {
  EntitiesRepository,
  EntityCard,
  EntityListItem,
} from './entities.repository';

/** Canonical entities for the current user (list + detail card). */
@Controller('entities')
@UseGuards(JwtAuthGuard)
export class EntitiesController {
  constructor(private readonly entities: EntitiesRepository) {}

  @Get()
  list(@CurrentUser() user: AuthedUser): Promise<EntityListItem[]> {
    return this.entities.listForUser(user.userId);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<EntityCard> {
    const card = await this.entities.findCardForUser(id, user.userId);
    if (!card) {
      throw new NotFoundException('Entity not found');
    }
    return card;
  }
}
