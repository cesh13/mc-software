import type { PermissionDef } from './roles.js'
import type { SettingDef } from './settings.js'
// Type-only: erased at runtime, so the browser bundle never loads server code.
import type { ServiceFactory } from './server/services.js'

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
  // Contracts this module offers to others, by service name (contratos.md §0.1).
  provides?: Record<string, () => Promise<ServiceFactory>>
  // Services it calls. A missing required one blocks activating the module
  // for an empresa; a missing optional one resolves to null.
  consumes?: { required?: string[]; optional?: string[] }
  // Per-empresa settings this module reads through the `settings` contract.
  settings?: SettingDef[]
  schema: () => Promise<Record<string, unknown>>
  router: () => Promise<unknown>
  pages: () => Promise<Record<string, unknown>>
}
