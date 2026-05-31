import {Inject, Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Queue} from 'bullmq';
import {ArticlesRepository} from '../articles/articles.repository';
import {FeedRow, NewArticleRow} from '../database/schema';
import {FeedsRepository} from '../feeds/feeds.repository';
import {contentHash} from '../ingestion/content-hash';
import {ParsedArticle, parseFeed} from '../ingestion/feed-parser';
import {normalizeUrl} from '../ingestion/url-normalize';
import {
  ARTICLE_PROCESS_QUEUE,
  ArticleProcessJob,
  ProcessArticlePayload,
} from '../queue/queue.constants';

export interface PollResult {
  ingested: number;
  total: number;
}

/**
 * The actual feed-poll work, separated from the BullMQ glue so it stays plain
 * and unit-testable: fetch the feed, parse it (deterministic), turn entries into
 * article rows with their dedup keys, insert the new ones, and update the feed's
 * status. A failure is recorded on the feed and rethrown so BullMQ retries.
 */
@Injectable()
export class FeedPollService {
  private readonly logger = new Logger(FeedPollService.name);

  constructor(
    private readonly feeds: FeedsRepository,
    private readonly articles: ArticlesRepository,
    private readonly config: ConfigService,
    @Inject(ARTICLE_PROCESS_QUEUE) private readonly processQueue: Queue
  ) {}

  async activeFeedIds(): Promise<string[]> {
    const rows = await this.feeds.listActive();
    return rows.map(feed => feed.id);
  }

  async pollFeed(feedId: string): Promise<PollResult> {
    const feed = await this.feeds.findById(feedId);
    if (!feed) {
      this.logger.warn(`Poll requested for missing feed ${feedId}`);
      return {ingested: 0, total: 0};
    }

    try {
      const xml = await this.fetchFeed(feed.url);
      const parsed = parseFeed(xml);
      const rows = parsed.articles.map(article => this.toRow(feed, article));
      const inserted = await this.articles.insertNew(rows);

      // Hand each newly-stored article to the processing pipeline.
      if (inserted.length > 0) {
        await this.processQueue.addBulk(
          inserted.map(article => ({
            name: ArticleProcessJob.Process,
            data: {articleId: article.id} satisfies ProcessArticlePayload,
          }))
        );
      }

      await this.feeds.updateById(feed.id, {
        status: 'active',
        lastError: null,
        lastPolledAt: new Date(),
        // Backfill the feed's title from the document if the user didn't set one.
        ...(feed.title ? {} : {title: parsed.title ?? null}),
      });
      this.logger.log(
        `Feed ${feed.id}: ingested ${inserted.length} new of ${parsed.articles.length}`
      );
      return {ingested: inserted.length, total: parsed.articles.length};
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.feeds.updateById(feed.id, {
        status: 'error',
        lastError: message,
        lastPolledAt: new Date(),
      });
      this.logger.error(`Feed ${feed.id} poll failed: ${message}`);
      throw err;
    }
  }

  private async fetchFeed(url: string): Promise<string> {
    const timeoutMs = this.config.getOrThrow<number>('FEED_FETCH_TIMEOUT_MS');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {'user-agent': 'NewsIntelligenceHub/0.1 (+feed-poller)'},
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private toRow(feed: FeedRow, article: ParsedArticle): NewArticleRow {
    const body = article.content ?? article.summary ?? '';
    return {
      userId: feed.userId,
      feedId: feed.id,
      url: article.link,
      normalizedUrl: normalizeUrl(article.link),
      contentHash: contentHash({title: article.title, body}),
      guid: article.guid,
      title: article.title,
      author: article.author,
      content: body,
      publishedAt: article.publishedAt
        ? new Date(article.publishedAt * 1000)
        : undefined,
      status: 'pending',
    };
  }
}
