# Contratos entre módulos

Cómo se hablan los módulos de la plataforma nueva sin importarse entre sí. Complementa
[modulos-y-orden.md](modulos-y-orden.md) (qué módulos hay y quién posee qué). **PROPUESTA de diseño**, sin código:
las firmas TypeScript de este documento son documentación; los tipos reales irán a `@accounting/shared`.

---

## 0. Mecánica común a todos los contratos

### 0.1 Quién provee y cómo llega al consumidor

- Un contrato es una **interfaz en `@accounting/shared`** (tipos y esquemas Zod) más una **implementación** que vive en el
  módulo dueño (o en el núcleo) y que la plataforma pone en el contexto del módulo consumidor, igual que hoy pone `db`,
  `user`, `empresaId` y `audit`.
- El manifiesto (`packages/shared/src/manifest.ts`, hoy `id`, `dependsOn`, `router`, `schema`…) gana
  `provides: Record<string, () => Promise<ServiceFactory>>` y `consumes: { required: string[]; optional: string[] }`.
  `loadModules` (`apps/api/src/lib/module-loader.ts`) ya ordena por `dependsOn` (`topoSort`); además construirá un
  **registro de servicios** con las fábricas de los módulos habilitados. `moduleContext`
  (`apps/api/src/middleware/module-context.ts`), que hoy pone `db`, `user`, `empresaId` y `audit` en `ModuleEnv`
  (`packages/shared/src/server/index.ts`), pondrá también `services`, filtrado por los módulos **activos para la
  empresa** de la petición. Los contratos del núcleo (`periods`, `settings`, `sequences`) los registra `apps/api`.
- Una fábrica recibe `(ctx: { db, empresaId, userId, role, audit })` ya ligado al `tx` y devuelve el servicio; así el
  proveedor trabaja con el mismo `Ctx` que sus servicios actuales (`modules/general-ledger/lib/context.ts`).
- Si un contrato opcional no está disponible (módulo apagado para la empresa), `ctx.services.x` es `null` y el consumidor
  degrada (p. ej. `sales` sin `accounts-receivable` emite solo de contado). Un contrato requerido ausente impide activar
  el módulo consumidor.
- **Nadie lee ni escribe tablas de otro módulo** fuera de su proveedor. Las llaves foráneas entre módulos se declaran con
  los stubs de `refs.ts` (integridad), pero los datos se leen por el lookup (§7).

### 0.2 Transacción compartida

better-sqlite3 es síncrono y la API es el único escritor. Toda operación que cruza módulos ocurre en **una**
transacción abierta por la ruta del consumidor:

```ts
// En el servicio del consumidor (p. ej. banking): nada asíncrono dentro.
const doc = inTx(ctx, (tx) => {                      // mismo patrón que general-ledger/lib/context.ts
  const doc = insertBankDocument(tx, input);
  const entry = tx.services.ledger.post(tx, { source: 'bancos', sourceRef: doc.id, ... });
  setDocumentEntry(tx, doc.id, entry.entryId);
  auditIn(tx, 'crear', 'bnk_document', doc.id, { entryId: entry.entryId });
  return doc;
});
```

- Todos los métodos de contrato que escriben reciben `tx` como **primer parámetro**, son **síncronos** y no abren otra
  transacción (si se llaman fuera de una, el proveedor lanza `ContractError('SIN_TRANSACCION')`).
- Un error en cualquier punto lanza y revierte **todo**: documento, partida, movimiento de inventario y renglón de libro.
- Trabajo asíncrono (transmitir un DTE, enviar correo, generar PDF) nunca va dentro: se deja en una bandeja y lo procesa
  un trabajador fuera de la transacción.

### 0.3 Identidad e idempotencia

- Todo lo que un módulo crea en otro lleva **`source`** (origen, enumerado en `@accounting/shared`) y **`sourceRef`** (id
  de texto del documento dueño; o id del lote o corrida). La pareja `(empresa_id, source, source_ref)` es única entre los
  registros vivos del proveedor.
- Llamar dos veces `post` con la misma pareja **no duplica**: si existe una viva con el mismo contenido devuelve la misma;
  si el contenido difiere lanza `ContractError('YA_EXISTE')` (para cambiar se usa `replace`).

### 0.4 Errores, permisos y bitácora

- En las firmas, `Tx` es el `Ctx` del consumidor ligado a la transacción (`{ db: tx, empresaId, userId, role, audit,
  services }`) y `Db` un `Ctx` sin transacción, para lecturas.
- Errores de negocio: `RuleError` de `@accounting/shared/server` (ya existente: mensaje en español, `status` 400/403/404/409,
  `code`), que `handleError` convierte en `{ error, code }`. `ContractError` es una subclase con `detail` (como el
  `DetailedRuleError` del GL). El consumidor no traduce el error: el mensaje del proveedor llega al usuario. Códigos comunes: `PERIODO_CERRADO`, `CUENTA_INVALIDA`, `DESCUADRE`, `YA_EXISTE`, `NO_EXISTE`, `ANULADO`,
  `SIN_TRANSACCION`, `NO_EDITABLE` (en el código se escriben en minúsculas como los actuales: `period_closed`,
  `entry_not_editable`…; donde ya existe un código se reutiliza).
