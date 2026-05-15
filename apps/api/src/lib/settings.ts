import { eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { settings } from '../db/schema.js'

export async function getSettings(key: string): Promise<string | null> {
  const db = getDb()
  const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
  return row[0]?.value ?? null
}
