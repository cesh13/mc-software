# Guía para construir un módulo

Reglas que aplican a todo el código de `modules/*`, `apps/api` y `tools/legacy-import`.

## Reglas fijas

- **Stack:** SQLite (better-sqlite3 + SQLCipher), Drizzle ORM, Hono, Zod, decimal.js. No agregar
  dependencias sin necesidad; no proponer Postgres, Docker ni SSR.
- **Dinero:** nunca `number`. Se guarda como TEXT con dos decimales (`'1234.50'`) y se opera con
  los helpers de `@accounting/shared` (`toMoney`, `addMoney`, `subMoney`, `moneyEquals`,
  `isZeroMoney`, `compareMoney`) o con `decimal.js`.
- **Sin DELETE en registros de negocio:** se anula con `is_active = 0`.
- **Fechas:** `AAAA-MM-DD`; períodos `AAAA-MM`; marcas de tiempo ISO 8601 (`nowIso()`).
- **`empresa_id` en toda tabla de negocio** y en toda consulta. Nunca devolver datos de otra empresa.
- **Tablas con prefijo** del módulo (`coa_`, `gl_`, …). **Ningún archivo de más de 200 líneas.**
- **Mensajes al usuario en español.** Código, nombres y comentarios en inglés.
- **Los módulos no se importan entre sí ni importan de `apps/api`.** Solo de `@accounting/shared`
  (tipos, contratos, helpers) y `@accounting/shared/server` (solo servidor).

## Contexto que recibe una ruta

La plataforma autentica, resuelve la empresa activa (encabezado `X-Empresa-Id`) y verifica el
acceso antes de que corra la ruta. El router del módulo se monta en `/api/<id-del-módulo>`.

```ts
import { Hono } from 'hono'
import { requirePermission, RuleError, type ModuleEnv } from '@accounting/shared/server'

const router = new Hono<ModuleEnv>()

router.post('/things', requirePermission('capture'), async (c) => {
  const db = c.get('db')            // Drizzle (better-sqlite3)
  const empresaId = c.get('empresaId')
  const user = c.get('user')        // { id, name, email, role }
  const input = thingInput.parse(await c.req.json())   // ZodError → 400 automático
  if (somethingWrong) throw new RuleError('Mensaje para el usuario.', 409, 'codigo')
  db.transaction((tx) => {
    // ... cambios ...
    c.get('audit')({ module: 'mi-modulo', action: 'crear', entity: 'thing', entityId: id }, tx)
  })
  return c.json(result, 201)
})
```

- **Permisos** (`requirePermission`): `capture` (crear y modificar), `reports` (consultas y
  reportes), `supervise` (cierres, configuración). Las lecturas que una pantalla de captura
  necesita (listar cuentas, abrir una partida) no llevan permiso: basta estar autenticado.
- **Errores:** `RuleError(mensaje, status, code)` para reglas de negocio. No atrapar ZodError.
- **Bitácora:** todo alta, cambio, anulación, cierre o apertura llama a `audit`, dentro de la
  misma transacción.

## better-sqlite3 es síncrono

- Usar `.get()`, `.all()` y `.run()` en las consultas de Drizzle.
- **El callback de `db.transaction()` debe ser síncrono** (sin `async`/`await` adentro).
  Leer y validar todo lo necesario antes o dentro de la transacción de forma síncrona.

## Llaves foráneas hacia otras tablas

Cada módulo declara en `refs.ts` un stub de las tablas ajenas que referencia. El stub **no** se
exporta desde `schema.ts`. Para leer columnas de una tabla ajena se pueden agregar al stub las
columnas necesarias (solo lectura; nunca escribir en una tabla de otro módulo).

Cambios de schema: editar el schema y correr `pnpm db:generate` en la carpeta del módulo. Nunca
editar a mano una migración ya generada.

## Estructura sugerida

```
modules/<id>/
  manifest.ts  schema.ts  refs.ts  routes.ts      # routes.ts arma el router con sub-routers
  schema/      # tablas, si no caben en un archivo
  services/    # reglas de negocio: funciones (db, empresaId, input) → resultado
  routes/      # sub-routers de Hono, delgados: validan, llaman al servicio, responden
packages/shared/src/<módulo>.ts   # contratos Zod y tipos de entrada/salida (los usa la web)
```

## Pruebas

Las pruebas viven en `apps/api/tests/<módulo>/*.test.ts` y usan `node:test`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../../src/testing/test-app.js'

test('...', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const res = await t.request('/api/chart-of-accounts/accounts', { body: { ... } })  // POST si hay body
  assert.equal(res.status, 201)
  // t.request(url, { method, body, role, userId, empresaId }); role por defecto: 'owner'
  // t.sqlite.prepare(sql).run(...) para preparar datos o verificar directo en la BD
})
```

Comandos (desde `apps/api`):

- Un módulo: `pnpm exec tsx --test "tests/<módulo>/**/*.test.ts"`
- Todo: `pnpm test`
- Tipos: `pnpm type-check`, `pnpm type-check:tests`, y `pnpm type-check` en la carpeta del módulo.
