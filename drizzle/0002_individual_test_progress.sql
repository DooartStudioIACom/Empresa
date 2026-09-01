CREATE TABLE IF NOT EXISTS `round_participants` (
	`round_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text NOT NULL,
	`joined_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	PRIMARY KEY(`round_id`, `user_id`),
	FOREIGN KEY (`round_id`) REFERENCES `test_rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_round_participants_round` ON `round_participants` (`round_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `test_item_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`round_id` text NOT NULL,
	`tester_id` text NOT NULL,
	`tester_email` text NOT NULL,
	`tester_name` text NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`result_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `test_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `test_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	UNIQUE(`item_id`,`tester_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_responses_round_tester` ON `test_item_responses` (`round_id`,`tester_id`,`status`);
