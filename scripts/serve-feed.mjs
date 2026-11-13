// Tiny static file server (no dependencies) to test the update feed locally.
// Usage: node scripts/serve-feed.mjs <folder> [port]   (supports Range requests)
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'

const root = path.resolve(process.argv[2] ?? '.')
const port = Number(process.argv[3] ?? 8099)

createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = path.join(root, path.normalize(name))
  let st
  try {
    if (!file.startsWith(root)) throw new Error('outside root')
    st = statSync(file)
    if (!st.isFile()) throw new Error('not a file')
  } catch {
    console.log(`404 ${req.method} ${name}`)
    res.writeHead(404).end('not found')
    return
  }
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
  const start = m && m[1] ? Number(m[1]) : 0
  const end = m && m[2] ? Number(m[2]) : st.size - 1
  console.log(`${m ? 206 : 200} ${req.method} ${name}${m ? ` bytes ${start}-${end}` : ''}`)
  res.writeHead(m ? 206 : 200, {
    'Content-Length': end - start + 1,
    'Content-Type': 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    ...(m ? { 'Content-Range': `bytes ${start}-${end}/${st.size}` } : {}),
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file, { start, end }).pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://127.0.0.1:${port}/`))
