<#
.SYNOPSIS
    Builds a MC Software version (server bundle + web + Electron installer) and
    publishes it to the update feed on the VPS with scp.

.EXAMPLE
    # Build only (installer ends up in apps\tray\release):
    .\scripts\publish-update.ps1 -Version 0.1.1 -SkipUpload

    # Build and upload (ssh alias from ~/.ssh/config + folder served by nginx):
    .\scripts\publish-update.ps1 -Version 0.1.1 -Remote "mi-vps:/var/www/updates/mcsoftware"

.NOTES
    The feed URL (http://host/path/) is baked into the app at build time. Set it with
    the MC_UPDATE_URL environment variable, the -FeedUrl parameter, or apps\tray\update.config.json
    (copy update.config.example.json). Without it the app builds with updates disabled.
    VPS setup (once): docs/prueba-interna.md, section "Servidor de actualizaciones".
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    # <ssh-alias>:<absolute path> served by the nginx container. Required unless -SkipUpload.
    [string]$Remote,

    # Stop after building; nothing is uploaded.
    [switch]$SkipUpload,

    # Overrides MC_UPDATE_URL / update.config.json for this build.
    [string]$FeedUrl,

    # Output folder for the installer (default apps\tray\release).
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$trayDir  = Join-Path $repoRoot 'apps\tray'
if (-not $OutDir) { $OutDir = Join-Path $trayDir 'release' }

if (-not $SkipUpload -and -not $Remote) {
    throw "Indique -Remote '<alias-ssh>:<ruta>' o use -SkipUpload para solo compilar."
}
if ($FeedUrl) { $env:MC_UPDATE_URL = $FeedUrl }
$hasFeed = $env:MC_UPDATE_URL -or (Test-Path (Join-Path $trayDir 'update.config.json'))
if (-not $hasFeed -and -not $SkipUpload) {
    throw "No hay URL de actualizaciones: defina MC_UPDATE_URL, -FeedUrl o apps\tray\update.config.json. Sin ella el instalador no genera latest.yml."
}

function Invoke-Step($label, [scriptblock]$cmd) {
    Write-Host "== $label ==" -ForegroundColor Cyan
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "$label fallo (codigo $LASTEXITCODE)" }
}

Remove-Item (Join-Path $OutDir "latest.yml") -ErrorAction SilentlyContinue  # never publish a stale manifest
Push-Location $repoRoot
try {
    Invoke-Step 'Servidor (esbuild)' { pnpm build:api:server }
    Invoke-Step 'Interfaz web (Next.js export)' { pnpm --filter '@accounting/web' build }
    Invoke-Step 'App de escritorio (tsc + icono)' { pnpm --filter '@accounting/tray' build }
    Push-Location $trayDir
    try {
        Invoke-Step "Instalador v$Version (electron-builder)" {
            pnpm exec electron-builder --win --publish never --config electron-builder.config.cjs `
                "-c.extraMetadata.version=$Version" "-c.directories.output=$OutDir"
        }
    } finally { Pop-Location }
} finally { Pop-Location }

$installer = Join-Path $OutDir "MC-Software-Setup-$Version.exe"
$files = @($installer, "$installer.blockmap", (Join-Path $OutDir 'latest.yml'))
if ($hasFeed) {
    foreach ($f in $files) { if (-not (Test-Path $f)) { throw "Falta el archivo esperado: $f" } }
}
$size = [math]::Round((Get-Item $installer).Length / 1MB)
Write-Host "Instalador listo: $installer ($size MB)" -ForegroundColor Green

if ($SkipUpload) {
    Write-Host 'Subida omitida (-SkipUpload).' -ForegroundColor Yellow
    return
}

Write-Host "== Subiendo a $Remote ==" -ForegroundColor Cyan
# Installer and blockmap first, latest.yml LAST: clients never see a manifest
# that points to a file that is not there yet. Old installers stay on the VPS.
scp $installer "$installer.blockmap" "$Remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp (instalador) fallo' }
scp (Join-Path $OutDir 'latest.yml') "$Remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp (latest.yml) fallo' }
Write-Host "Publicado v$Version. Los equipos lo detectan en su proximo chequeo (maximo 4 h)." -ForegroundColor Green