- **Permisos:** el consumidor verifica el permiso del usuario sobre **su** acción (p. ej. `banking.document.void`); el
  proveedor no vuelve a pedir permisos de su propio módulo (el usuario de Bancos no necesita `gl.entry.create`), pero sí
  aplica sus invariantes (período, cuentas). Excepción: operaciones del proveedor con efecto propio sensible
  (`periods.reopen`) exigen el permiso del área.
- **Bitácora:** cada lado audita lo suyo con `audit(tx, …)` en la misma transacción; el proveedor anota `via: '<source>'`.

### 0.5 Pruebas

Cada contrato tiene (a) pruebas del proveedor con un consumidor falso, (b) pruebas de cada consumidor con el proveedor
real en una base de prueba, (c) una prueba de **reversión**: forzar un error después de llamar al proveedor y comprobar
que nada quedó escrito, y (d) una prueba de idempotencia (llamar dos veces).

---

## 1. Contabilización en el libro mayor (`ledger`)

**Propósito:** el único camino para que un módulo cree, reemplace, anule o consulte la partida de su documento.
Reemplaza las cinco versiones de `CGADIPAR` (integracion-legado §4). **Provee:** `general-ledger`. **Consumen:**
`banking`, `accounts-payable`, `accounts-receivable`, `sales`, `inventory`, `production`, `fixed-assets`, `payroll`,
`tax` (solo la liquidación opcional) y los importadores.

### 1.1 Forma

```ts
export type GeneratedSource =
  | 'bancos' | 'cxp' | 'cxc' | 'ventas' | 'inventario'
  | 'produccion' | 'activo_fijo' | 'nomina' | 'iva';
// Orígenes que no usan el contrato: 'manual', 'cierre', 'importado' (este último solo el importador).

export interface PostLine {
  accountId: string;          // coa_accounts.id, de detalle y activa
  debit: string;              // decimal exacto '0.00' si no aplica
  credit: string;
  detail?: string;
  costCenterId?: string | null;   // obligatorio si la cuenta lo exige
  collectionDate?: string | null; // equivalente a FCOBRO
}

export interface PostEntryRequest {
  source: GeneratedSource;
  sourceRef: string;          // id del documento, lote o corrida del módulo
  entryTypeId: string;        // gl_entry_types.id, elegido por la configuración del módulo
  date: string;               // AAAA-MM-DD; decide el período
  concept: string;
  lines: PostLine[];          // al menos 2; Σ debit = Σ credit
  number?: string;            // solo con permiso y en modo migración/contingencia
}

export interface EntryRef {
  entryId: string; entryTypeId: string; period: string; number: string;
  // Igual que hoy: las generadas nacen 'aplicada'; anular = is_active false.
  status: 'aplicada'; isActive: boolean; source: string; sourceRef: string | null;
}

export interface LedgerPosting {
  post(tx: Tx, req: PostEntryRequest): EntryRef;
  replace(tx: Tx, req: PostEntryRequest): EntryRef;            // misma source+sourceRef
  void(tx: Tx, ref: { source: GeneratedSource; sourceRef: string },
       opts: { date: string; reason: string }): VoidResult;
  find(tx: Tx | Db, ref: { source: string; sourceRef: string }): EntryRef | null;
  preview(req: PostEntryRequest): PostPreview;                  // valida sin escribir
}

export type VoidResult =
  | { kind: 'anulada'; entry: EntryRef }                          // período abierto
  | { kind: 'reversada'; original: EntryRef; reversal: EntryRef }; // período cerrado
```

### 1.2 Reglas de validación (las mismas que la captura manual, en un solo lugar)

Cuadre exacto (`Σ debit = Σ credit`, aritmética decimal), cada línea con un solo lado y monto > 0, cuenta existente,
activa y **de detalle**, centro de costo cuando la cuenta lo exige, tipo de partida activo, **período GL abierto** para
`date` (contrato §2), empresa del contexto. Las partidas generadas nacen **`aplicada`**: no hay borrador en el GL para
orígenes generados (el borrador vive en el módulo dueño). Los dos decimales de los totales se aplican aquí; los módulos
envían importes ya redondeados.

### 1.3 Tipo y número

El tipo lo da la configuración del módulo (`bnk_transaction_types.entry_type_id`, `fa_settings.entry_type_id`,
`settings: ventas.entryTypeId`…). El número lo asigna **siempre el GL** con su regla actual: mensual por tipo, sin
renumerar, la anulada conserva el suyo (decisión CONTAC 5). `number` explícito solo para migración o contingencia con
`supervise` (pregunta BANCOC 18). Se elimina el "choque de correlativos con Bancos" (`cfg_bancos`).

### 1.4 Modificar, anular y volver a correr

