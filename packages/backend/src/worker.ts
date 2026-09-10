import 'reflect-metadata';
import {Logger} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {WorkerModule} from './worker.module';
import {createLogger} from './observability/json.logger';

/**
 * Worker entrypoint. Boots a Nest application context (no HTTP listener); the
 * BullMQ workers start via their OnModuleInit hooks. Shutdown hooks let them
 * close cleanly on SIGTERM.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: createLogger(),
  });
  app.enableShutdownHooks();
  new Logger('Worker').log('Worker process started');
}

void bootstrap();
