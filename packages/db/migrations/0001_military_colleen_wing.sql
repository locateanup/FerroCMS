ALTER TABLE `media` ADD `folder` text;--> statement-breakpoint
CREATE INDEX `media_folder_idx` ON `media` (`folder`);