import { and, desc, eq, lte } from 'drizzle-orm'
import { UNDATED, isIsoDate, settingDef, type SettingDef, type SettingValue } from '@accounting/shared'
import { RuleError, newId, nowIso, type ServiceContext, type SettingsService } from '@accounting/shared/server'
import { coreEmpresaSettings as s } from '../db/schema.js'

const today = () => nowIso().slice(0, 10)

function defOf(namespace: string, key: string): SettingDef {
  const def = settingDef(namespace, key)
  if (!def) throw new RuleError(`Configuración desconocida: ${namespace}.${key}.`, 400, 'setting_unknown')
  return def
}

// Implementation of the `settings` contract over core_empresa_settings.
export function settingsService(ctx: ServiceContext): SettingsService {
  const rows = (namespace: string, key: string) =>
    and(eq(s.empresaId, ctx.empresaId), eq(s.namespace, namespace), eq(s.key, key))

  return {
    get<T>(namespace: string, key: string, at?: string): T {
      const def = defOf(namespace, key)
      const row = ctx.db.select({ value: s.value }).from(s)
        .where(and(rows(namespace, key), lte(s.validFrom, def.dated ? (at ?? today()) : UNDATED)))
        .orderBy(desc(s.validFrom)).limit(1).get()
      return (row ? JSON.parse(row.value) : def.default) as T
    },

    set(namespace, key, value, validFrom) {
      const def = defOf(namespace, key)
      if (def.dated && (!validFrom || !isIsoDate(validFrom))) {
        throw new RuleError('Indique desde qué fecha rige el valor (AAAA-MM-DD).', 400, 'setting_valid_from_required')
      }
      const from = def.dated ? validFrom! : UNDATED
      const parsed = def.schema.safeParse(value)
      if (!parsed.success) {
        const why = parsed.error.issues[0]?.message ?? ''
        throw new RuleError(`Valor inválido para ${def.label}. ${why}`.trim(), 400, 'setting_invalid')
      }
      const json = JSON.stringify(parsed.data)
      const now = nowIso()
      const existing = ctx.db.select({ id: s.id, value: s.value }).from(s)
        .where(and(rows(namespace, key), eq(s.validFrom, from))).get()
      if (existing) {
        ctx.db.update(s).set({ value: json, updatedBy: ctx.userId, updatedAt: now }).where(eq(s.id, existing.id)).run()
      } else {
        ctx.db.insert(s).values({
          id: newId(), empresaId: ctx.empresaId, namespace, key, value: json, validFrom: from,
          updatedBy: ctx.userId, updatedAt: now,
        }).run()
      }
      ctx.audit({
        module: 'core', action: 'configurar', entity: 'setting', entityId: `${namespace}.${key}`,
        detail: { validFrom: def.dated ? from : null, before: existing ? JSON.parse(existing.value) : null, after: parsed.data },
      }, ctx.db)
      return { namespace, key, value: parsed.data, validFrom: def.dated ? from : null, isDefault: false }
    },

    history(namespace, key) {
      const def = defOf(namespace, key)
      return ctx.db.select().from(s).where(rows(namespace, key)).orderBy(desc(s.validFrom)).all()
        .map((r): SettingValue => ({
          namespace, key, value: JSON.parse(r.value), validFrom: def.dated ? r.validFrom : null, isDefault: false,
        }))
    },
  }
}
