import {Module} from '@nestjs/common';
import {ArticlesRepository} from '../articles/articles.repository';
import {FeedsRepository} from '../feeds/feeds.repository';
import {FeedPollScheduler} from './feed-poll.scheduler';
import {FeedPollService} from './feed-poll.service';
import {FeedPollWorker} from './feed-poll.worker';

/**
 * Everything the worker process runs. It registers the repositories it needs
 * directly (they only depend on the global Drizzle provider), so the worker
 * stays free of the API's controllers, auth, and HTTP surface.
 */
@Module({
  providers: [
    FeedsRepository,
    ArticlesRepository,
    FeedPollService,
    FeedPollWorker,
    FeedPollScheduler,
  ],
})
export class WorkersModule {}