| Acción del dueño | Período GL de la partida | Efecto |
|---|---|---|
| `replace` (documento modificado) | abierto, mismo período y tipo | Se reemplazan las líneas **en el lugar**: mismo id y número; bitácora con antes/después |
| `replace` | abierto, cambia el período o el tipo | Se anula la anterior y se crea otra (número nuevo); el documento guarda el nuevo `entryId` |
| `replace` | cerrado | `PERIODO_CERRADO`: no se modifica un documento contabilizado en mes cerrado; se anula y se emite otro |
| `void` | abierto | La partida pasa a `anulada` (no cuenta en saldos, conserva número y líneas) |
| `void` | **cerrado** | La original queda intacta; se crea una **partida de reverso** con fecha `opts.date` (debe caer en período abierto), líneas invertidas, `reverses_entry_id` = original y el mismo `source`/`sourceRef` con sufijo `:reverso` |
| volver a correr un lote/corrida | — | El dueño anula la corrida (que anula su partida) y crea otra corrida con id nuevo; no hay "borrar y reinsertar" |

**Ejemplo pedido — documento bancario en mes GL cerrado:** *crear* un cheque con fecha en un mes cerrado falla con
`PERIODO_CERRADO` (Bancos tampoco lo acepta porque su área también está cerrada o porque el GL lo rechaza).
*Anular* un cheque cuyo mes está cerrado: Bancos pide la fecha de anulación (por omisión hoy), el documento pasa a
`voided`, y el GL genera la partida de reverso en el mes de esa fecha. El reporte de cheques del mes cerrado sigue
mostrando el cheque emitido; el del mes de anulación muestra el reverso.

### 1.5 Edición desde la pantalla del GL

Las partidas con `source` generado son **de solo lectura** en la pantalla de partidas: se muestran con el origen y un
enlace "abrir documento de origen". Las rutas del GL (`PUT`, anular, regresar a borrador, copiar) rechazan con
`NO_EDITABLE`. Corregir = anular o modificar el documento dueño (P2). `manual`, `cierre` e `importado` siguen las reglas
actuales (S10–S13). *Alternativa descartada:* permitir editar y "marcar divergencia" — es lo que produjo los 1,067
`DETABANK` sin pareja.

### 1.6 Resumen vs por documento

El contrato no distingue: un resumen es un `sourceRef` que apunta a un **lote** del módulo (tabla `<prefijo>_posting_batches`
con sus ítems y unicidad "un documento en un solo lote vivo"). Por omisión se contabiliza por documento
(modulos-y-orden §2.3).

### 1.7 Centros de costo

Cada línea lleva su centro (se elimina el `cfg_centro` único de CxC/INV64). Los módulos los obtienen de su configuración
(p. ej. `pay_account_map.cost_center_id`, `fa_assets.cost_center_id`, `ventas.costCenterId` por empresa o por serie).

### 1.8 Cambios en el GL actual (verificados contra el código)

Lo que ya existe y se conserva: `gl_journal_entries` tiene `source` (enum `ENTRY_SOURCES` en
`modules/general-ledger/schema/entries.ts`, espejo de `GL_ENTRY_SOURCES` en `packages/shared/src/gl.ts`), `source_ref`,
`status` (`borrador`/`aplicada`), `is_active` (anulación), `imported_unbalanced`, índice no único
`gl_journal_entries_source_idx (source, source_ref)` y único `(empresa_id, period, entry_type_id, number)` que también
cubre anuladas. `assertEditable` (`services/entry-rules.ts`) ya rechaza editar orígenes fuera de `EDITABLE_SOURCES =
['manual', 'importado']` (`services/entry-detail.ts`) y `voidEntry` (`services/entry-actions.ts`) ya bloquea anular
`bancos` e `iva` con `VOID_BLOCKED`. La numeración (`services/numbering.ts`: `assignNumber`, `nextNumber`, máximo + 1 por
empresa, período y tipo, anuladas incluidas) es correcta con un solo escritor y se reutiliza tal cual.

| Archivo | Cambio |
|---|---|
| `packages/shared/src/gl.ts` y `schema/entries.ts` | `GL_ENTRY_SOURCES`/`ENTRY_SOURCES` += `cxp`, `cxc`, `ventas`, `inventario`, `produccion`, `activo_fijo`, `nomina`; nueva constante `GL_GENERATED_SOURCES` (todos menos `manual`, `cierre`, `importado`); tipos del contrato (`PostEntryRequest`, `EntryRef`, `VoidResult`) |
| `schema/entries.ts` (migración nueva) | Columnas `reverses_entry_id` (FK a la misma tabla), `legacy_ref` (llave `SALFEC\|TIPOPAR\|NUMERO`), `origin_confidence` (`exacta`/`inferida`, nula para manuales). Índice **único parcial** `(empresa_id, source, source_ref) WHERE is_active = 1 AND source_ref IS NOT NULL AND source NOT IN ('manual','cierre','importado')` (SQL a mano en la migración si Drizzle no genera el `WHERE`) |
| `services/entries-write.ts` | `createEntry` hoy fija `source: 'manual'` dentro de `inTx`. Extraer `insertEntry(tx: Ctx, data, origin: { source, sourceRef, legacyRef?, confidence? })` y `replaceEntryLines(tx, row, data)` sin `inTx` (los llama tanto la ruta como el proveedor). `updateEntry` borra e inserta las líneas (`delete(l)`): se conserva, son parte del documento y la versión anterior queda en bitácora (`snapshot`) |
| `services/entry-rules.ts` | `SOURCE_MESSAGES` → mensaje genérico por origen generado ("Partida generada por {módulo}: modifíquela desde ese módulo"); `assertDateInPeriod` se mantiene (el contrato deriva `period` de `date`) |
| `services/entry-actions.ts` | `VOID_BLOCKED` → cualquier `GL_GENERATED_SOURCES`; `applyEntry`/`unapplyEntry`/`copyEntry` rechazan orígenes generados (copiar sí puede permitirse como borrador `manual`: decisión menor, se permite) |
| `services/periods.ts` | `isPeriodClosed`/`assertPeriodOpen` delegan en el contrato `periods` (área `gl`); `closePeriod` conserva su validación de borradores; `reopenPeriod` gana `reason` obligatorio; migración de `gl_periods` → `core_periods` |
| `services/ledger-provider.ts` (nuevo, < 200 líneas) y `services/ledger-void.ts` | Implementación de `LedgerPosting` sobre `insertEntry`/`replaceEntryLines`/`assignNumber`/`validateLines`; `void` con reverso |
| `manifest.ts` | `provides: ['ledger', 'costCenters', 'balances']`; permisos finos (hoy `permissions: { owner, admin, member }` no lo usa ninguna ruta) |
| `lib/context.ts` | `Ctx` gana `via?: string` para auditar "vía contrato" y `userId` del consumidor |

