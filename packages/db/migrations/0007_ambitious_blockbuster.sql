CREATE TABLE `oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_provider_account_idx` ON `oauth_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `oauth_user_idx` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
DROP INDEX "api_keys_hashed_key_unique";--> statement-breakpoint
DROP INDEX "audit_log_created_at_idx";--> statement-breakpoint
DROP INDEX "audit_log_collection_idx";--> statement-breakpoint
DROP INDEX "comments_entry_idx";--> statement-breakpoint
DROP INDEX "entries_collection_status_idx";--> statement-breakpoint
DROP INDEX "entries_collection_slug_idx";--> statement-breakpoint
DROP INDEX "entries_published_at_idx";--> statement-breakpoint
DROP INDEX "entries_scheduled_at_idx";--> statement-breakpoint
DROP INDEX "entries_review_status_idx";--> statement-breakpoint
DROP INDEX "form_submissions_form_idx";--> statement-breakpoint
DROP INDEX "kv_expires_idx";--> statement-breakpoint
DROP INDEX "media_key_unique";--> statement-breakpoint
DROP INDEX "media_folder_idx";--> statement-breakpoint
DROP INDEX "oauth_provider_account_idx";--> statement-breakpoint
DROP INDEX "oauth_user_idx";--> statement-breakpoint
DROP INDEX "redirects_from_path_unique";--> statement-breakpoint
DROP INDEX "revisions_entry_idx";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "password_hash" TO "password_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hashed_key_unique` ON `api_keys` (`hashed_key`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_collection_idx` ON `audit_log` (`collection`,`entry_id`);--> statement-breakpoint
CREATE INDEX `comments_entry_idx` ON `comments` (`collection`,`entry_id`,`approved`);--> statement-breakpoint
CREATE INDEX `entries_collection_status_idx` ON `entries` (`collection`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `entries_collection_slug_idx` ON `entries` (`collection`,`slug`) WHERE "entries"."slug" is not null;--> statement-breakpoint
CREATE INDEX `entries_published_at_idx` ON `entries` (`published_at`);--> statement-breakpoint
CREATE INDEX `entries_scheduled_at_idx` ON `entries` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `entries_review_status_idx` ON `entries` (`review_status`);--> statement-breakpoint
CREATE INDEX `form_submissions_form_idx` ON `form_submissions` (`form_slug`,`created_at`);--> statement-breakpoint
CREATE INDEX `kv_expires_idx` ON `kv` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_key_unique` ON `media` (`key`);--> statement-breakpoint
CREATE INDEX `media_folder_idx` ON `media` (`folder`);--> statement-breakpoint
CREATE UNIQUE INDEX `redirects_from_path_unique` ON `redirects` (`from_path`);--> statement-breakpoint
CREATE INDEX `revisions_entry_idx` ON `revisions` (`entry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);