// Roles map the legacy user levels (USUARIOS.usrlvl) onto Better Auth roles.
//   1 Supervisor · 2 Digitador y Consulta · 3 Digitador · 4 Consulta
// `owner` is the person who installed the system. `admin` and `member` are
// the names the first scaffold used; they stay valid as aliases.

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

// capture   — create and modify entries and catalogs
// reports   — inquiries and reports
// supervise — close/open months, annual close, configuration, users
export const PERMISSIONS = ['capture', 'reports', 'supervise'] as const
export type Permission = (typeof PERMISSIONS)[number]

const ALL: readonly Permission[] = PERMISSIONS

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
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

export function can(role: unknown, permission: Permission): boolean {
  return isRole(role) && ROLE_PERMISSIONS[role].includes(permission)
}

// The owner can work in every empresa without an explicit grant.
export function seesAllEmpresas(role: unknown): boolean {
  return role === 'owner'
}
