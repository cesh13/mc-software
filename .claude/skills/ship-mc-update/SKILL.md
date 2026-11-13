---
name: ship-mc-update
description: "Ship a new MC Software version to the installed machines: validate, bump version, update changelog, commit, push, and publish to the VPS update feed. Use when the user asks to release, publish, deploy, or ship changes of the accounting platform. Triggers on: subir al VPS, publicar una versión, hacer release, actualizar las máquinas, subir cambios, deploy."
user-invocable: true
---

# Release MC Software

Standard flow for shipping an update of the desktop app (Electron server/client) to the
installed machines through the auto-update feed on the VPS. Follow the steps in order and
do not skip the confirmation gate. Background: `docs/prueba-interna.md`.

Run everything from the repo root. Use **PowerShell** for the publish step: the Git Bash
ssh client cannot read the VPS key, the Windows one can.

## 1. Confirm the working tree is release-ready

- `git status` — no unexpected untracked files, nothing you don't recognize. `git branch`
  must be `master`.
- Run the checks; do not proceed on red:
  ```
  pnpm --filter @accounting/api test
  pnpm --filter @accounting/api type-check
  pnpm --filter @accounting/api type-check:tests
  pnpm --filter @accounting/web type-check
  pnpm --filter @accounting/shared type-check
  pnpm --filter @accounting/module-chart-of-accounts type-check
  pnpm --filter @accounting/module-general-ledger type-check
  pnpm --filter @accounting/tray exec tsc --noEmit
  ```
  If the API tests fail with a native-module / `NODE_MODULE_VERSION` error, a previous
  packaging left the SQLite binary on Electron's ABI: run
  `pnpm rebuild better-sqlite3-multiple-ciphers` and re-run the tests.
- **Migrations check.** List the migrations added since the last release
  (`git diff --stat <last-bump-commit>..HEAD -- "**/migrations/*.sql"`). Installed servers
  apply them automatically on the first start after updating, and they cannot be undone:
  - never ship an edited or deleted migration that was already released — only new files;
  - if this release adds migrations, say so in the report and in the changelog, and remind
    the user to copy the data folder (`%APPDATA%\MC Software\data`) on the server first.
- If there are uncommitted code changes for the feature/fix being shipped, commit them
  **first, separately** from the version bump, with a real message describing the change.

## 2. Decide the version number — propose, then confirm

Current version: `"version"` in `apps/tray/package.json`. Look at
`git log --oneline <last-bump-commit>..HEAD` to classify what changed:

- **Patch** (`0.1.1` → `0.1.2`): only fixes, no new user-facing capability.
- **Minor** (`0.1.2` → `0.2.0`): at least one new screen, report, module or visible
  behaviour change.
- **Major**: reserved for changes that require manual steps on installed machines (data
  moved, re-import needed, incompatible client shell) — ask explicitly before using one.

State the proposed version and a one-line reason, then proceed — a proposal to state, not a
question that blocks, unless the classification is genuinely ambiguous.

## 3. Write the changelog entry

Edit `CHANGELOG.md` at the repo root, inserting a new section **above** the previous top
entry (newest first):

```
## <version> - <YYYY-MM-DD>
- <user-facing change, past tense, Spanish, one line each>
```

Describe what changed for the user ("Se agregó…", "Se corrigió…"), not implementation
details. Use today's date. If the release adds database migrations, add the line
"Actualiza la base de datos al iniciar (respaldar la carpeta de datos antes)."

## 4. Bump the version and commit

Set `"version"` in `apps/tray/package.json` to the new version (nothing else in that file).

```
git add CHANGELOG.md apps/tray/package.json
git commit -m "Bump version to <version> and update changelog"
```

## 5. Push to origin

```
git push origin master
```

## 6. Confirm before touching the installed machines — then publish

**Stop here and ask the user for an explicit go before running the publish script**, even
if they asked for "commit, push and deploy" in one message: this step is what reaches the
installed machines. State the version and ask for a clear yes immediately before it. (Skip
the pause only if the user's message already contains an unambiguous, freshly given
go-ahead for *this specific* publish — e.g. they just answered "sí, publica".)

The feed address must be configured in `apps/tray/update.config.json` (untracked; copy
`update.config.example.json`). Without it the build has updates disabled and the script
refuses to upload.

```powershell
.\scripts\publish-update.ps1 -Version <version> -Remote "hetzner-root:/var/www/updates/mcsoftware"
```

It builds the server bundle, the web export and the Electron app, creates the NSIS
installer, and uploads the installer, its `.blockmap` and — last — `latest.yml`. About
85 MB, a couple of minutes. Nothing needs restarting on the VPS.

## 7. Verify the feed

```
curl -s http://mcsoftware-updates.5-78-178-54.traefik.me/latest.yml
```

- `version:` must be the one just published.
- The `size:` must equal the local installer's size
  (`apps/tray/release/MC-Software-Setup-<version>.exe`).
- Re-run `pnpm --filter @accounting/api test` once: packaging must not have left the
  development copy of the SQLite binary on Electron's ABI.

## 8. Report back

Summarize: commits made (short hashes), version shipped, whether it carries migrations,
and the feed verification. Installed machines pick it up on their next check (app start,
every 4 hours, or "Buscar actualizaciones" in the tray menu) and install it on restart.

## Notes / gotchas

- Never bump the version without a changelog entry — they ship together.
- Clients are thin: the screens come from the server PC. Update the **server** machine of
  an office first; a client shell older than its server only gets a warning.
- The data lives in `%APPDATA%\MC Software\data`, outside the install folder; updating or
  uninstalling does not touch it. The database key is tied to the Windows user.
- VPS disk is small (check `df -h /var/www` when in doubt). Old installers can be deleted
  from `/var/www/updates/mcsoftware`, never `latest.yml` nor the installer it names.
- The feed hostname embeds the VPS public IP (`*.traefik.me`). If the IP changes, recreate
  the `mcsoftware-updates` container, update `apps/tray/update.config.json`, and publish a
  new version from a machine that can still reach the old installs (they will keep asking
  the old address).
- The installer is not code-signed and the feed is plain HTTP: acceptable for the internal
  trial, not for clients. Do not publish to client machines until that is solved.
- This is accounting software: a broken release can corrupt books. When in doubt about
  whether something is release-ready, ask rather than assume.
