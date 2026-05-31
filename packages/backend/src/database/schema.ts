import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

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
