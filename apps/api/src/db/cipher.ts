import keytar from 'keytar'
import { randomBytes } from 'crypto'

const SERVICE = 'accounting-platform'
const ACCOUNT = 'db-cipher-key'

export async function getCipherKey(): Promise<string> {
  const existing = await keytar.getPassword(SERVICE, ACCOUNT)
  if (existing) return existing

  const key = randomBytes(32).toString('hex')
  await keytar.setPassword(SERVICE, ACCOUNT, key)
  return key
}

export async function deleteCipherKey(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT)
}
