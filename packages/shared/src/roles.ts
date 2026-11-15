// Roles map the legacy user levels (USUARIOS.usrlvl) onto Better Auth roles.
//   1 Supervisor · 2 Digitador y Consulta · 3 Digitador · 4 Consulta
// `owner` is the person who installed the system. `admin` and `member` are
// the names the first scaffold used; they stay valid as aliases.
//
// Permissions (docs/sistema/fase-0.md F1): fine permissions `module.resource.action`
// declared by each manifest, grouped into three packages that roles grant. A
// user can have per-permission overrides (grant/deny), global or per empresa.

export const ROLES = [
  'owner',
  'supervisor',
  'digitador_consulta',
  'digitador',
  'consulta',
  'admin',
  'member',
] as const
export type Role = (typeof ROLES)[number]

// capture   — view and capture operational data
// reports   — inquiries, reports and exports
// supervise — void, close/reopen, configuration, users
export const PERMISSION_PACKAGES = ['capture', 'reports', 'supervise'] as const
export type PermissionPackage = (typeof PERMISSION_PACKAGES)[number]
/** @deprecated use PermissionPackage */
export const PERMISSIONS = PERMISSION_PACKAGES
/** @deprecated use PermissionPackage */
export type Permission = PermissionPackage

// A fine permission, e.g. 'gl.entry.void'. `packages` empty = only the owner
// or an explicit grant has it (sensitive or installation-level permissions).
export type PermissionDef = {
  id: string
  label: string
  // Screen or area it belongs to, for the permissions screen (Spanish).
  group: string
  packages: readonly PermissionPackage[]
}

export type PermissionOverride = {
  permission: string
  effect: 'grant' | 'deny'
  // null = every empresa (as legacy PERFIL, which is global).
  empresaId: string | null
}

const ALL: readonly PermissionPackage[] = PERMISSION_PACKAGES

const ROLE_PACKAGES: Record<Role, readonly PermissionPackage[]> = {
  owner: ALL,
  supervisor: ALL,
  admin: ALL,
  digitador_consulta: ['capture', 'reports'],
  digitador: ['capture'],
  consulta: ['reports'],
  member: ['reports'],
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propietario',
  supervisor: 'Supervisor',
  admin: 'Supervisor',
  digitador_consulta: 'Digitador y Consulta',
  digitador: 'Digitador',
  consulta: 'Consulta',
  member: 'Consulta',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function isPermissionPackage(value: unknown): value is PermissionPackage {
  return typeof value === 'string' && (PERMISSION_PACKAGES as readonly string[]).includes(value)
}

export function rolePackages(role: unknown): readonly PermissionPackage[] {
  return isRole(role) ? ROLE_PACKAGES[role] : []
}

// ── Catalog ─────────────────────────────────────────────────────────────
// Filled at startup from CORE_PERMISSIONS and every loaded manifest.
const catalog = new Map<string, PermissionDef>()

export function registerPermissions(defs: readonly PermissionDef[]): void {
  for (const d of defs) catalog.set(d.id, d)
}

export function permissionDef(id: string): PermissionDef | undefined {
  return catalog.get(id)
}

export function listPermissions(): PermissionDef[] {
  return [...catalog.values()]
}

export type PermissionCheck = {
  overrides?: readonly PermissionOverride[]
  empresaId?: string | null
}

function overrideFor(
  overrides: readonly PermissionOverride[],
  permission: string,
  empresaId: string | null,
): 'grant' | 'deny' | null {
  const pick = (scope: string | null) => {
    const rows = overrides.filter((o) => o.permission === permission && o.empresaId === scope)
    if (rows.some((o) => o.effect === 'deny')) return 'deny'
    if (rows.some((o) => o.effect === 'grant')) return 'grant'
    return null
  }
  return (empresaId ? pick(empresaId) : null) ?? pick(null)
}

// `permission` is a package ('supervise') or a fine permission ('gl.entry.void').
// Order: owner always · empresa override · global override · role packages.
export function can(role: unknown, permission: string, check: PermissionCheck = {}): boolean {
  if (!isRole(role)) return false
  if (role === 'owner') return true
  const packages = ROLE_PACKAGES[role]
  if (isPermissionPackage(permission)) return packages.includes(permission)
  const ov = overrideFor(check.overrides ?? [], permission, check.empresaId ?? null)
  if (ov) return ov === 'grant'
  const def = catalog.get(permission)
  return !!def && def.packages.some((p) => packages.includes(p))
}

// Every permission in the catalog the user has, for the web to filter menus.
export function effectivePermissions(role: unknown, check: PermissionCheck = {}): string[] {
  return listPermissions().filter((d) => can(role, d.id, check)).map((d) => d.id)
}

// The owner can work in every empresa without an explicit grant.
export function seesAllEmpresas(role: unknown): boolean {
  return role === 'owner'
}

// Platform permissions (not owned by any module).
export const CORE_PERMISSIONS: readonly PermissionDef[] = [
  { id: 'core.users.manage', label: 'Usuarios, roles y permisos', group: 'Administración', packages: ['supervise'] },
  { id: 'core.empresas.manage', label: 'Empresas y ficha fiscal', group: 'Administración', packages: ['supervise'] },
  { id: 'core.modules.manage', label: 'Activar módulos por empresa', group: 'Administración', packages: [] },
  { id: 'core.settings.manage', label: 'Configuración de la empresa', group: 'Administración', packages: ['supervise'] },
  { id: 'core.audit.view', label: 'Bitácora', group: 'Administración', packages: ['supervise'] },
  { id: 'core.costs.view', label: 'Ver costos', group: 'Datos sensibles', packages: [] },
  { id: 'core.salaries.view', label: 'Ver sueldos', group: 'Datos sensibles', packages: [] },
]
registerPermissions(CORE_PERMISSIONS)
