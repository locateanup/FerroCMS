CREATE TABLE `form_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`form_slug` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `form_submissions_form_idx` ON `form_submissions` (`form_slug`,`created_at`);