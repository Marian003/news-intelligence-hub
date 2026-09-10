import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {validateEnv} from './config/env.validation';
import {DatabaseModule} from './database/database.module';
import {LlmModule} from './llm/llm.module';
import {QueueModule} from './queue/queue.module';
import {WorkerObservabilityModule} from './observability/worker-observability.module';
import {WorkersModule} from './workers/workers.module';

/**
 * Root module for the worker process. Deliberately minimal: config, the database
 * pool, the queues (as both producer and the worker's connection source), and
 * the worker logic — no HTTP server, controllers, or auth.
 */
@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true, validate: validateEnv}),
    DatabaseModule,
    QueueModule,
    WorkerObservabilityModule,
    LlmModule,
    WorkersModule,
  ],
})
export class WorkerModule {}
