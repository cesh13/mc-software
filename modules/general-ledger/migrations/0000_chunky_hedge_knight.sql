CREATE TABLE `gl_cost_centers` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_cost_centers_empresa_code_uq` ON `gl_cost_centers` (`empresa_id`,`code`);--> statement-breakpoint
CREATE TABLE `gl_entry_types` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`is_bank` integer DEFAULT false NOT NULL,
	`number_width` integer DEFAULT 6 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_entry_types_empresa_code_uq` ON `gl_entry_types` (`empresa_id`,`code`);--> statement-breakpoint
CREATE TABLE `gl_fiscal_years` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`name` text NOT NULL,
	`start_period` text NOT NULL,
	`end_period` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_fiscal_years_empresa_start_uq` ON `gl_fiscal_years` (`empresa_id`,`start_period`);--> statement-breakpoint
CREATE TABLE `gl_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`period` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_by` text,
	`closed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_periods_empresa_period_uq` ON `gl_periods` (`empresa_id`,`period`);--> statement-breakpoint
CREATE TABLE `gl_journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`period` text NOT NULL,
	`entry_type_id` text NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`concept` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'borrador' NOT NULL,
	`imported_unbalanced` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_type_id`) REFERENCES `gl_entry_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_journal_entries_number_uq` ON `gl_journal_entries` (`empresa_id`,`period`,`entry_type_id`,`number`);--> statement-breakpoint
CREATE INDEX `gl_journal_entries_period_idx` ON `gl_journal_entries` (`empresa_id`,`period`,`status`);--> statement-breakpoint
CREATE INDEX `gl_journal_entries_source_idx` ON `gl_journal_entries` (`source`,`source_ref`);--> statement-breakpoint
CREATE TABLE `gl_journal_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`line_no` integer NOT NULL,
	`account_id` text NOT NULL,
	`cost_center_id` text,
	`detail` text DEFAULT '' NOT NULL,
	`debit` text DEFAULT '0.00' NOT NULL,
	`credit` text DEFAULT '0.00' NOT NULL,
	`collect_date` text,
	FOREIGN KEY (`entry_id`) REFERENCES `gl_journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `coa_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cost_center_id`) REFERENCES `gl_cost_centers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_journal_lines_entry_line_uq` ON `gl_journal_lines` (`entry_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `gl_journal_lines_account_idx` ON `gl_journal_lines` (`account_id`);--> statement-breakpoint
CREATE INDEX `gl_journal_lines_cost_center_idx` ON `gl_journal_lines` (`cost_center_id`);--> statement-breakpoint
CREATE TABLE `gl_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`fiscal_year_id` text NOT NULL,
	`account_id` text NOT NULL,
	`cost_center_id` text,
	`month` integer NOT NULL,
	`amount` text DEFAULT '0.00' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fiscal_year_id`) REFERENCES `gl_fiscal_years`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `coa_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cost_center_id`) REFERENCES `gl_cost_centers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_budgets_uq` ON `gl_budgets` (`fiscal_year_id`,`account_id`,`cost_center_id`,`month`);