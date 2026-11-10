CREATE TABLE `core_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text,
	`user_id` text NOT NULL,
	`at` text NOT NULL,
	`module` text NOT NULL,
	`action` text NOT NULL,
	`entity` text,
	`entity_id` text,
	`detail` text,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `core_audit_log_empresa_at_idx` ON `core_audit_log` (`empresa_id`,`at`);--> statement-breakpoint
CREATE INDEX `core_audit_log_entity_idx` ON `core_audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `core_empresas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`siglas` text NOT NULL,
	`moneda` text DEFAULT 'USD' NOT NULL,
	`gran_contribuyente` integer DEFAULT false NOT NULL,
	`consolida_en_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`consolida_en_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_empresas_siglas_unique` ON `core_empresas` (`siglas`);--> statement-breakpoint
CREATE TABLE `core_user_empresas` (
	`user_id` text NOT NULL,
	`empresa_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `empresa_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