`inTx` usa `ctx.db.transaction(...)`; si el proveedor lo llamara dentro de la transacción del consumidor, Drizzle abriría
un punto de guardado anidado. Para que la semántica sea una sola transacción, **el proveedor nunca llama `inTx`**:
recibe un `Ctx` ya ligado al `tx` del consumidor.

**Transferencias del historial:** 9 llaves de partida de `MOVIBAN` tienen dos movimientos (`bancoc/data-model.md` §2). Se
importan como dos documentos; la partida queda con `source_ref` = id del **primero** y el segundo guarda el mismo
`gl_entry_id` sin ser dueño. En adelante una transferencia es **un** documento con dos extremos (BANCOC 10).

### 1.9 Historial: re-atribuir partidas `importado`

El importador de CONTAC trae todo como `source = 'importado'`, `source_ref = SALFEC|TIPOPAR|NUMERO`. Como el indicador
`GENERADO` del legado no sirve (integracion-legado §2.1, §4.4), el origen se deduce por **vínculo** y, si no hay, por
**concepto**:

| Origen | Cómo se reconoce | Confianza |
|---|---|---|
| `bancos` | llave en `MOVIBAN` (`SALFEC+TIPOPAR+NUMERO`) | exacta |
| `cxp` | `QUEDAN.TIPOPAR+NUMDOC` / lotes de `qwgpro01` | exacta |
| `activo_fijo` | llave en `MOVDEPRE` (salvo 2023-01/02, P14) | exacta |
| `cxc`, `ventas` | texto del concepto ("VENTAS DEL…", "ABONOS DE CLIENTES DEL…", "COSTO DE VENTA…") | inferida |
| `produccion`, `nomina` | concepto (no hay vínculo) | inferida |

La re-atribución **no es un método del contrato** (el importador `tools/legacy-import` escribe SQL directo con la API
detenida, como hoy `src/contac/entries.ts`): es una función común del importador,
`reattributeEntries(sql, empresaId, [{ legacyKey, toSource, sourceRef, confidence }])`, que solo cambia filas con
`source = 'importado'`, busca por `legacy_ref` (que el importador de CONTAC debe empezar a llenar; hoy solo llena
`source_ref` con la misma llave), escribe `source`, `source_ref`, `origin_confidence` y una fila de `core_audit_log`
(`module = 'legacy-import'`) en la misma transacción, y reporta las llaves no encontradas. Las partidas `inferida` siguen siendo de
solo lectura pero el reporte de paridad las separa. Las partidas históricas resumen de CxC/INV64 (A4/A5) se vinculan a un
lote histórico sin ítems (`cxc64/data-model.md` §2).

---

## 2. Estado de períodos (`periods`)

**Propósito:** una sola respuesta a "¿está abierto el mes M del área A en la empresa E?". **Provee:** núcleo.
**Consumen:** todos.

```ts
export type PeriodArea = 'gl' | 'banking' | 'ap' | 'ar' | 'inventory' | 'sales'
  | 'tax' | 'production' | 'fixed_assets' | 'payroll';
export type PeriodStatus = 'open' | 'closed' | 'filed';   // 'filed' solo en tax

export interface Periods {
  status(db: Db | Tx, area: PeriodArea, date: string): PeriodStatus;   // sin fila ⇒ 'open'
  assertOpen(tx: Tx, areas: PeriodArea[], date: string): void;          // lanza PERIODO_CERRADO
  close(tx: Tx, area: PeriodArea, period: string, by: UserRef): void;
  reopen(tx: Tx, area: PeriodArea, period: string, by: UserRef, reason: string): void;
  markFiled(tx: Tx, period: string, by: UserRef, ref: string): void;   // tax
  list(db: Db, area: PeriodArea, year: number): PeriodRow[];
}
```

