export type NavItem = {
  label: string
  path: string
  icon: string
}

export type ModulePermissions = {
  owner: string[]
  admin: string[]
  member: string[]
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
  permissions: ModulePermissions
  schema: () => Promise<Record<string, unknown>>
  router: () => Promise<unknown>
  pages: () => Promise<Record<string, unknown>>
}
