CREATE TABLE `test_items` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`path` text,
	`description` text,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`tester_id` text,
	`tester_email` text,
	`result_note` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `test_rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_test_items_round_position` ON `test_items` (`round_id`,`position`);--> statement-breakpoint
CREATE TABLE `test_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`version` text NOT NULL,
	`deadline` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Em andamento' NOT NULL,
	`author_id` text NOT NULL,
	`author_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_test_rounds_status_updated_at` ON `test_rounds` (`status`,`updated_at`);