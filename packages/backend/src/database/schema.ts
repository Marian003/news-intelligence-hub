import {boolean, pgTable, text, timestamp, uuid} from 'drizzle-orm/pg-core';

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
