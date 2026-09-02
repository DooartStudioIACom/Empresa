CREATE TABLE IF NOT EXISTS `report_shares` (
	`report_id` text NOT NULL,
	`user_email` text NOT NULL,
	`permission` text DEFAULT 'edit' NOT NULL,
	`shared_by_id` text NOT NULL,
	`shared_by_email` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`report_id`,`user_email`),
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_report_shares_email` ON `report_shares` (`user_email`,`report_id`);
