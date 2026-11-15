import type { AuditEntry, Db } from './index.js'
import { RuleError } from './index.js'

// What a provider receives: the consumer's context, already bound to its
// transaction when called inside one (docs/sistema/contratos.md §0.1–0.2).
export type ServiceContext = {
  db: Db
  empresaId: string
  userId: string
  role: string
  audit: (entry: AuditEntry, tx?: Db) => void
  // Set by the registry when it builds a provider, so providers can call other contracts.
  services?: ServiceRegistry
}

export type ServiceFactory<T = unknown> = (ctx: ServiceContext) => T

// Services offered to one request: only those whose provider is active for
// the request's empresa (or provided by the platform core).
export interface ServiceRegistry {
  has(name: string): boolean
  get<T>(name: string, ctx: ServiceContext): T | null
  require<T>(name: string, ctx: ServiceContext): T
}

export function serviceUnavailable(name: string): RuleError {
  return new RuleError(
    `El servicio "${name}" no está disponible: active el módulo que lo provee para esta empresa.`,
    409,
    'service_unavailable',
  )
}
