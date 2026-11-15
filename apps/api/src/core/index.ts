import { z } from 'zod'
import { registerSettings, type SettingDef } from '@accounting/shared'
import type { ServiceFactory } from '@accounting/shared/server'
import { CORE_PROVIDER, type ServiceDirectory } from '../lib/services.js'
import { periodsService } from './periods.js'
import { sequencesService } from './sequences.js'
import { settingsService } from './settings.js'

// Settings owned by the platform itself.
export const CORE_SETTINGS: SettingDef[] = [
  {
    namespace: 'core', key: 'periodCloseMode',
    label: 'Al cerrar Contabilidad con áreas abiertas',
    schema: z.enum(['advertir', 'exigir']), default: 'advertir',
  },
]

// Contracts the platform itself provides to every module.
export function registerCoreServices(directory: ServiceDirectory): void {
  registerSettings(CORE_SETTINGS)
  directory.register('periods', CORE_PROVIDER, periodsService as ServiceFactory)
  directory.register('settings', CORE_PROVIDER, settingsService as ServiceFactory)
  directory.register('sequences', CORE_PROVIDER, sequencesService as ServiceFactory)
}
