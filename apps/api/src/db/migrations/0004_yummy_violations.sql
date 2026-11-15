CREATE TABLE `core_empresa_modules` (
	`empresa_id` text NOT NULL,
	`module_id` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`empresa_id`, `module_id`),
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
