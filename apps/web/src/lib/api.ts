import { getApiBase } from './api-base'
import { getStored } from './local-store'

export const EMPRESA_KEY = 'empresaId'

export type ApiIssue = { path: string; message: string }

// Error returned by the API: `message` is already in Spanish and safe to show.
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public issues?: ApiIssue[],
    public body?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.issues?.length) return `${err.message} ${err.issues.map((i) => i.message).join(' ')}`
    return err.message
  }
  if (err instanceof TypeError) return 'No se puede conectar con el servidor.'
  return err instanceof Error ? err.message : 'Ocurrió un error.'
}

export async function apiFetch<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const empresaId = getStored(EMPRESA_KEY)
  const { json, ...rest } = init ?? {}
  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    method: rest.method ?? (json === undefined ? 'GET' : 'POST'),
    body: json === undefined ? rest.body : JSON.stringify(json),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(empresaId ? { 'X-Empresa-Id': empresaId } : {}),
      ...rest.headers,
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    throw new ApiError(
      (body.error as string) ?? `Error ${res.status}`,
      res.status,
      body.code as string | undefined,
      body.issues as ApiIssue[] | undefined,
      body,
    )
  }
  return res.json() as Promise<T>
}

// Builds '?a=1&b=2', skipping empty values.
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '' || v === false) continue
    sp.set(k, v === true ? '1' : String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
