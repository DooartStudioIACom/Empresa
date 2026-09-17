ALTER TABLE `attachments` ADD `github_share_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_github_share_token_unique` ON `attachments` (`github_share_token`);--> statement-breakpoint
ALTER TABLE `reports` ADD `github_issue_url` text;