// Builds the production server into apps/api/dist:
//   server.mjs                      single ESM bundle (API + modules + shared)
//   migrations/                     platform migrations
//   modules/<id>/migrations/        per-module migrations
// Native packages stay external (resolved from node_modules at runtime).
import { build } from 'esbuild'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modulesRoot = path.resolve(apiDir, '..', '..', 'modules')
const dist = path.join(apiDir, 'dist')

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// Module pages are .tsx screens that live in apps/web; the server never needs them.
const stubPages = {
  name: 'stub-module-pages',
  setup(b) {
    b.onResolve({ filter: /\/pages\/.*\.js$/ }, (a) => ({ path: a.path, namespace: 'stub-pages' }))
    b.onLoad({ filter: /.*/, namespace: 'stub-pages' }, () => ({ contents: 'export default {}', loader: 'js' }))
  },
}

await build({
  entryPoints: [path.join(apiDir, 'build', 'entry.ts')],
  outfile: path.join(dist, 'server.mjs'),
  bundle: true,
  platform: 'node',
  // Stub modules do not declare hono/drizzle themselves; fall back to the API's copies.
  nodePaths: [path.join(apiDir, 'node_modules')],
  format: 'esm',
  target: 'node20',
  external: ['better-sqlite3-multiple-ciphers', 'keytar'],
  // drizzle's sqlite driver imports 'better-sqlite3'; route it to the ciphers build.
  alias: { 'better-sqlite3': 'better-sqlite3-multiple-ciphers' },
  // Bundled CommonJS deps need require/__dirname inside an ESM file.
  banner: {
    js: "import { createRequire as __cr } from 'node:module';const require = __cr(import.meta.url);",
  },
  plugins: [stubPages],
  logLevel: 'info',
})

cpSync(path.join(apiDir, 'src', 'db', 'migrations'), path.join(dist, 'migrations'), { recursive: true })

const ids = readdirSync(modulesRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(path.join(modulesRoot, d.name, 'manifest.ts')))
  .map((d) => d.name)
const entrySrc = readFileSync(path.join(apiDir, 'build', 'entry.ts'), 'utf8')
for (const id of ids) {
  if (!entrySrc.includes(`modules/${id}/manifest.js`)) throw new Error(`build/entry.ts is missing module ${id}`)
  const mig = path.join(modulesRoot, id, 'migrations')
  if (existsSync(mig)) cpSync(mig, path.join(dist, 'modules', id, 'migrations'), { recursive: true })
}
console.log(`Server built: ${dist} (modules: ${ids.join(', ')})`)
