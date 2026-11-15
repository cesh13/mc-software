-- GL month state moves to the platform's core_periods (area 'gl'); docs/sistema/fase-0.md F5.
INSERT OR IGNORE INTO `core_periods` (`id`, `empresa_id`, `area`, `period`, `status`, `closed_by`, `closed_at`, `updated_at`)
SELECT `id`, `empresa_id`, 'gl', `period`, `status`, `closed_by`, `closed_at`, `updated_at` FROM `gl_periods`;
