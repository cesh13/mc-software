ALTER TABLE `gl_journal_entries` ADD `reverses_entry_id` text REFERENCES gl_journal_entries(id);--> statement-breakpoint
ALTER TABLE `gl_journal_entries` ADD `legacy_ref` text;--> statement-breakpoint
ALTER TABLE `gl_journal_entries` ADD `origin_confidence` text;--> statement-breakpoint
CREATE UNIQUE INDEX `gl_journal_entries_generated_uq` ON `gl_journal_entries` (`empresa_id`,`source`,`source_ref`) WHERE is_active = 1 AND source_ref IS NOT NULL AND source NOT IN ('manual', 'cierre', 'importado');--> statement-breakpoint
CREATE INDEX `gl_journal_entries_legacy_idx` ON `gl_journal_entries` (`empresa_id`,`legacy_ref`);