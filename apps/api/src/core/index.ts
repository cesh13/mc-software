import type { ServiceFactory } from '@accounting/shared/server'
import { CORE_PROVIDER, type ServiceDirectory } from '../lib/services.js'
import { periodsService } from './periods.js'

// Contracts the platform itself provides to every module.
export function registerCoreServices(directory: ServiceDirectory): void {
  directory.register('periods', CORE_PROVIDER, periodsService as ServiceFactory)
}
