CREATE TABLE `core_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`area` text NOT NULL,
	`period` text NOT NULL,
	`status` text NOT NULL,
	`closed_by` text,
	`closed_at` text,
	`reopened_by` text,
	`reopened_at` text,
	`reopen_reason` text,
	`filed_ref` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_periods_empresa_area_period_uq` ON `core_periods` (`empresa_id`,`area`,`period`);