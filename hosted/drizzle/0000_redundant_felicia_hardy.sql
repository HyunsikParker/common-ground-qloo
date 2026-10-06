CREATE TABLE `qloo_allowance` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_hash` text NOT NULL,
	`used` integer NOT NULL,
	`last_attempt_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`expires_at` integer NOT NULL,
	`window_at` integer NOT NULL,
	`request_count` integer NOT NULL,
	`busy_until` integer NOT NULL,
	`lock_token` text
);