Tabla `core_periods(empresa_id, area, period 'AAAA-MM', status, closed_by, closed_at, reopened_by, reopened_at,
reopen_reason)`, única `(empresa_id, area, period)`. Reglas: el `ledger.post` llama `assertOpen(['gl'])`; cada módulo llama
`assertOpen([suárea])` al crear/modificar/anular; `close('gl')` ejecuta antes las validaciones propias del GL (sin
borradores, S12) y consulta las áreas que contabilizan (advertir o exigir, M1); cada módulo puede registrar una
**validación previa al cierre** de su área (p. ej. `production`: sin órdenes procesadas sin partida). `reopen` exige el
permiso `<área>.period.reopen` (paquete `supervise`), motivo obligatorio y bitácora; reabrir un subledger no reabre el GL.
`filed` no se reabre sin `supervise` y motivo. **Importación:** `CIERRE` de INV64, `CIERREC` de cxc64, la marca
`CERRADO` de `PARTIDAS` (CONTAC), `COMPRAS/IVAFIS/ivafac` (IVA64) y el `CIERRE` de planilla se convierten a filas
`closed` por área; `gl_periods` se migra con sus usuarios y fechas.

---

## 3. Movimientos de existencias (`stock`)

**Propósito:** que ventas, compras, producción y ajustes muevan existencias de `inventory` sin escribir sus tablas
(LOTE64 escribía ocho). **Provee:** `inventory`. **Consumen:** `sales`, `accounts-payable` (recepción), `production`.

```ts
export type StockSource = 'ventas' | 'compras' | 'produccion' | 'ajuste' | 'transferencia' | 'toma_fisica';

export interface StockLine {
  itemId: string; warehouseId: string;
  direction: 'in' | 'out';
  quantity: string;                  // decimal 5
  unitCost?: string;                 // obligatorio en 'in' salvo devolución (usa el costo de la salida original)
  lot?: { lotNo: string; expiresOn?: string | null } | null;
  reversalOfMovementId?: string;     // devoluciones al costo original (P10)
}

export interface StockPostRequest {
  source: StockSource; sourceRef: string; date: string;
  movementTypeId: string;            // concepto (inv_movement_types)
  lines: StockLine[];
  allowNegative?: boolean;           // solo con permiso (P11)
}

export interface StockPostResult {
  movements: { movementId: string; lineIndex: number; unitCost: string; totalCost: string }[];
  totalCost: string;
}

export interface Stock {
  post(tx: Tx, req: StockPostRequest): StockPostResult;
  reverse(tx: Tx, ref: { source: StockSource; sourceRef: string }, date: string): StockPostResult;
  find(db: Db | Tx, ref: { source: StockSource; sourceRef: string }): StockPostResult | null;
  onHand(db: Db | Tx, q: { itemId: string; warehouseId?: string; lotNo?: string; at?: string }): string;
  averageCost(db: Db | Tx, itemId: string): string;
}
```

- **Costeo:** promedio móvil por producto (todas las bodegas, como el legado y P10). Una salida se valúa al promedio
  vigente **en el momento del grabado** y el costo queda congelado en el movimiento y en la línea del consumidor
  (`sal_document_lines.unit_cost_at_sale`). Una entrada actualiza `inv_cost_state` en la misma transacción. No hay
  re-valuación al cierre (P10). Transferencias: salida y entrada al mismo costo.
- **Validaciones:** producto activo y no servicio, bodega activa, área `inventory` abierta, existencia suficiente salvo
  `allowNegative` con permiso `inventory.stock.negative` (P11), lote obligatorio si `tracks_lots`.
- **Reverso:** `reverse` crea movimientos inversos con `reversal_of` (no borra); una venta anulada devuelve al costo con
  que salió. **Modificar** un documento = `reverse` + `post`.
- **Contabilidad:** `stock` **no** contabiliza; el consumidor incluye el costo en su partida (ventas: costo vs
  inventario; producción: consumo y entrada). Para `ajuste`/`toma_fisica`/`transferencia` el dueño del documento es
  `inventory` y él contabiliza con `source = 'inventario'`.
- **Importación:** `MOVIMIEN`/`DATAMOV` se cargan como movimientos con su costo ya fijado (no se recalcula); los de
  producción (`PR`/`EP`) se enlazan luego a `prod_order_links`; existencias y promedio se **recalculan** y se comparan con
  `BODMES`/`MESES`/`ARTICULO` (reporte, no se fuerzan).

---

## 4. Documentos por cobrar y por pagar (`receivables`, `payables`)

**Propósito:** `sales` crea el cargo en cartera; `accounts-payable` posee el documento por pagar y recibe pagos de
`banking`. **Proveen:** `accounts-receivable` (`receivables`), `accounts-payable` (`payables`). **Consumen:** `sales`
(→ receivables), `banking` (→ payables, y receivables para enlazar depósitos), `inventory`/`production` (→ payables para
recepciones y maquila, solo lectura y enlace).

