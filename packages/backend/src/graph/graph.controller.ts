import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {GraphPayload, IMPORTANCE_LEVELS, Importance} from '@nih/shared';
import {CurrentUser} from '../auth/auth.decorators';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthedUser} from '../auth/auth.types';
import {GraphService} from './graph.service';

const NODE_TYPES = ['article', 'entity'] as const;
type NodeType = (typeof NODE_TYPES)[number];

function parseNodeTypes(raw?: string): NodeType[] {
  if (!raw) return ['article', 'entity'];
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (!NODE_TYPES.includes(part as NodeType)) {
      throw new BadRequestException(`Invalid nodeType: ${part}`);
    }
  }
  if (parts.length === 0) {
    throw new BadRequestException('nodeTypes must not be empty');
  }
  return parts as NodeType[];
}

function parseImportance(raw?: string): Importance[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (!IMPORTANCE_LEVELS.includes(part as Importance)) {
      throw new BadRequestException(`Invalid importance: ${part}`);
    }
  }
  return parts as Importance[];
}

/** Read-only graph payload for the current user. */
@Controller('graph')
@UseGuards(JwtAuthGuard)
export class GraphController {
  constructor(private readonly graph: GraphService) {}

  @Get()
  build(
    @CurrentUser() user: AuthedUser,
    @Query('nodeTypes') nodeTypes?: string,
    @Query('importance') importance?: string,
    @Query('categoryId') categoryId?: string,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit = 200
  ): Promise<GraphPayload> {
    return this.graph.buildGraph(user.userId, {
      nodeTypes: parseNodeTypes(nodeTypes),
      importance: parseImportance(importance),
      categoryId: categoryId || undefined,
      limit: Math.min(Math.max(limit, 1), 1000),
    });
  }
}
