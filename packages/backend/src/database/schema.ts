import {ENTITY_TYPES, IMPORTANCE_LEVELS} from '@nih/shared';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type {ArticleAnalysisResult} from '../llm/llm.types';

/**
 * Application accounts. Each row is a tenant: every feed, category, and graph
 * built later is owned by exactly one user id from this table. Email is stored
 * lowercased and is unique. The password is never stored in the clear — only an
 * argon2 hash.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailConfirmed: boolean('email_confirmed').notNull().default(false),
  // Single-use token for the confirmation link; cleared once the email is
  // confirmed. Null means there is no pending confirmation.
  confirmationToken: text('confirmation_token'),
  createdAt: timestamp('created_at', {withTimezone: true})
    .notNull()
    .defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/**
 * Feed lifecycle: `active` is polled on schedule, `paused` is left alone by the
 * user, `error` means the last poll failed (with the reason kept in lastError).
 */
export const feedStatus = pgEnum('feed_status', ['active', 'paused', 'error']);
export type FeedStatusValue = (typeof feedStatus.enumValues)[number];

/**
 * RSS/Atom feeds, each owned by one user. The same URL may be subscribed by
 * several users (one row each) — only the raw articles are shared later, never
 * a user's feed config or status. Unique per (owner, url) so a user can't add
 * the same feed twice.
 */
export const feeds = pgTable(
  'feeds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    url: text('url').notNull(),
    title: text('title'),
    status: feedStatus('status').notNull().default('active'),
    // Reason for the last failed poll; null while healthy.
    lastError: text('last_error'),
    lastPolledAt: timestamp('last_polled_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  table => [
    unique('feeds_user_url_unique').on(table.userId, table.url),
    index('feeds_user_idx').on(table.userId),
  ]
);

export type FeedRow = typeof feeds.$inferSelect;
export type NewFeedRow = typeof feeds.$inferInsert;

/**
 * Article lifecycle through the pipeline: `pending` (ingested, awaiting
 * processing), `processing` (claimed by a worker), `processed` (LLM markup
 * stored), `filtered` (rejected by the deterministic pre-filter, never sent to
 * the LLM), `failed` (processing errored, retry later).
 */
export const articleStatus = pgEnum('article_status', [
  'pending',
  'processing',
  'processed',
  'filtered',
  'failed',
]);
export type ArticleStatusValue = (typeof articleStatus.enumValues)[number];

/** Importance verdict, shared with the graph node schema. */
export const importanceLevel = pgEnum('importance_level', IMPORTANCE_LEVELS);

/** Named-entity kind, from the shared source of truth. */
export const entityType = pgEnum('entity_type', ENTITY_TYPES);

/**
 * Raw articles ingested from feeds. Owned per user (denormalized userId for
 * cheap tenant-scoped queries and the per-user graph). Deduplicated within a
 * user by normalized URL (the unique constraint); contentHash is the secondary
 * dedup key and the LLM cache key. LLM markup is attached in a separate table.
 */
export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    feedId: uuid('feed_id')
      .notNull()
      .references(() => feeds.id, {onDelete: 'cascade'}),
    url: text('url').notNull(),
    normalizedUrl: text('normalized_url').notNull(),
    contentHash: text('content_hash').notNull(),
    guid: text('guid'),
    title: text('title').notNull(),
    author: text('author'),
    content: text('content'),
    publishedAt: timestamp('published_at', {withTimezone: true}),
    status: articleStatus('status').notNull().default('pending'),
    // LLM markup, filled once processed (null until then).
    summary: text('summary'),
    importance: importanceLevel('importance'),
    processedAt: timestamp('processed_at', {withTimezone: true}),
    ingestedAt: timestamp('ingested_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  table => [
    unique('articles_user_url_unique').on(table.userId, table.normalizedUrl),
    index('articles_user_idx').on(table.userId),
    index('articles_feed_idx').on(table.feedId),
    index('articles_user_hash_idx').on(table.userId, table.contentHash),
    index('articles_user_status_idx').on(table.userId, table.status),
  ]
);

export type ArticleRow = typeof articles.$inferSelect;
export type NewArticleRow = typeof articles.$inferInsert;

/**
 * Canonical entities, one row per distinct real-world thing per user. Surface
 * forms that resolve to the same normalizedKey collapse into one row; the
 * variants seen are kept in `aliases`. Mention counts and first/last-seen are
 * derived from article_entities at read time, so reprocessing never leaves stale
 * denormalized values here.
 */
export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    canonicalName: text('canonical_name').notNull(),
    // Lowercased, punctuation/legal-suffix-stripped form used as the merge key.
    normalizedKey: text('normalized_key').notNull(),
    type: entityType('type').notNull(),
    aliases: text('aliases').array().notNull().default([]),
    description: text('description'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  table => [
    unique('entities_user_type_key_unique').on(
      table.userId,
      table.type,
      table.normalizedKey
    ),
    index('entities_user_idx').on(table.userId),
  ]
);

export type EntityRow = typeof entities.$inferSelect;
export type NewEntityRow = typeof entities.$inferInsert;

/**
 * Entity mentions extracted from one article (raw surface name + type), resolved
 * to a canonical entity. The graph (article->entity "mentions" edges and
 * entity<->entity "co_mention" edges) is built by aggregating this table.
 */
export const articleEntities = pgTable(
  'article_entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, {onDelete: 'cascade'}),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, {onDelete: 'cascade'}),
    name: text('name').notNull(),
    type: entityType('type').notNull(),
  },
  table => [
    index('article_entities_article_idx').on(table.articleId),
    index('article_entities_user_idx').on(table.userId),
    index('article_entities_entity_idx').on(table.entityId),
  ]
);

export type ArticleEntityRow = typeof articleEntities.$inferSelect;
export type NewArticleEntityRow = typeof articleEntities.$inferInsert;

/**
 * Content-hash cache of the (user-independent) LLM analysis. Keyed by the
 * article content hash and shared across users: identical content is analyzed
 * once, every later occurrence reuses this — the cross-user cost optimization.
 */
export const llmCache = pgTable('llm_cache', {
  contentHash: text('content_hash').primaryKey(),
  result: jsonb('result').notNull().$type<ArticleAnalysisResult>(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .notNull()
    .defaultNow(),
});

export type LlmCacheRow = typeof llmCache.$inferSelect;

/** The operations that spend LLM tokens, for cost telemetry by type. */
export const llmOperation = pgEnum('llm_operation', [
  'processing',
  'regeneration',
  'digest',
]);
export type LlmOperationValue = (typeof llmOperation.enumValues)[number];

/**
 * One row per actual provider call (cache hits are not recorded — they cost
 * nothing). Drives the "calls + tokens by operation" telemetry. articleId is a
 * loose reference (kept for history even if the article is later deleted).
 */
export const llmUsage = pgTable(
  'llm_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, {onDelete: 'cascade'}),
    articleId: uuid('article_id'),
    operation: llmOperation('operation').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  table => [
    index('llm_usage_operation_idx').on(table.operation),
    index('llm_usage_user_idx').on(table.userId),
  ]
);

export type LlmUsageRow = typeof llmUsage.$inferSelect;
export type NewLlmUsageRow = typeof llmUsage.$inferInsert;
