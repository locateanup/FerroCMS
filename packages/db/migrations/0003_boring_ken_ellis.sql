CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`collection` text,
	`entry_id` text,
	`details` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_collection_idx` ON `audit_log` (`collection`,`entry_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`entry_id` text NOT NULL,
	`author_name` text NOT NULL,
	`author_email` text,
	`body` text NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_entry_idx` ON `comments` (`collection`,`entry_id`,`approved`);--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`from_path` text NOT NULL,
	`to_path` text NOT NULL,
	`status_code` integer DEFAULT 301 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redirects_from_path_unique` ON `redirects` (`from_path`);--> statement-breakpoint
ALTER TABLE `entries` ADD `scheduled_at` integer;--> statement-breakpoint
CREATE INDEX `entries_scheduled_at_idx` ON `entries` (`status`,`scheduled_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `active` integer DEFAULT true NOT NULL;