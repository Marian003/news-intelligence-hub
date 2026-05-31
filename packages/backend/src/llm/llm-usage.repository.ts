import {Inject, Injectable} from '@nestjs/common';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {NewLlmUsageRow, llmUsage} from '../database/schema';

/** Records one row per actual provider call for cost telemetry. */
@Injectable()
export class LlmUsageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async record(entry: NewLlmUsageRow): Promise<void> {
    await this.db.insert(llmUsage).values(entry);
  }
}
