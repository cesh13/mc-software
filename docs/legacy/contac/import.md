# CONTAC — Importador DBF → SQLite

Paquete `tools/legacy-import` (`@accounting/legacy-import`) y comando `apps/api/src/cli/import-contac.ts`.
Lee `MCERP/CONTAC` en modo solo lectura (nunca escribe en `MCERP/`) y carga la empresa en las tablas
`core_`, `coa_` y `gl_`. Todo corre en **una sola transacción**: si algo falla, no queda nada.

## Cómo correrlo

Desde la raíz del repo:

```
pnpm --filter @accounting/api legacy:import -- --source MCERP/CONTAC --db <archivo.sqlite> --parity --report <informe.json>
```

| Opción | Efecto |
|---|---|
| `--source` | Carpeta `MCERP/CONTAC` (con `dbf/` y `fuente/`). Obligatoria. |
| `--db` | Archivo SQLite **sin cifrar** (se crea y se migra solo). Sin esta opción usa la base cifrada de la plataforma. |
| `--replace` | Reemplaza la importación anterior de esa empresa (ver abajo). |
| `--parity` | Compara los saldos recalculados con `SALDOS` y `SALDOCC` del legado. |
| `--report` | Escribe el informe completo (importación y paridad) en JSON. |
| `--user` | Usuario para `created_by` y la bitácora (por defecto `importador`). |
| `--siglas` | Empresa dueña del libro si `EMPRESAS` lista varias vigentes (por defecto la primera, con aviso). |

Antes de importar corre las migraciones de la plataforma y de los módulos `chart-of-accounts` y `general-ledger`.
**No correr contra la base cifrada real sin revisar antes el informe en una copia.**

**Re-ejecución.** Si la empresa (por `siglas`) ya tiene datos contables, el importador se niega. Con `--replace`
borra físicamente las filas `coa_*` y `gl_*` de esa empresa y vuelve a importar, conservando el mismo
`core_empresas.id`. Este es el único lugar donde se permite un `DELETE` físico (herramienta de migración).
Se niega también si la empresa tiene partidas que no vienen del legado (`source <> 'importado'`).

## Mapeo de tablas

| Legado | Nuevo | Notas |
|---|---|---|
| `EMPRESAS` (en `fuente/` o `dbf/`) | `core_empresas` | Una fila por empresa vigente. `moneda` numérica → ISO: solo `2` → `USD` (no confirmado en el código fuente); cualquier otro código → `USD` con aviso. `grande` → `gran_contribuyente`. |
| `CATALOGO` | `coa_accounts` | `anterior` `"0"` o vacío = raíz; `tipocta` 1..7 = activo, pasivo, capital, gastos, ingresos, orden, contra; `es_detalle`, `nivel`, `pcosto`, `codigoa`. |
| `AGRUPA` | `coa_budget_groups` | |
| `TIPOPAR` | `gl_entry_types` | `number_width` = ancho máximo de número realmente usado (6 si no hay uso). |
| `CCOSTO` | `gl_cost_centers` | |
| `PERIODO` | `gl_fiscal_years` | La fila única no es confiable: se crea un ejercicio enero–diciembre por cada año con partidas (o presupuesto), con aviso. |
| `PARTIDAS` + `DETAPART` | `gl_journal_entries` + `gl_journal_lines` | `status='aplicada'`, `source='importado'`, `source_ref = salfec\|tipopar\|numero`, período desde `salfec`, `line_no` en orden del archivo, `fcobro` → `collect_date`. |
| `cerrado` | `gl_periods` | Un mes queda `closed` solo si todas sus partidas están cerradas; si no, `open` (los mixtos se reportan). |
| `PRESUP` | `gl_budgets` | `pmes1..12` → mes 1..12; solo meses distintos de cero. |
| `SALDOS`, `SALDOCC` | (no se importan) | Solo se usan para la paridad. |

Además se agrega una fila a `core_audit_log` (`legacy-import` / `importar`).

Los registros marcados como borrados en el DBF se omiten y se cuentan (`source.<TABLA>.deleted`).
Texto: `0x03` = cp1252; tablas con otra marca se deciden por contenido (cp1252 o cp850). Los montos se leen como
texto ASCII y se normalizan a dos decimales con decimal.js; nunca pasan por `number`.

## Qué hace con datos sucios

Nunca descarta lo que afecta saldos. Todo queda en el informe.

| Caso | Tratamiento |
|---|---|
| Partida con cargos ≠ abonos | Se importa tal cual con `imported_unbalanced = 1`; aparece en `unbalancedEntries` con la diferencia. |
| Líneas sin encabezado (o con encabezado borrado) | Se crea el encabezado con concepto `(sin encabezado en el sistema anterior)`, fecha = última fecha de línea del mes (o último día); `orphanHeaders`. |
| Cuenta que no está en el catálogo | Cuenta provisional `(cuenta no encontrada en el catálogo anterior)`, tipo según el primer dígito; `placeholders.accounts`. |
| Tipo de partida o centro de costo inexistente | Provisional con nombre `(… no encontrado …)`; tipo vacío se guarda como `??`. |
| Catálogo con padre inexistente, padre de detalle, tipo distinto al padre, nivel incorrecto, ciclos | Se importa tal cual (padre inexistente → raíz); `catalogFindings`. |
| Número de partida vacío, línea con cargo y abono, montos negativos | Se importa tal cual; aviso con conteo. |
| Presupuesto con año inválido, cuenta inexistente o todo en cero | Se omite y se cuenta en `budgets.rowsSkipped` (no afecta saldos). |

