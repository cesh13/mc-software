// electron-builder afterPack hook: puts the Electron-ABI build of
// better-sqlite3-multiple-ciphers into the PACKAGED copy only.
//
// Why not electron-builder's own rebuild (npmRebuild)? In a pnpm workspace it
// rebuilds the shared store copy in place, which breaks the Node-ABI binary the
// API tests and `pnpm dev:api` use. Here the store is never touched.
// keytar is N-API (ABI-stable), so its Node prebuild works under Electron as is.
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

exports.default = async function afterPack(context) {
  const pkgDir = path.join(context.appOutDir, 'resources', 'app', 'node_modules', 'better-sqlite3-multiple-ciphers')
  const binding = path.join(pkgDir, 'build', 'Release', 'better_sqlite3.node')
  const prebuildBin = path.join(context.appOutDir, 'resources', 'app', 'node_modules', 'prebuild-install', 'bin.js')
  const electronVersion = require('electron/package.json').version

  // Remove first: the copied file may be a hard link to the pnpm store.
  fs.rmSync(binding, { force: true })
  execFileSync(
    process.execPath,
    [prebuildBin, '--runtime', 'electron', '--target', electronVersion, '--arch', 'x64', '--platform', 'win32'],
    { cwd: pkgDir, stdio: 'inherit' },
  )
  if (!fs.existsSync(binding)) throw new Error('Electron prebuild of better-sqlite3-multiple-ciphers was not installed')
  console.log(`  - native module placed for Electron ${electronVersion}: ${binding}`)
}
