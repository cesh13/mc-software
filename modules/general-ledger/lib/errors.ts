import type { Context } from 'hono'
import { RuleError } from '@accounting/shared/server'

type Status = 400 | 403 | 404 | 409

// RuleError that carries extra fields for the UI (e.g. the difference of an
// unbalanced entry). The platform error handler only sends { error, code },
// so routes that may throw it answer through `respond`.
export class DetailedRuleError extends RuleError {
  constructor(
    message: string,
    status: Status,
    code: string,
    public details: Record<string, unknown>,
  ) {
    super(message, status, code)
  }
}

export function respond<T>(c: Context, fn: () => T, status: 200 | 201 = 200) {
  try {
    return c.json(fn() as object, status)
  } catch (err) {
    if (err instanceof DetailedRuleError) {
      return c.json({ error: err.message, code: err.code, ...err.details }, err.status)
    }
    throw err
  }
}

export function notFound(message: string, code: string): never {
  throw new RuleError(message, 404, code)
}
