/** Queue names and job names, shared by producers (API) and the worker. */

export const FEED_POLL_QUEUE_NAME = 'feed-poll';

/** Injection token for the feed-poll {@link import('bullmq').Queue}. */
export const FEED_POLL_QUEUE = Symbol('FEED_POLL_QUEUE');

export const FeedPollJob = {
  /** Fan-out: enqueue a PollFeed job for every active feed. */
  PollAll: 'poll-all',
  /** Poll one feed by id. */
  PollFeed: 'poll-feed',
} as const;

export interface PollFeedPayload {
  feedId: string;
}

export const ARTICLE_PROCESS_QUEUE_NAME = 'article-process';

/** Injection token for the article-process {@link import('bullmq').Queue}. */
export const ARTICLE_PROCESS_QUEUE = Symbol('ARTICLE_PROCESS_QUEUE');

export const ArticleProcessJob = {
  /** Run the pre-filter + LLM pipeline for one article. */
  Process: 'process-article',
} as const;

export interface ProcessArticlePayload {
  articleId: string;
}
