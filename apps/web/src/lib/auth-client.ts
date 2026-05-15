import { createAuthClient } from 'better-auth/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
}) as any // better-auth infers OAuth2 internals that aren't portable; we cast here

export type Session = Awaited<ReturnType<typeof authClient.getSession>>['data']
