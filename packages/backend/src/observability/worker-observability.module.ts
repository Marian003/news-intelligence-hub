import {Module} from '@nestjs/common';
import {MetricsModule} from './metrics.module';
import {MetricsServer} from './metrics.server';

/**
 * Worker-process observability: the same registry as the API, exposed over the
 * worker's own scrape port instead of a Nest controller.
 */
@Module({
  imports: [MetricsModule],
  providers: [MetricsServer],
})
export class WorkerObservabilityModule {}
