import {Module} from '@nestjs/common';
import {HealthController} from './health.controller';

/**
 * Exposes the health endpoint. The database and Redis clients it needs are
 * provided globally, so no imports are required here.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
