CREATE TABLE `coa_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`parent_id` text,
	`level` integer NOT NULL,
	`is_detail` integer DEFAULT false NOT NULL,
	`requires_cost_center` integer DEFAULT false NOT NULL,
	`budget_group_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `coa_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`budget_group_id`) REFERENCES `coa_budget_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coa_accounts_empresa_code_uq` ON `coa_accounts` (`empresa_id`,`code`);--> statement-breakpoint
CREATE INDEX `coa_accounts_parent_idx` ON `coa_accounts` (`parent_id`);--> statement-breakpoint
CREATE TABLE `coa_budget_groups` (
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
CREATE UNIQUE INDEX `coa_budget_groups_empresa_code_uq` ON `coa_budget_groups` (`empresa_id`,`code`);