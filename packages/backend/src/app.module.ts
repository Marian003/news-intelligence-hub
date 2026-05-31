import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {validateEnv} from './config/env.validation';
import {ArticlesModule} from './articles/articles.module';
import {AuthModule} from './auth/auth.module';
import {AxesModule} from './axes/axes.module';
import {CategoriesModule} from './categories/categories.module';
import {DatabaseModule} from './database/database.module';
import {EntitiesModule} from './entities/entities.module';
import {FeedsModule} from './feeds/feeds.module';
import {GraphModule} from './graph/graph.module';
import {QueueModule} from './queue/queue.module';
import {RegenerationModule} from './regeneration/regeneration.module';
import {RedisModule} from './redis/redis.module';
import {HealthModule} from './health/health.module';

/**
 * Root module. Configuration is loaded and validated once here and made global;
 * the database and Redis connections are wired as global infrastructure modules
 * that feature modules (health, auth, …) depend on.
 */
@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true, validate: validateEnv}),
    DatabaseModule,
    RedisModule,
    QueueModule,
    HealthModule,
    AuthModule,
    FeedsModule,
    CategoriesModule,
    AxesModule,
    ArticlesModule,
    EntitiesModule,
    GraphModule,
    RegenerationModule,
  ],
})
export class AppModule {}
