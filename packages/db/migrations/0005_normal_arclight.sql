ALTER TABLE `entries` ADD `review_status` text;--> statement-breakpoint
ALTER TABLE `entries` ADD `review_note` text;--> statement-breakpoint
ALTER TABLE `entries` ADD `review_requested_at` integer;--> statement-breakpoint
ALTER TABLE `entries` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `entries` ADD `reviewed_by_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `entries_review_status_idx` ON `entries` (`review_status`);