## Cómo leer el informe

`import`: `empresa`, `counts` (filas por tabla, incluye provisionales), `source` (registros, vigentes, borrados y
codificación por tabla), `warnings` (por categoría: `count` y hasta 20 mensajes), `unbalancedEntries`,
`orphanHeaders`, `placeholders`, `catalogFindings`, `periods`, `budgets`.

`parity` (por `saldos` y `saldocc`): filas, meses y cuentas comparadas, `fieldMismatches`, `rowsWithMismatch`,
`byField`, `byCause`, `first` (primeras diferencias: período, cuenta, campo, valor legado, valor nuevo, causa) y
`missingInLegacy` (movimiento calculado sin fila en el legado). Si se pasa `limit` a `checkContacParity` se cambia
cuántas diferencias se listan (20 por defecto).

La paridad recalcula, desde las líneas, por mes y cuenta: cargos, abonos, saldo anterior, saldo final y saldo del mes,
con acumulación hacia las cuentas padre y la regla de naturaleza de `business-rules.md` §5; compara al centavo. El
legado es disperso (solo hay fila de las cuentas ya tocadas), por eso solo se comparan filas existentes y aparte se
reporta el movimiento calculado que no tiene fila.

Causas de una diferencia (por fila):
- `carried_from_earlier_month`: el movimiento del mes coincide; el saldo difiere solo por un desfase heredado de un mes anterior.
- `legacy_chain_broken`: el saldo anterior legado no es el saldo del mes previo legado.
- `legacy_row_inconsistent`: la fila legada incumple por sí sola la fórmula del §5.
- `month_without_entries`: el legado muestra movimiento en un mes sin partidas importadas.
- `other`: requiere investigación (aquí: diferencias de movimiento originadas en partidas concretas, ver abajo).

## Resultado con los datos reales (una empresa, solo números)

Registros leídos: idénticos a `vfp.py` en las 9 tablas (CATALOGO 618, PARTIDAS 5,209, DETAPART 48,024,
SALDOS 11,730, SALDOCC 16,884, PRESUP 682, TIPOPAR 10, CCOSTO 5, EMPRESAS 1). Omitidos por borrados:
PARTIDAS 55, DETAPART 715, EMPRESAS 2. Codificación: cp1252 en todas (PERIODO y PRESUP sin marca confiable, decididas por contenido).

Importado: 1 empresa, 619 cuentas (618 + 1 provisional), 5 centros de costo, 11 tipos de partida (10 + 1 provisional
para el tipo vacío), 5,220 partidas (5,209 + 11 encabezados creados), 48,024 líneas, 6 ejercicios, 30 períodos
(todos abiertos), 48 montos de presupuesto. Una partida descuadrada (diferencia de 50.00). Avisos: 71 líneas con
monto negativo, 26 con cargo y abono, 5 avisos de número de partida vacío, 1 cuenta fuera del catálogo, 1 empresa con
moneda `2` asumida USD, PERIODO no confiable. Hallazgos de catálogo: 0. `--replace` verificado sobre la misma base.

Paridad (no es cero; las diferencias nacen en pocos puntos y se arrastran):

| Tabla | Filas | Meses | Cuentas | Filas con diferencia | Causa: arrastre | cadena rota | mes sin partidas | otra |
|---|---|---|---|---|---|---|---|---|
| `SALDOS` | 11,730 | 51 | 495 | 2,444 | 2,381 | 3 | 30 | 30 |
| `SALDOCC` | 16,884 | 50 | 495 | 2,823 | 2,778 | 3 | 8 | 34 |

Movimientos calculados sin fila en el legado: 0 en ambas. Origen de las diferencias (verificado en los datos):

1. **2020-03:** una partida trae dos líneas repetidas (misma cuenta y monto) que explican exactamente el movimiento
   extra y la descuadrada de 50.00; el saldo legado no las cuenta. Ese desfase se arrastra a todos los meses siguientes
   de las cuentas afectadas (la mayoría de las 2,381 filas de arrastre).
2. **2012-12 y 2021-09:** `SALDOS` trae movimiento (22 y 8 filas con movimiento) en meses que no tienen partidas.
   Son saldos huérfanos del legado; no se arrastran a los meses siguientes.
3. **2023-02:** el saldo anterior legado de una cuenta y sus padres no es el saldo final legado de enero (cadena rota
   propia del legado: el cargo de febrero legado es menor justo por el saldo de enero).
4. **2024-02:** una partida cuyas líneas explican las diferencias de cargos y abonos en 7 cuentas (los importes
   coinciden con las líneas); el legado no refleja esa partida por completo (probablemente modificada después del
   último "Posteo del Mes"). La diferencia en una cuenta (3.25) sugiere que el legado sí tiene parte de ella.

Conclusión: el importador no pierde ni duplica líneas (conteos idénticos a la fuente); las diferencias son
inconsistencias del legado (partida con líneas repetidas, saldos huérfanos, tabla de saldos desfasada), no del
importador. Los puntos 3 y 4 son inferencias apoyadas en importes, no una prueba de causa. Falta que el negocio confirme cuál
cifra considera correcta en cada caso.
