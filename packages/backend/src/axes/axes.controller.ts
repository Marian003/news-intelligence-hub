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
import {AxisRow} from '../database/schema';
import {AxesRepository} from './axes.repository';
import {
  CreateAxisInput,
  createAxisSchema,
  UpdateAxisInput,
  updateAxisSchema,
} from './axes.schemas';

/** Axis CRUD — user config, no LLM. New users start with the preset axes. */
@Controller('axes')
@UseGuards(JwtAuthGuard)
export class AxesController {
  constructor(private readonly axes: AxesRepository) {}

  @Get()
  list(@CurrentUser() user: AuthedUser): Promise<AxisRow[]> {
    return this.axes.listByUser(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createAxisSchema)) body: CreateAxisInput
  ): Promise<AxisRow> {
    if ((await this.axes.findByNames(user.userId, [body.name])).length > 0) {
      throw new ConflictException('An axis with that name already exists');
    }
    return this.axes.create(user.userId, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAxisSchema)) body: UpdateAxisInput
  ): Promise<AxisRow> {
    const updated = await this.axes.updateForUser(id, user.userId, body);
    if (!updated) {
      throw new NotFoundException('Axis not found');
    }
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    if (!(await this.axes.deleteForUser(id, user.userId))) {
      throw new NotFoundException('Axis not found');
    }
  }
}
