// Dev utility: manually generate and store a cipher key in the OS keychain.
// In production, the tray app does this on first run automatically.
// Usage: tsx scripts/generate-key.ts
import { randomBytes } from 'crypto'

const key = randomBytes(32).toString('hex')
console.log('Generated key (store this in keychain):', key)
