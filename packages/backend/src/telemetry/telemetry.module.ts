import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {LlmUsageRepository} from '../llm/llm-usage.repository';
import {TelemetryController} from './telemetry.controller';

/** Read-only LLM cost telemetry endpoint backed by the llm_usage table. */
@Module({
  imports: [AuthModule],
  controllers: [TelemetryController],
  providers: [LlmUsageRepository],
})
export class TelemetryModule {}
