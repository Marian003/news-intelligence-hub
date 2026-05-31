import {Inject, Injectable, Logger} from '@nestjs/common';
import {Queue} from 'bullmq';
import {ArticlesRepository} from '../articles/articles.repository';
import {
  ARTICLE_PROCESS_QUEUE,
  ArticleProcessJob,
  ProcessArticlePayload,
} from '../queue/queue.constants';

/**
 * Re-analyzes a user's already-processed articles under the current axis set.
 * Runs entirely through the article-process queue (so it is concurrency-limited
 * and never blocks HTTP); progress is read from how many articles are still in
 * the `processing` state.
 */
@Injectable()
export class RegenerationService {
  private readonly logger = new Logger(RegenerationService.name);

  constructor(
    private readonly articles: ArticlesRepository,
    @Inject(ARTICLE_PROCESS_QUEUE) private readonly queue: Queue
  ) {}

  async start(userId: string): Promise<{enqueued: number}> {
    const ids = await this.articles.idsForUserByStatus(userId, 'processed');
    if (ids.length > 0) {
      // Flip to `processing` up front so the progress count is monotonic.
      await this.articles.setStatusForIds(ids, 'processing');
      await this.queue.addBulk(
        ids.map(articleId => ({
          name: ArticleProcessJob.Process,
          data: {
            articleId,
            mode: 'regeneration',
          } satisfies ProcessArticlePayload,
        }))
      );
    }
    this.logger.log(
      `Regeneration enqueued ${ids.length} article(s) for ${userId}`
    );
    return {enqueued: ids.length};
  }

  async status(userId: string): Promise<{inProgress: number}> {
    return {
      inProgress: await this.articles.countForUserByStatus(
        userId,
        'processing'
      ),
    };
  }
}
