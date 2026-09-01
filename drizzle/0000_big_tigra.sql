CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_activities_report_created_at` ON `activities` (`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_object_key_unique` ON `attachments` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_attachments_report_id` ON `attachments` (`report_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`institution` text NOT NULL,
	`city` text,
	`copy_number` text,
	`inep` text,
	`client_name` text,
	`phone` text,
	`function_name` text NOT NULL,
	`version` text,
	`system_path` text NOT NULL,
	`description` text NOT NULL,
	`school_year` text,
	`urgent` integer DEFAULT false NOT NULL,
	`beta_status` text DEFAULT 'Não testado' NOT NULL,
	`workaround` text,
	`status` text DEFAULT 'Novo report' NOT NULL,
	`author_id` text NOT NULL,
	`author_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reports_status_updated_at` ON `reports` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_reports_version` ON `reports` (`version`);