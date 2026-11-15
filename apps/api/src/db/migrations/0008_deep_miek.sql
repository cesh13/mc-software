CREATE TABLE `core_migration_decisions` (
	`key` text PRIMARY KEY NOT NULL,
	`decision` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`decided_by` text NOT NULL,
	`decided_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `core_migration_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`root` text NOT NULL,
	`importers` text NOT NULL,
	`options` text NOT NULL,
	`status` text NOT NULL,
	`started_by` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`error` text,
	`inspection` text,
	`results` text
);
