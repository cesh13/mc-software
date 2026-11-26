import type { Context } from 'hono'
import { RuleError } from '@accounting/shared/server'

export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw new RuleError('El cuerpo de la solicitud no es JSON válido.', 400, 'invalid_json')
  }
}
