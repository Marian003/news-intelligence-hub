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
