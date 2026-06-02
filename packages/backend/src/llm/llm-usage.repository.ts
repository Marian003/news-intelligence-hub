import {Inject, Injectable} from '@nestjs/common';
import {eq, sql} from 'drizzle-orm';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {LlmOperationValue, NewLlmUsageRow, llmUsage} from '../database/schema';

export interface LlmUsageByOperation {
  operation: LlmOperationValue;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Records one row per actual provider call for cost telemetry. */
@Injectable()
export class LlmUsageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async record(entry: NewLlmUsageRow): Promise<void> {
    await this.db.insert(llmUsage).values(entry);
  }

  /** Per-operation call and token totals for one user (telemetry dashboard). */
  async aggregateForUser(userId: string): Promise<LlmUsageByOperation[]> {
    const rows = await this.db
      .select({
        operation: llmUsage.operation,
        calls: sql<number>`count(*)::int`,
        promptTokens: sql<number>`coalesce(sum(${llmUsage.promptTokens}), 0)::int`,
        completionTokens: sql<number>`coalesce(sum(${llmUsage.completionTokens}), 0)::int`,
      })
      .from(llmUsage)
      .where(eq(llmUsage.userId, userId))
      .groupBy(llmUsage.operation);
    return rows.map(row => ({
      ...row,
      totalTokens: row.promptTokens + row.completionTokens,
    }));
  }
}
