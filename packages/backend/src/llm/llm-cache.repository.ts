import {Inject, Injectable} from '@nestjs/common';
import {eq} from 'drizzle-orm';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {LlmCacheRow, llmCache} from '../database/schema';
import {ArticleAnalysisResult} from './llm.types';

/**
 * The content-hash LLM cache. A hit means identical content was already
 * analyzed, so no provider call (and no cost) is needed.
 */
@Injectable()
export class LlmCacheRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async get(contentHash: string): Promise<LlmCacheRow | undefined> {
    const rows = await this.db
      .select()
      .from(llmCache)
      .where(eq(llmCache.contentHash, contentHash))
      .limit(1);
    return rows[0];
  }

  async put(entry: {
    contentHash: string;
    result: ArticleAnalysisResult;
    provider: string;
    model: string;
  }): Promise<void> {
    await this.db
      .insert(llmCache)
      .values(entry)
      .onConflictDoUpdate({
        target: llmCache.contentHash,
        set: {
          result: entry.result,
          provider: entry.provider,
          model: entry.model,
        },
      });
  }
}
