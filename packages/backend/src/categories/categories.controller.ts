import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import {CategoryRow} from '../database/schema';
import {CategoriesRepository} from './categories.repository';
import {
  CreateCategoryInput,
  createCategorySchema,
  UpdateCategoryInput,
  updateCategorySchema,
} from './categories.schemas';

/** Category CRUD — user config, no LLM. Scoped to the current user. */
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesRepository) {}

  @Get()
  list(@CurrentUser() user: AuthedUser): Promise<CategoryRow[]> {
    return this.categories.listByUser(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput
  ): Promise<CategoryRow> {
    if (await this.nameTaken(user.userId, body.name)) {
      throw new ConflictException('A category with that name already exists');
    }
    return this.categories.create(user.userId, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput
  ): Promise<CategoryRow> {
    const updated = await this.categories.updateForUser(id, user.userId, body);
    if (!updated) {
      throw new NotFoundException('Category not found');
    }
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    const deleted = await this.categories.deleteForUser(id, user.userId);
    if (!deleted) {
      throw new NotFoundException('Category not found');
    }
  }

  private async nameTaken(userId: string, name: string): Promise<boolean> {
    const matches = await this.categories.findByNames(userId, [name]);
    return matches.length > 0;
  }
}
