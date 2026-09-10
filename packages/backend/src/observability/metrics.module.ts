import {Global, Module} from '@nestjs/common';
import {MetricsService} from './metrics.service';

/**
 * Provides the Prometheus registry to whichever process imports it. Global so
 * feature code (e.g. the LLM factory) can inject MetricsService directly.
 *
 * Deliberately contains no HTTP surface: the API exposes the registry through a
 * Nest controller, the worker through its own tiny listener, and the two
 * processes have different transports. See ObservabilityModule and
 * WorkerObservabilityModule.
 */
@Global()
@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
