CREATE TABLE `core_empresa_profile` (
	`empresa_id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`trade_name` text DEFAULT '' NOT NULL,
	`nit` text DEFAULT '' NOT NULL,
	`nrc` text DEFAULT '' NOT NULL,
	`giro` text DEFAULT '' NOT NULL,
	`economic_activity_code` text DEFAULT '' NOT NULL,
	`department_code` text DEFAULT '' NOT NULL,
	`municipality_code` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`logo_ref` text,
	`amounts_legend` text DEFAULT '' NOT NULL,
	`updated_by` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
