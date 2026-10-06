import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';

export const allowance=sqliteTable('qloo_allowance',{
  id:text('id').primaryKey(),
  policyHash:text('policy_hash').notNull(),
  used:integer('used').notNull(),
  lastAttemptAt:integer('last_attempt_at').notNull(),
});

export const sessions=sqliteTable('group_sessions',{
  id:text('id').primaryKey(),
  state:text('state').notNull(),
  expiresAt:integer('expires_at').notNull(),
  windowAt:integer('window_at').notNull(),
  requestCount:integer('request_count').notNull(),
  busyUntil:integer('busy_until').notNull(),
  lockToken:text('lock_token'),
});