```ts
export interface ChargeRequest {
  source: 'ventas'; sourceRef: string;          // sal_documents.id
  partyId: string; kind: 'invoice' | 'debit_note' | 'credit_note';
  taxKind: 'C' | 'F' | 'E'; number: string; date: string; dueDate: string | null;
  amounts: { taxable: string; exempt: string; vat: string; vatWithheld: string; total: string };
  appliesToSourceRef?: string;                   // notas: documento de venta original
  salespersonId?: string | null;
}

export interface Receivables {
  createCharge(tx: Tx, req: ChargeRequest): { arDocumentId: string };
  voidCharge(tx: Tx, ref: { source: 'ventas'; sourceRef: string }, reason: string): void;
  balance(db: Db | Tx, q: { arDocumentId?: string; partyId?: string; at?: string }): string;
  linkDeposit(tx: Tx, q: { collectionBatchId?: string; checkIds?: string[]; bankDocumentId: string }): void;
}

export interface PaymentApplication { apDocumentId: string; amount: string }

export interface Payables {
  applyPayment(tx: Tx, req: { bankDocumentId: string; date: string; applications: PaymentApplication[] }): void;
  reversePayment(tx: Tx, bankDocumentId: string, date: string): void;
  openDocuments(db: Db | Tx, q: { partyId: string; at?: string }): ApOpenDocument[];
  registerReceipt(tx: Tx, req: { apDocumentId: string; source: 'compras' | 'produccion'; sourceRef: string }): void;
}
```

- El cargo **no contabiliza** (lo hizo la partida de la venta, modulos-y-orden §2.2); guarda `source`/`sourceRef` y CxC
  no permite modificarlo a mano (se anula desde la venta). `voidCharge` falla con `TIENE_APLICACIONES` si ya hay cobros:
  primero se revierten (P8).
- `applyPayment`: el cheque o transferencia de Bancos contabiliza su propia partida (banco contra proveedor) y en la misma
  transacción aplica a documentos; valida saldo suficiente, proveedor del documento = tercero del cheque, documento no
  anulado. Anular el cheque llama `reversePayment`. La cancelación manual sin documento bancario la hace CxP con su
  propia partida (BANCOC 27).
- Saldos siempre calculados (`total + Σ débitos − Σ créditos − Σ pagos`).
- **Importación:** `CCMOV01` y `QUEDAN/NCREDEB/MOVQUE` con su `legacy_ref`; los `C0` se enlazan a `sal_documents` por
  `(FTMOV, FREF, FTICOM)` sin crear un segundo cargo; los `MOVQUE` a `bnk_documents` por `CTABANCO+NUMDOC`.

---

## 5. Renglones de los libros de IVA (`taxBooks`)

**Propósito:** que cada documento registre su renglón de libro **con enlace real** a su origen, en lugar del
traslado "borrar el mes y reinsertar el rango" (integracion-legado E1–E3). **Provee:** `tax`. **Consumen:**
`accounts-payable` (compras, sujeto excluido, retenciones), `sales` (contribuyentes y consumidor final), `banking`
y `general-ledger` ("Ingresar al IVA / Renta").

```ts
export type TaxBook = 'compras' | 'ventas_contribuyente' | 'ventas_consumidor' | 'renta_retenida';

export interface TaxEntryRequest {
  book: TaxBook; sourceModule: 'cxp' | 'ventas' | 'bancos' | 'gl'; sourceRef: string;
  period: string;                 // AAAA-MM del libro; por omisión el mes de documentDate
  documentDate: string; documentTypeCode: string; number: string;
  partyId: string | null; partySnapshot: { name: string; nrc?: string; nit?: string; dui?: string };
  amounts: Record<string, string>;     // columnas del libro según `book` (esquema Zod por libro)
  dte?: { generationCode: string; controlNo: string; seal?: string } | null;
  glEntryId?: string | null;
}

export interface TaxBooks {
  register(tx: Tx, req: TaxEntryRequest): { taxEntryId: string };   // upsert por (sourceModule, sourceRef, book)
  void(tx: Tx, ref: { sourceModule: string; sourceRef: string; book: TaxBook }, reason: string): void;
  updateDte(tx: Tx, ref: { sourceModule: string; sourceRef: string }, dte: TaxEntryRequest['dte']): void;
}
```

- **Período:** `assertOpen(['tax'])` sobre `period`; si está cerrado o presentado, `register` falla y el consumidor
  ofrece al usuario el siguiente período abierto para compras (registro tardío, permitido en el legado); ventas no
  (su período es el del documento).
- **Modificar** = `register` con el mismo origen (reemplaza en el lugar si el período sigue abierto); **anular** = `void`.
  Las capturas manuales de `tax` llevan `sourceModule = 'manual'` y nunca las toca un origen.
- **Consumidor final:** se registra cada documento; el resumen diario por rangos del libro se **calcula** al imprimir y
  al generar el anexo (no se guarda), con la fórmula mensual del legado (IVA64 §3.4).
- `tax` copia importes; puede recalcular como control y reportar diferencias (modulos-y-orden §2.4).
- **Importación:** `COMPRAS`, `IVAFIS`, `ivafac`, `RENTAT` como renglones con `sourceModule = 'importado'` y el enlace de
  mejor esfuerzo de `iva64/data-model.md` §3.3; las copias de libros en `INV64\DBF` se cargan aparte y se comparan (I6).

---

## 6. Bandeja de salida del DTE (`dteOutbox`)

**Propósito:** que `sales` (y `accounts-payable` para sujeto excluido, tipo 14) dejen el documento listo para la
solución `factura-electronica-mc` y reciban su estado, sin escribir DBF. Sigue la ruta (b) de `dte/README.md` §5: la
plataforma publica una tabla con **los mismos nombres de columna** que `FELECTRO`/`FANULAR`, y la solución .NET gana una
fuente alternativa que la lee y escribe el resultado **por API**. **Provee:** `dte`. **Consumen:** `sales`,
`accounts-payable`. Lector externo: la solución .NET (cliente autenticado de la API, no un módulo).

