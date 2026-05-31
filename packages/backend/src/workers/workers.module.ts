import {Module} from '@nestjs/common';
import {ArticleEntitiesRepository} from '../articles/article-entities.repository';
import {ArticlesRepository} from '../articles/articles.repository';
import {LlmCacheRepository} from '../llm/llm-cache.repository';
import {LlmUsageRepository} from '../llm/llm-usage.repository';
import {FeedsRepository} from '../feeds/feeds.repository';
import {ProcessingService} from '../processing/processing.service';
import {ProcessingWorker} from '../processing/processing.worker';
import {FeedPollScheduler} from './feed-poll.scheduler';
import {FeedPollService} from './feed-poll.service';
import {FeedPollWorker} from './feed-poll.worker';

/**
 * Everything the worker process runs: the feed-poll and article-process
 * pipelines. Repositories are registered directly (they only need the global
 * Drizzle provider), so the worker stays free of the API's controllers/auth.
 */
@Module({
  providers: [
    FeedsRepository,
    ArticlesRepository,
    ArticleEntitiesRepository,
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
