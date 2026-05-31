import {Module} from '@nestjs/common';
import {ArticlesRepository} from '../articles/articles.repository';
import {AxesRepository} from '../axes/axes.repository';
import {CategoriesRepository} from '../categories/categories.repository';
import {EntitiesRepository} from '../entities/entities.repository';
import {EntityResolutionService} from '../entities/entity-resolution.service';
import {LlmCacheRepository} from '../llm/llm-cache.repository';
import {LlmUsageRepository} from '../llm/llm-usage.repository';
import {FeedsRepository} from '../feeds/feeds.repository';
import {AssignmentsRepository} from '../processing/assignments.repository';
import {ProcessingService} from '../processing/processing.service';
import {ProcessingWorker} from '../processing/processing.worker';
import {FeedPollScheduler} from './feed-poll.scheduler';
import {FeedPollService} from './feed-poll.service';
import {FeedPollWorker} from './feed-poll.worker';

/**
 * Everything the worker process runs: the feed-poll and article-process
 * pipelines, plus entity resolution. Repositories are registered directly (they
 * only need the global Drizzle provider), so the worker stays free of the API's
 * controllers/auth.
 */
@Module({
  providers: [
    FeedsRepository,
    ArticlesRepository,
    EntitiesRepository,
    EntityResolutionService,
    CategoriesRepository,
    AxesRepository,
    AssignmentsRepository,
    LlmCacheRepository,
    LlmUsageRepository,
    FeedPollService,
    FeedPollWorker,
    FeedPollScheduler,
    ProcessingService,
    ProcessingWorker,
  ],
})
export class WorkersModule {}