```ts
export interface DteEnqueueRequest {
  source: 'ventas' | 'cxp'; sourceRef: string;
  dteType: '01' | '03' | '05' | '06' | '11' | '14';  // los implementados en la solución
  legacyDocKind: 'F' | 'C' | 'N' | 'D' | 'E' | 'S';  // TIPODOC del legado
  number: string;                                      // NFACT_ENV
  issueDate: string; issueTime: string;
  header: DteHeaderColumns;     // emisor (de core_empresa_profile + dte_establishments), receptor (instantánea de parties),
                                // resumen, exportación, referencia (05/06), apéndices — nombres = columnas de FELECTRO
  lines: DteLineColumns[];      // NUMITEM, CODIGO, CANTIDAD, PRECIOUNI, VENTAGRAVA, IVALIN…; importes ya calculados
}

export type DteState = 'pendiente' | 'reclamado' | 'aceptado' | 'fallido' | 'invalidacion_pendiente' | 'invalidado';
export interface DteStatus {
  state: DteState; controlNo: string | null; generationCode: string | null; seal: string | null;
  failure: string | null; files: { kind: 'pdf' | 'json' | 'qr'; fileId: string }[];
}

export interface DteOutbox {
  enqueue(tx: Tx, req: DteEnqueueRequest): { dteDocumentId: string };
  replace(tx: Tx, req: DteEnqueueRequest): { dteDocumentId: string };  // solo si state = 'pendiente' o 'fallido'
  requestInvalidation(tx: Tx, ref: { source: string; sourceRef: string },
                      req: { kind: string; reason: string; responsible: UserRef; replacementSourceRef?: string }): void;
  status(db: Db | Tx, ref: { source: string; sourceRef: string }): DteStatus | null;
}
```

**Tablas** (todas con `empresa_id`): `dte_documents` (un registro por documento, estado, identificadores),
`dte_outbox` (una fila por **línea**, columnas = `FELECTRO` §1.2 de `dte/data-model.md`, más `row_id`, `dte_document_id`,
`claimed_by`, `claimed_at`, `leased_until`), `dte_invalidation_outbox` (columnas = `FANULAR`), `dte_attempts`,
`dte_establishments`, `dte_settings` (referencias a secretos, nunca el secreto), `dte_files` (→ `core_files`).

**Ciclo:**
1. `sales` emite el documento y, en la **misma transacción**, llama `enqueue`: se escriben el documento y sus N filas con
   `NLINEAS = N`, estado `pendiente` (`PROCESADO = 0`, `FALLO = 0`). Si la transacción falla no queda nada en la bandeja.
2. La solución .NET llama `POST /api/dte/outbox/claim` (arrendamiento por documento, no `select *` de toda la tabla),
   recibe filas con los nombres de columna que ya sabe leer, firma y transmite.
3. Devuelve por `POST /api/dte/outbox/:id/result` exactamente lo que hoy escribe en el DBF — `PROCESADO`, `FALLO`,
   `NCONTROL`, `CODGENERAC`, `SELLORE` — **más** el motivo del rechazo y los archivos (`<CODGENERAC>.pdf|json|png`), que
   hoy se pierden. La API actualiza `dte_documents`, guarda los archivos y llama `taxBooks.updateDte` para el renglón de
   libro (el legado lo leía en el traslado, F3).
4. Arrendamiento vencido sin resultado ⇒ vuelve a `pendiente` **sin** generar código nuevo por parte de la plataforma; la
   regla "reconsultar a Hacienda antes de reenviar" es de la solución (riesgo 2 de `dte/README.md` §6).

**Modificar y anular:** un documento `aceptado` no se modifica (INV 6); la venta se corrige con nota de crédito o con
invalidación. `replace` solo antes de aceptado. Anular una venta aceptada exige `requestInvalidation` en la misma
transacción que anula el documento de venta; la invalidación tiene su propio estado. **Número de control:** lo sigue
calculando la solución con su configuración de establecimiento y los últimos 8 caracteres de `NFACT_ENV`; la
plataforma garantiza que `NFACT_ENV` no se repite por serie (`core_sequences`) y que su piso inicial es el último número
usado por el ERP viejo (`dte/data-model.md` §4).

**Permisos:** emitir = permiso de `sales`; invalidar = `sales.document.void` + motivo; la solución .NET usa una cuenta de
servicio con un permiso único `dte.outbox.process` (sin acceso a otras rutas). **Bitácora:** cada cambio de estado.
**Pruebas:** con los JSON dorados del repositorio de la solución (`SampleDtes`): la fila de bandeja debe producir el mismo
JSON que hoy produce `FELECTRO`. **Importación:** grupos `(NFACT_ENV, TIPODOC)` de `FELECTRO` → `dte_documents`
(estado según la tabla §1.4 de `dte/data-model.md`); `FANULAR` → invalidaciones; `EnviosDTE` → `dte_attempts`; archivos de
`PDFPath` → `core_files`. La bandeja de una empresa migrada empieza vacía.

