CREATE TABLE `modules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`is_always_on` integer DEFAULT false NOT NULL,
	`enabled_at` text,
	`installed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
