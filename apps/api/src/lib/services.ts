import type { ModuleManifest } from '@accounting/shared'
import {
  serviceUnavailable, type ServiceContext, type ServiceFactory, type ServiceRegistry,
} from '@accounting/shared/server'

export const CORE_PROVIDER = 'core'

type Provider = { moduleId: string; factory: ServiceFactory }

// Every service offered by the loaded modules and by the core, by name.
export class ServiceDirectory {
  private providers = new Map<string, Provider>()

  register(name: string, moduleId: string, factory: ServiceFactory): void {
    const prev = this.providers.get(name)
    if (prev && prev.moduleId !== moduleId) {
      throw new Error(`Service "${name}" is provided by both ${prev.moduleId} and ${moduleId}.`)
    }
    this.providers.set(name, { moduleId, factory })
  }

  async registerManifest(m: ModuleManifest): Promise<void> {
    for (const [name, load] of Object.entries(m.provides ?? {})) this.register(name, m.id, await load())
  }

  providerOf(name: string): string | undefined {
    return this.providers.get(name)?.moduleId
  }

  // The view one request gets: only providers active for its empresa.
  forActive(activeModuleIds: ReadonlySet<string>): ServiceRegistry {
    const usable = (name: string) => {
      const p = this.providers.get(name)
      return p && (p.moduleId === CORE_PROVIDER || activeModuleIds.has(p.moduleId)) ? p : undefined
    }
    const registry: ServiceRegistry = {
      has: (name) => !!usable(name),
      get: <T>(name: string, ctx: ServiceContext) =>
        (usable(name)?.factory({ ...ctx, services: registry }) as T | undefined) ?? null,
      require: <T>(name: string, ctx: ServiceContext) => {
        const p = usable(name)
        if (!p) throw serviceUnavailable(name)
        return p.factory({ ...ctx, services: registry }) as T
      },
    }
    return registry
  }
}
