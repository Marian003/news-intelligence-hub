import {ConflictException, Injectable, NotFoundException} from '@nestjs/common';
import {FeedRow, FeedStatusValue} from '../database/schema';
import {FeedPatch, FeedsRepository} from './feeds.repository';
import {CreateFeedInput, UpdateFeedInput} from './feeds.schemas';

/** API representation of a feed (timestamps as ISO strings). */
export interface FeedView {
  id: string;
  url: string;
  title: string | null;
  status: FeedStatusValue;
  lastError: string | null;
  lastPolledAt: string | null;
  createdAt: string;
}

@Injectable()
export class FeedsService {
  constructor(private readonly feeds: FeedsRepository) {}

  async list(userId: string): Promise<FeedView[]> {
    const rows = await this.feeds.listByUser(userId);
    return rows.map(toView);
  }

  async getOne(id: string, userId: string): Promise<FeedView> {
    const row = await this.feeds.findByIdForUser(id, userId);
    if (!row) {
      throw new NotFoundException('Feed not found');
    }
    return toView(row);
  }

  async create(userId: string, input: CreateFeedInput): Promise<FeedView> {
    const existing = await this.feeds.findByUrlForUser(input.url, userId);
    if (existing) {
      throw new ConflictException('Feed already added');
    }
    const row = await this.feeds.create({
      userId,
      url: input.url,
      title: input.title,
    });
    return toView(row);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateFeedInput
  ): Promise<FeedView> {
    const patch: FeedPatch = {};
    if (input.title !== undefined) {
      patch.title = input.title;
    }
    if (input.status !== undefined) {
      patch.status = input.status;
      // Re-activating clears any recorded failure reason.
      if (input.status === 'active') {
        patch.lastError = null;
      }
    }
    const row = await this.feeds.updateForUser(id, userId, patch);
    if (!row) {
      throw new NotFoundException('Feed not found');
    }
    return toView(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const deleted = await this.feeds.deleteForUser(id, userId);
    if (!deleted) {
      throw new NotFoundException('Feed not found');
    }
  }
}

function toView(row: FeedRow): FeedView {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    status: row.status,
    lastError: row.lastError,
    lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
