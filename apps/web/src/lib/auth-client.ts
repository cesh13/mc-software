import { createAuthClient } from 'better-auth/client'
import { getApiBase } from './api-base'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authClient = createAuthClient({
  baseURL: getApiBase(),
}) as any // better-auth infers OAuth2 internals that aren't portable; we cast here

export type Session = Awaited<ReturnType<typeof authClient.getSession>>['data']
