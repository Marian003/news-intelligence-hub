import 'reflect-metadata';
import {Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Lets OnModuleDestroy hooks (pool/redis close) run on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('BACKEND_PORT');
  await app.listen(port);

  new Logger('Bootstrap').log(`Backend listening on port ${port}`);
}

void bootstrap();
