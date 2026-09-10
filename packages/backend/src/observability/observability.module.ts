import {Module} from '@nestjs/common';
import {APP_INTERCEPTOR} from '@nestjs/core';
import {MetricsController} from './metrics.controller';
import {MetricsInterceptor} from './metrics.interceptor';
import {MetricsModule} from './metrics.module';

/**
 * API-process observability: the /metrics scrape endpoint and the interceptor
 * that records request latency into it.
 */
@Module({
  imports: [MetricsModule],
  controllers: [MetricsController],
  providers: [{provide: APP_INTERCEPTOR, useClass: MetricsInterceptor}],
})
export class ObservabilityModule {}
