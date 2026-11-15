import type { PermissionDef } from './roles.js'

export type NavItem = {
  label: string
  path: string
  icon: string
}

export type ModuleManifest = {
  id: string
  name: string
  description: string
  version: string
  icon: string
  alwaysOn: boolean
  dependsOn: string[]
  navItems: NavItem[]
  // Fine permissions this module checks (`<prefix>.<resource>.<action>`).
  permissions: PermissionDef[]
  schema: () => Promise<Record<string, unknown>>
  router: () => Promise<unknown>
  pages: () => Promise<Record<string, unknown>>
}
