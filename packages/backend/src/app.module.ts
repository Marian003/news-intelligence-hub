import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {validateEnv} from './config/env.validation';
import {DatabaseModule} from './database/database.module';
import {RedisModule} from './redis/redis.module';
import {HealthModule} from './health/health.module';

/**
 * Root module. Configuration is loaded and validated once here and made global;
 * the database and Redis connections are wired as global infrastructure modules
 * that feature modules (starting with health) depend on.
 */
@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true, validate: validateEnv}),
    DatabaseModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
