// electron-builder configuration. The update feed URL is NOT in source: it comes
// from MC_UPDATE_URL or from the untracked update.config.json (see the .example).
const fs = require('fs')
const path = require('path')

function feedUrl() {
  let url = process.env.MC_UPDATE_URL
  if (!url) {
    try {
      url = JSON.parse(fs.readFileSync(path.join(__dirname, 'update.config.json'), 'utf8')).url
    } catch {
      // no config file: build without updates
    }
  }
  return url ? url.replace(/\/?$/, '/') : null
}

const url = feedUrl()
console.log(url ? `Update feed: ${url}` : 'No update feed configured: updates will be disabled in this build.')

module.exports = {
  appId: 'com.mcsoftware.app',
  productName: 'MC Software',
  artifactName: 'MC-Software-Setup-${version}.${ext}',
  directories: { output: 'release' },
  // Unpacked: the API child process loads native modules (.node) from node_modules
  // next to ./server, which does not work from inside an asar archive.
  asar: false,
  files: [
    'dist/**/*',
    'assets/**/*',
    { from: '../api/dist', to: 'server' },
    { from: '../web/out', to: 'ui' },
  ],
  // Native modules are handled in scripts/after-pack.cjs (keeps the pnpm store untouched).
  npmRebuild: false,
  afterPack: path.join(__dirname, 'scripts', 'after-pack.cjs'),
  publish: url ? { provider: 'generic', url, channel: 'latest', updaterCacheDirName: 'mc-software-updater' } : null,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',
    requestedExecutionLevel: 'asInvoker', // per-user install, no administrator rights
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'MC Software',
    runAfterFinish: true,
    deleteAppDataOnUninstall: false, // never delete the database on uninstall
  },
}
