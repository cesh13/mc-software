CREATE TABLE `pty_parties` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`trade_name` text,
	`kind` text NOT NULL,
	`is_customer` integer DEFAULT false NOT NULL,
	`is_supplier` integer DEFAULT false NOT NULL,
	`nit` text,
	`nrc` text,
	`dui` text,
	`passport` text,
	`foreign_id` text,
	`is_foreign` integer DEFAULT false NOT NULL,
	`economic_activity_code` text,
	`email` text,
	`phone` text,
	`address` text,
	`department_code` text,
	`municipality_code` text,
	`is_active` integer DEFAULT true NOT NULL,
	`legacy_refs` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pty_parties_empresa_code_uq` ON `pty_parties` (`empresa_id`,`code`);--> statement-breakpoint
CREATE INDEX `pty_parties_empresa_nrc_idx` ON `pty_parties` (`empresa_id`,`nrc`);--> statement-breakpoint
CREATE INDEX `pty_parties_empresa_nit_idx` ON `pty_parties` (`empresa_id`,`nit`);