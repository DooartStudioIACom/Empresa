ALTER TABLE `reports` ADD COLUMN `from_test_round` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `test_round_id` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `test_round_title` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `test_round_version` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `test_item_id` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `test_item_title` text;
