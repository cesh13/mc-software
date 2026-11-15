CREATE TABLE `core_empresa_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`namespace` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`valid_from` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_empresa_settings_uq` ON `core_empresa_settings` (`empresa_id`,`namespace`,`key`,`valid_from`);--> statement-breakpoint
CREATE TABLE `core_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`next_value` integer NOT NULL,
	`width` integer NOT NULL,
	`prefix` text DEFAULT '' NOT NULL,
	`range_from` integer,
	`range_to` integer,
	`valid_from` text,
	`valid_to` text,
	`authorization_ref` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `core_sequences_uq` ON `core_sequences` (`empresa_id`,`scope`,`key`);