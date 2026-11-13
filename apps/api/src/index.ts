import { start } from './server.js'

// Dev entry (tsx watch src/index.ts). The production bundle uses build/entry.ts.
start().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