**Destino (fase 7):** el módulo `dte` firma y transmite él mismo; el contrato `DteOutbox` no cambia para `sales`.

---

## 7. Lectura de maestros ajenos (`lookup`)

**Regla:** (1) si el consumidor **guarda** la referencia, declara la llave foránea con un stub en su `refs.ts` (integridad
en la base, como hoy hacen `chart-of-accounts` y `general-ledger`); (2) para **leer** atributos (nombre, si está activa,
si es de detalle, NRC, cuentas por omisión del producto) usa el lookup del dueño, nunca un `select` directo a la tabla
ajena; (3) los reportes guardan **instantáneas** (nombre y NRC al emitir) cuando el documento es legal.

```ts
export interface Lookups {
  accounts: { get(db, id): AccountInfo | null; assertPostable(db, id): void; byCode(db, code): AccountInfo | null };
  costCenters: { get(db, id): CostCenterInfo | null; requiredFor(db, accountId): boolean };
  parties: { get(db, id): PartyInfo | null; byNrc(db, nrc): PartyInfo | null; search(db, q): PartyInfo[] };
  items: { get(db, id): ItemInfo | null; accounts(db, id): { inventory: string; sales: string; cogs: string } };
  employees: { get(db, id): EmployeeInfo | null };            // sin sueldo salvo view_salaries
  bankDocuments: { get(db, id): BankDocumentInfo | null };
}
```

Proveedores: `chart-of-accounts` (accounts), `general-ledger` (costCenters, y `balances(db, {accountId, period})` para
reportes de control), `parties`, `inventory` (items), `payroll` (employees), `banking` (bankDocuments). Los lookups son de
solo lectura, aceptan `db` o `tx`, no auditan y respetan permisos sensibles (`view_costs`, `view_salaries`).

---

## 8. Configuración y correlativos (`settings`, `sequences`)

```ts
export interface Settings {
  get<T>(db: Db | Tx, ns: string, key: string, at?: string): T;      // valor vigente a la fecha
  set(tx: Tx, ns: string, key: string, value: unknown, validFrom: string, by: UserRef): void;
  history(db: Db, ns: string, key: string): SettingVersion[];
}
export interface Sequences {
  next(tx: Tx, scope: string, key: string): { value: number; formatted: string };
  peek(db: Db | Tx, scope: string, key: string): string;           // sugerencia, no reserva
  define(tx: Tx, def: SequenceDef): void;                           // prefijo, ancho, rango, vigencia, resolución
}
```

- `core_empresa_settings(empresa_id, namespace, key, value JSON, valid_from, updated_by, updated_at)`, única
  `(empresa_id, namespace, key, valid_from)`. Cada módulo registra en su manifiesto el **esquema Zod** de sus claves;
  las cuentas se validan como cuentas de detalle existentes. Con vigencia: tasas de IVA, retención, percepción, anticipo,
  LIOF y sus umbrales (`tax`, `banking`), parámetros de planilla (estos en `pay_param_sets`, que ya tiene vigencia). Sin
  vigencia: cuentas por omisión, tipos de partida por módulo, modos (`posting_mode`, `credit_limit_mode`).
- `core_sequences(empresa_id, scope, key, next_value, width, prefix, range_from, range_to, valid_from, valid_to,
  authorization_ref)`: `next` hace `UPDATE … SET next_value = next_value + 1 … RETURNING` dentro de la transacción del
  documento (si el documento falla, el número no se consume). Fuera de rango ⇒ `SERIE_AGOTADA`. Usos: cheques por cuenta
  (sugerencia, el cheque se valida único), recibos de CxC, series fiscales de ventas, comprobantes de retención, número
  de quedan, corridas de planilla. Las **partidas** no usan `core_sequences`: las numera el GL.
- **Importación:** cada `.MEM` se lee con la regla "el archivo que ganaba en ejecución fija el valor"
  (plataforma-compartida D3); `cfg_iva` se convierte a porcentaje (D4); divergencias entre módulos se reportan. Los
  correlativos arrancan en el mayor número importado + 1.

---

## 9. Matriz módulo × contrato

P = provee · C = consume · c = consume opcional · — = no

| Módulo | ledger | periods | stock | receivables | payables | taxBooks | dteOutbox | lookup | settings / sequences |
|---|---|---|---|---|---|---|---|---|---|
| núcleo | — | P | — | — | — | — | — | — | P |
| chart-of-accounts | — | — | — | — | — | — | — | P (accounts) | C |
| general-ledger | P | C | — | — | — | — | — | P (costCenters, balances) · C | C |
| parties | — | — | — | — | — | — | — | P (parties) | C |
| banking | C | C | — | c | c | c | — | P (bankDocuments) · C | C |
| accounts-payable | C | C | c | — | P | c | c | C | C |
| accounts-receivable | C | C | — | P | — | — | — | C | C |
| inventory | C | C | P | — | c | — | — | P (items) · C | C |
| sales | C | C | C | c | — | c | c | C | C |
| dte | — | — | — | — | — | — | P | C | C |
| tax | c | C | — | — | — | P | — | C | C |
| production | C | C | C | — | c | — | — | C | C |
| fixed-assets | C | C | — | — | — | — | — | C | C |
| payroll | C | C | — | — | — | — | — | P (employees) · C | C |
