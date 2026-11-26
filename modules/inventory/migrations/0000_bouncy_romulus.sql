CREATE TABLE `inv_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`inventory_account_id` text,
	`cogs_account_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_account_id`) REFERENCES `coa_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cogs_account_id`) REFERENCES `coa_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inv_groups_empresa_code_uq` ON `inv_groups` (`empresa_id`,`code`);--> statement-breakpoint
CREATE TABLE `inv_items` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`group_id` text,
	`unit` text DEFAULT 'UNIDAD' NOT NULL,
	`barcode` text,
	`is_service` integer DEFAULT false NOT NULL,
	`tracks_lots` integer DEFAULT false NOT NULL,
	`min_qty` text,
	`max_qty` text,
	`inventory_account_id` text,
	`cogs_account_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`legacy_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `inv_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_account_id`) REFERENCES `coa_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cogs_account_id`) REFERENCES `coa_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inv_items_empresa_code_uq` ON `inv_items` (`empresa_id`,`code`);--> statement-breakpoint
CREATE INDEX `inv_items_empresa_group_idx` ON `inv_items` (`empresa_id`,`group_id`);--> statement-breakpoint
CREATE TABLE `inv_movement_types` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`direction` text NOT NULL,
	`kind` text NOT NULL,
	`counter_account_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`counter_account_id`) REFERENCES `coa_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inv_movement_types_empresa_code_uq` ON `inv_movement_types` (`empresa_id`,`code`);--> statement-breakpoint
CREATE TABLE `inv_warehouses` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inv_warehouses_empresa_code_uq` ON `inv_warehouses` (`empresa_id`,`code`);--> statement-breakpoint
CREATE TABLE `inv_cost_state` (
	`empresa_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` text NOT NULL,
	`value` text NOT NULL,
	`average_cost` text NOT NULL,
	`last_cost` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`empresa_id`, `item_id`),
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `inv_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inv_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`type_id` text NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`warehouse_id` text NOT NULL,
	`dest_warehouse_id` text,
	`party_id` text,
	`reference` text,
	`notes` text,
	`status` text NOT NULL,
	`total_cost` text NOT NULL,
	`void_reason` text,
	`voided_at` text,
	`voided_by` text,
	`legacy_key` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`type_id`) REFERENCES `inv_movement_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warehouse_id`) REFERENCES `inv_warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dest_warehouse_id`) REFERENCES `inv_warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `pty_parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inv_documents_empresa_type_number_uq` ON `inv_documents` (`empresa_id`,`type_id`,`number`);--> statement-breakpoint
CREATE INDEX `inv_documents_empresa_date_idx` ON `inv_documents` (`empresa_id`,`date`);--> statement-breakpoint
CREATE TABLE `inv_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`document_id` text NOT NULL,
	`line_no` integer NOT NULL,
	`item_id` text NOT NULL,
	`warehouse_id` text NOT NULL,
	`direction` text NOT NULL,
	`quantity` text NOT NULL,
	`unit_cost` text NOT NULL,
	`total_cost` text NOT NULL,
	`lot_no` text,
	`expires_on` text,
	`date` text NOT NULL,
	`reversal_of` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `core_empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `inv_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `inv_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warehouse_id`) REFERENCES `inv_warehouses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inv_movements_item_date_idx` ON `inv_movements` (`empresa_id`,`item_id`,`date`);--> statement-breakpoint
CREATE INDEX `inv_movements_document_idx` ON `inv_movements` (`document_id`);