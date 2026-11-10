# CONTAC — Modelo de datos

## Tablas legadas principales

| Tabla | Contenido | Campos clave |
|---|---|---|
| `CATALOGO` | Catálogo de cuentas | cuenta C14, nombrecta C45, tipocta N1, anterior C14, es_detalle L, nivel N1, union C14, pcosto L, codigoa C3 |
| `TIPOPAR` | Tipos de partida | tipopar C2, nombre C25, bancos L, numero N7 |
| `CCOSTO` | Centros de costo | codigo C3, descrip C50 |
| `PARTIDAS` | Encabezado de partida | tipopar C2, numero C7, concepto C120, fecha D, salfec C6, cerrado L, generado N2 |
| `DETAPART` | Líneas de partida | salfec, tipopar, numero, cuenta C14, detalle C200, cargo N12.2, abono N12.2, tipomov N1, fecha, ccosto C3, fcobro D |
| `SALDOS` | Saldos por mes y cuenta | salfec, cuenta, saldoant, cargos, abonos, saldo, saldomes |
| `SALDOCC` | Saldos por mes, cuenta y C. costo | (igual) + ccosto |
| `PERIODO` | Período fiscal | periodo C10, nombre, inicio/anio, fin/anio2, largo, cata, ccosto |
| `PRESUP` | Presupuesto | cuenta, pmes1..pmes12, periodo, ccosto, codigoa, totalp |
| `AGRUPA` | Agrupaciones de presupuesto | codigoa C3, descripa C50 |
| `ESTADO01/02/03` | Estados de resultados definidos | id, nombre, rubros (orden, operación, cálculo), cuentas por rubro (operación, %) |
| `CIERRE1/2` | Borrador de partida de cierre | igual a PARTIDAS / DETAPART |
| `EMPRESAS` | Empresas | empresa, siglas, camino, moneda, consolida, conso, grande, … |
| `USUARIOS` | Usuarios | usuario, nombre, usrlvl, fechac, fecham (+ clave) |
| `USREMP` | Usuario ↔ empresa | usuarioe, siglase, permiso |
| `PERFIL` | Permiso por pantalla | usuario, programa, permiso |
| `BITACORA` | Auditoría | usuario, fecha, hora, programa, concepto |

Clave natural de una partida: `salfec + tipopar + numero`. Las líneas no tienen id propio.
Hay además decenas de tablas temporales (`PTEMP*`, `DTEMP*`, `PPROV*`, `DPROV*`) y respaldos que no se migran.

## Modelo propuesto (plataforma nueva)

Reglas de la plataforma: tablas con prefijo, montos como TEXT + decimal.js, sin DELETE
(anulación con `isActive = 0`), fechas ISO 8601, **`empresa_id` en toda tabla de negocio**.

### Plataforma (compartido)

- `core_empresas` — nombre, siglas, moneda, gran_contribuyente, consolida_en_id, configuración contable (JSON validado con Zod o tabla `gl_settings`).
- `core_user_empresas` — usuario ↔ empresa permitida.
- `core_audit_log` — usuario, empresa, fecha/hora ISO, módulo, acción, detalle (reemplaza BITACORA).
- Roles: Supervisor / Digitador y Consulta / Digitador / Consulta → roles de Better Auth; permiso por pantalla → permisos del manifest.

### chart-of-accounts

`coa_accounts`

| Columna | Origen |
|---|---|
| id, empresa_id | nuevo |
| code | cuenta |
| name | nombrecta |
| type | tipocta → `activo, pasivo, capital, gastos, ingresos, orden, contra` |
| parent_id | anterior (`"0"` → null) |
| level | nivel (derivable) |
| is_detail | es_detalle |
| requires_cost_center | pcosto |
| budget_group_id | codigoa |
| is_active, created_at, updated_at | nuevo |

Único: `(empresa_id, code)`.

### general-ledger

- `gl_entry_types` — empresa_id, code (2), name, is_bank.
- `gl_cost_centers` — empresa_id, code (3), name, is_active.
- `gl_fiscal_years` — empresa_id, name, start (AAAA-MM), end (AAAA-MM).
- `gl_periods` — empresa_id, year, month, status (`open | closed`), closed_by, closed_at.
- `gl_journal_entries` — empresa_id, period (`AAAA-MM`), entry_type_id, number, date, concept,
  status (`borrador | aplicada`; solo las aplicadas cuentan en saldos y deben cuadrar),
  imported_unbalanced (partida del legado importada con cargos ≠ abonos),
  source (`manual | bancos | iva | cierre | importado`), source_ref, is_active, created_by, timestamps.
  Único: `(empresa_id, period, entry_type_id, number)`.
- `gl_journal_lines` — entry_id, line_no, account_id, cost_center_id, detail, debit, credit, collect_date (fcobro).
- `gl_budget_groups`, `gl_budgets` — empresa_id, fiscal_year_id, account_id, cost_center_id, month, amount.
- `gl_statement_layouts`, `gl_statement_lines` — diseñador de estados (rubros, operación, cuentas, %).

**Sin tablas de saldos.** Los saldos se calculan con SQL a partir de las líneas
(con roll-up por jerarquía). Si el volumen lo exige, se agrega una tabla caché que se
actualiza en la misma transacción.

### Estado del schema (implementado 2026-11-10)

Implementado en `apps/api/src/db/schema-core.ts`, `modules/chart-of-accounts/schema.ts` y
`modules/general-ledger/schema/`, con migraciones generadas. Diferencias con lo propuesto arriba:

- Los grupos de presupuesto viven en chart-of-accounts como `coa_budget_groups` (no
  `gl_budget_groups`): son un atributo de la cuenta y el catálogo no puede depender del GL.
- `gl_periods` usa una columna `period` (`AAAA-MM`) en vez de `year` + `month`. Un mes sin
  fila está abierto.
- `gl_entry_types.number_width`: ancho del correlativo (6; `CP` usa 7).
- `gl_statement_layouts` / `gl_statement_lines` **no se crearon**: esperan la pregunta 8 y la
  extracción de los `.frx`.
- `core_empresas.moneda` guarda un código ISO (por defecto `USD`). En el legado `moneda` es un
  código numérico (se observó el valor `2`); el importador debe traducirlo.
- La configuración contable por empresa (cuentas de IVA, tasas) aún no tiene tabla.
- `gl_budgets`: el índice único no impide duplicados cuando `cost_center_id` es nulo
  (en SQLite los nulos son distintos); la API debe validarlo.

Llaves foráneas entre módulos: los módulos no se importan entre sí. Cada módulo declara en
`refs.ts` un stub de las tablas ajenas que referencia (`core_empresas`, `coa_accounts`); el
stub no se exporta desde `schema.ts`, así que drizzle-kit genera la llave foránea real sin
crear ni alterar la tabla ajena. Migraciones de un módulo: `pnpm db:generate` en su carpeta.

## Migración de datos (DBF → SQLite)

- Codificación: tablas marcadas `0x03` (Windows-1252); las no marcadas (`0x00`) se detectan
  por heurística (cp1252 vs cp850). Todo se convierte a UTF-8.
- Montos `N12.2` → string decimal exacto (sin pasar por float).
- `salfec` `AAAAMM` → `AAAA-MM`; fechas `D8` → ISO.
- Partidas con `cerrado = .T.` → el período queda `closed`.
- Partidas anuladas: los registros marcados como borrados en el DBF no se importan (confirmar).
- Validación de paridad: el Balance de Comprobación de cada mes importado debe coincidir al
  centavo con `SALDOS` del legado.
