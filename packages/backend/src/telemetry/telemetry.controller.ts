import {Controller, Get, UseGuards} from '@nestjs/common';
import {CurrentUser} from '../auth/auth.decorators';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthedUser} from '../auth/auth.types';
import {
  LlmUsageByOperation,
  LlmUsageRepository,
} from '../llm/llm-usage.repository';

interface TelemetrySummary {
  byOperation: LlmUsageByOperation[];
  totals: {calls: number; promptTokens: number; completionTokens: number};
}

/** Aggregated LLM cost telemetry for the current user (FR-10). */
@Controller('telemetry')
@UseGuards(JwtAuthGuard)
export class TelemetryController {
  constructor(private readonly usage: LlmUsageRepository) {}

  @Get('llm')
  async llm(@CurrentUser() user: AuthedUser): Promise<TelemetrySummary> {
    const byOperation = await this.usage.aggregateForUser(user.userId);
    const totals = byOperation.reduce(
      (acc, row) => ({
        calls: acc.calls + row.calls,
        promptTokens: acc.promptTokens + row.promptTokens,
        completionTokens: acc.completionTokens + row.completionTokens,
      }),
      {calls: 0, promptTokens: 0, completionTokens: 0}
    );
    return {byOperation, totals};
  }
}
