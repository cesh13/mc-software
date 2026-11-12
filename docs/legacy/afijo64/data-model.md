# AFIJO64 — Modelo de datos

Estructura, llaves y conteos salen de los `.DBF` reales (`MCERP/AFIJO64/DBF`, `MCERP/AFIJO64/fuente`, y las tablas de CONTAC que el módulo lee y escribe, `MCERP/CONTAC/dbf`) y del catálogo de índices
`ARCHIVOS.DBF` (más las etiquetas de los `.CDX`). Conteos = registros vivos (sin marcados como borrados); entre paréntesis, los marcados como borrados. **No se copió ningún dato de cliente.**
Codificación (marca de página de código del encabezado): `0x03` (cp1252) en `ACTIVO`, `EMPLEADO`, `MOVDEPRE`, `USUARIOS`, `EMPRESAS`, `PPROV*`, `DPROV*`; `0x00` (cp850 según el playbook) en `CCOSTOa`, `CLASIFI`, `ARCHIVOS`.
Los memos viven en `ACTIVO.FPT` y `CCOSTOa.FPT`.

## 1. Tablas legadas

### 1.1 Propias del módulo (`MCERP/AFIJO64/DBF`)

| Tabla | Contenido | Campos clave | Registros |
|---|---|---|---|
| `ACTIVO` | **Ficha del activo** y contadores de depreciación | `CODIGOA` C10 (índice `codigoa`, único de hecho); `DESCRIP` C50; `CCOSTO` C10 → `CCOSTOa`; `CODIGOC` C10 → `CLASIFI`; `PROVEEDOR` C10 → `PROVEDOR` (CONTAC); `EMPLEADO` C10 → `EMPLEADO`; `CCOSTOC` C3 → `CCOSTO` (CONTAC); `FECHACOM` D; `VCOMPRA`, `VDEPRE`, `CUOTADEP`, `CUOTAANU` N12.2; `VRESIDUAL` **N2**; `NANOS` N12.2; `NCUOTAS` N12; `PORCEN` N5.2; `ACTIVOD` N10; `CTAACTIVO`, `CTADEPRE`, `CTAGASTO`, `CTAPERAF` C14 → `CATALOGO`; contadores `VACUMULA`, `DEANTACUM`, `SALDODEPRE` N12.2 y `NCUOTADE` N10; `DEPRE` L; `MODELO`, `SERIE` C40; `GARANTIA` C35; `OBSERVACIO` memo | **143** (1,420 borrados, 1,372 en blanco) |
| `MOVDEPRE` | **Línea de depreciación** (una por activo y mes) | `CODIGOA` C10; `SALFEC` C6 (AAAAMM); `VALORDEP` N12.2; `TIPOPAR` C2 + `NUMERO` C7 (la partida); `FECHAD` D (fecha de la partida); `CONCEPTO` C100; `CTACARGO`, `CTAABONO` C16; `NCUOTA` N10; `FECHAE` D; `USUARIOE` C10; `CCOSTO` C3; `ACTIVOA` C10 (siempre vacío). Índices: `salfec` = `SALFEC+ACTIVOA` y `codigoa` = `CODIGOA+SALFEC` | **1,623** (239 borrados) — 14 meses, 202201 a 202302 |
| `CLASIFI` | Clasificación del activo | `CODIGO` C10 (índice `codigo`), `NOMBRE` C70 | 23 (46) |
| `CCOSTOa` | "Centro de costo" del módulo (área/ubicación) | `CCOSTO` C10 (índice `ccosto`), `NOMBRE` C70, `OBSERVA` memo | 8 (11) |
| `EMPLEADO` | Responsables | `EMPLEADO` C10 (índice `empleado`), `NOMBRE` C50, `DIRECCION` C100, `TELEFONO` C25, `OBSERVA` C150 | 30 (2) |
| `EMPRESP` | Vacía, estructura `CODIGO` C14 + `NOMBRE` C60 | — | 0 |
| `PPROVB06/B25`, `DPROVB06/B25` | **Tablas de trabajo** de la partida de cada usuario (`pprov<usr>`/`dprov<usr>`): encabezado igual a `PARTIDAS` y detalle igual a `DETAPART` | — | 1 y 280/274; restos de la última corrida de cada usuario. **No se migran** |
| `*.BAK`, `ACTIVO.TBK`, `MESACT.B06/B25/B26`, `BB25.MEM`, `XX.FRX/FRT`, `XX2.FRX`, `arregla.*`, `dbf.rar` | Respaldos, sesión por usuario, reportes de prueba, script de reparación | — | ignorar (`DBF.rar`, 75 KB, no se abrió). `ACTIVO.BAK` es una versión **anterior de la estructura (sin `NCUOTADE`)** con 3 filas; `movdepre.BAK` son 168 filas, todas borradas |

### 1.2 Del sistema (`MCERP/AFIJO64/fuente`)

| Tabla | Contenido | Registros |
|---|---|---|
| `EMPRESAS` | `EMPRESA`, `SIGLAS`, `CAMINO` (datos del módulo), `INTEGRA` (inventario), `CONTA` (contabilidad), `NUMEMPRE`, `CONSOLIDA`, `CONSO` | 1 |
| `USUARIOS`, `PERFIL` | Usuarios (`USRLVL`, `USRTYPE`) y permisos por pantalla (`PROGRAMA`) | 4 (20) y 11 (una fila por pantalla del módulo) |
| `ARCHIVOS` | Catálogo de índices (`activo`, `ccostoa`, `clasifi`, `empleado`, `movdepre` ×2) | 6 (3) |
| `MSGERR`, `ERROR`, `FOXUSER`, `ADEPRE` (3), `DETA` (30), `LOT` (1), `FORMU` (1), `DTEMPB06` (0) | Mensajes, bitácora de errores del sistema y **tablas temporales con datos reales** | **no se migran** |

### 1.3 Archivos `.MEM` (nombres, no valores)

| Archivo | Contenido |
|---|---|
| `BANCOCFG.MEM` | Configuración heredada de Bancos. El módulo solo lee **`CFG_CONTA`** (activa la captura y validación de las cuentas contables del activo) y `CFG_CONFIR`, `CFG_DIGCOM` (ancho del número de partida). **La pantalla que la cambia (`confcta`) no está en el proyecto.** El resto (`CFG_IVA`, `CFG_PROVE`...) no lo usa |
| `MESACT.<usuario>`, `BB??.MEM`, `MESES.MEM` (nombres de los meses `MP`), `EMPRESA.MEM`, `DRIVE.MEM`, `B??.MEM`, `0??.MEM` (filtro de empresas `BUS`) | Mes de trabajo por usuario y sesión: no se migran |
| `MOVI.MEM` | Heredado de otro módulo; el módulo no lo usa |

### 1.4 De otros módulos (lectura y **escritura** desde activo fijo)

Todas en `MCERP/CONTAC/dbf` (el `SET PATH` las encuentra después de las propias).

| Tabla | Para qué la usa el módulo | Registros en disco (copia de CONTAC) |
|---|---|---|
| `PROVEDOR` | Proveedor del activo (solo lectura; 128 de 128 códigos usados existen) | 73 |
| `CATALOGO` | Valida las cuentas del activo (existe y es de detalle); `ANTERIOR` y `TIPOCTA` para actualizar saldos | ver [contac](../contac/data-model.md) |
| `CCOSTO` | Centro de costo contable del activo (`CCOSTOC`; 5 de 5 códigos usados existen) | 5 |
| `TIPOPAR` | Tipo de partida de la corrida | 10 |
| `PARTIDAS`, `DETAPART` | **Escribe** la partida de depreciación (las 14 existen) | 5,209 (55) y 48,024 (715) |
| `SALDOS` | **Escribe** (suma cargos y abonos por cuenta y padres) | ver contac |
| `PERIODO` | No se abre | 1 |

Tablas de CONTAC que el spec de activo fijo no necesita: ninguna otra. **`INV64` no se usa** (la ruta `INTEGRA` apunta a inventario, pero ningún programa del módulo abre sus tablas; solo sobran `posteo`/`posmov`).

## 2. Relaciones

```
CLASIFI (CODIGO) ─< ACTIVO (CODIGOC)
CCOSTOa (CCOSTO) ─< ACTIVO (CCOSTO)                        área / ubicación
EMPLEADO (EMPLEADO) ─< ACTIVO (EMPLEADO)                   responsable (opcional)
PROVEDOR (CONTAC) ─< ACTIVO (PROVEEDOR)                    opcional
CCOSTO (CONTAC) ─< ACTIVO (CCOSTOC)  ·  MOVDEPRE (CCOSTO)  centro de costo contable
CATALOGO (CONTAC) ─< ACTIVO (CTAACTIVO, CTADEPRE, CTAGASTO, CTAPERAF)
ACTIVO (CODIGOA) ─< MOVDEPRE (CODIGOA)                     una línea por activo y mes (salfec)
MOVDEPRE (SALFEC+TIPOPAR+NUMERO) ·· PARTIDAS/DETAPART      llave natural; sin llave foránea
MOVDEPRE (CTACARGO, CTAABONO) → CATALOGO                   cuentas congeladas por línea
```

Ninguna relación está declarada en la base: las hace el código con `SET RELATION` y `SEEK`; **integridad solo por convención** (§ business-rules 3.2).
`MOVDEPRE` y `ACTIVO` no comparten llave con `PARTIDAS` más que `SALFEC + TIPOPAR + NUMERO`.

## 3. Modelo propuesto en la plataforma nueva (prefijo `fa_`)

Todas las tablas llevan `empresa_id`, `is_active`, `created_at`, `updated_at`; dinero como `TEXT` decimal con 2 decimales; fechas `AAAA-MM-DD`; períodos `AAAA-MM`; sin borrado físico.
Módulo `fixed-assets` (`dependsOn: general-ledger`, y por transitividad `chart-of-accounts`).

### 3.1 Tablas

| Tabla | Columnas (origen legado) | Llaves y notas |
|---|---|---|
| `fa_settings` | `empresa_id`; `entry_type_id` (→ `gl_entry_types`; hoy se teclea cada mes); `post_mode` (`por_activo` como el legado / `agrupada`); `block_gaps` (impedir corrida si falta un mes anterior); `gain_account_id`, `loss_account_id` (para bajas; **nuevo**) | 1 fila por empresa |
| `fa_categories` | `id`; `code` (`CLASIFI.CODIGO`); `name` (`NOMBRE`); **nuevos, opcionales:** `asset_account_id`, `accum_account_id`, `expense_account_id`, `loss_account_id`, `default_life_months` | único `(empresa_id, code)` |
| `fa_locations` | `id`; `code` (`CCOSTOa.CCOSTO`); `name` (`NOMBRE`); `notes` (`OBSERVA`, rotulado "Dirección") | único `(empresa_id, code)`. **No** son centros de costo del libro mayor |
| `fa_custodians` | `id`; `code` (`EMPLEADO`); `name`; `address`; `phone`; `notes`; `employee_id` (nuevo, nulo; enlace futuro con `payroll`) | único `(empresa_id, code)` |
| `fa_assets` | `id`; `code` (`CODIGOA`, hasta 10); `name` (`DESCRIP`); `category_id` (`CODIGOC`); `location_id` (`CCOSTO`); `cost_center_id` (`CCOSTOC` → `gl_cost_centers`); `custodian_id` (`EMPLEADO`); `supplier_ref` (`PROVEEDOR`, texto hasta que `accounts-payable` defina proveedores); `model`; `serial`; `warranty` (texto, `GARANTIA`); `notes` (`OBSERVACIO`); `acquisition_date` (`FECHACOM`); `in_service_date` (nuevo, por omisión = `acquisition_date`; hoy no existe); `acquisition_cost` (`VCOMPRA`); `salvage_value` (**calculado al importar** como `VCOMPRA − VDEPRE`, no de `VRESIDUAL`); `useful_life_months` (`NANOS × 12` = `NCUOTAS`); `is_depreciable` (`ACTIVOD` ≠ 2); `method` (`linea_recta`, único valor por ahora); `asset_account_id` (`CTAACTIVO`), `accum_account_id` (`CTADEPRE`), `expense_account_id` (`CTAGASTO`), `loss_account_id` (`CTAPERAF`); `opening_accumulated` y `opening_period` (nuevo, 0 por omisión; saldo inicial si el negocio lo acuerda, pregunta 5); `status` (`vigente`, `dado_de_baja`; `totalmente depreciado` se **deriva**, no se guarda); `legacy_code` | único `(empresa_id, code)`. **No se guardan** `VDEPRE`, `CUOTADEP`, `CUOTAANU`, `NCUOTAS`, `PORCEN`, `VACUMULA`, `DEANTACUM`, `SALDODEPRE`, `NCUOTADE`, `DEPRE`: se calculan. No se migran `FACTURA`, `DPREANUAL`, `VACTUAL`, `TDEPRE`, `DEPREACUM` (siempre vacíos) |
| `fa_depreciation_runs` | `id`; `period` (`SALFEC`); `date` (`FECHAD`); `entry_type_id` (`TIPOPAR`); `status` (`vigente` / `anulada`); `gl_entry_id` (**enlace real** a `gl_journal_entries`; `source = 'activo_fijo'`, `source_ref = run.id`); `total`; `line_count`; `created_by` (`USUARIOE`), `created_at` (`FECHAE`); `voided_by`, `voided_at`, `void_reason`; `legacy_key` (`SALFEC+TIPOPAR+NUMERO`) | **único** `(empresa_id, period)` donde `status = 'vigente'` |
| `fa_depreciation_lines` | `id`; `run_id`; `asset_id`; `amount` (`VALORDEP`); `installment_no` (se **calcula** al importar: orden de la línea por activo; `NCUOTA` viene en 0); `expense_account_id` (`CTACARGO`), `accum_account_id` (`CTAABONO`), `cost_center_id` (`CCOSTO`) — **congelados** en la línea | único `(run_id, asset_id)`; índice `(asset_id)` |
| `fa_disposals` (**nueva función**, sin equivalente) | `id`; `asset_id`; `date`; `kind` (`baja`/`venta`/`siniestro`); `proceeds`; `accumulated_at_date` y `book_value_at_date` (congelados al grabar); `gain_loss`; `gl_entry_id`; `status` | un solo `vigente` por activo. Se diseña cuando el negocio decida (pregunta 14) |

### 3.2 Reglas de datos

- **Acumulado y valor en libros** = vistas/consultas, no columnas: `acumulado(activo, hasta) = opening_accumulated + SUM(amount)` de líneas de corridas vigentes con período ≤ `hasta`;
  `valor en libros = acquisition_cost − acumulado`. Es exactamente lo que hace el reporte legado "Cuadro de Activo Fijo", no lo que guarda `ACTIVO.VACUMULA`.
- **Cuota** = `round2((acquisition_cost − salvage_value) / useful_life_months)`; última cuota = saldo. **Entran en la corrida** de un período los activos vigentes, depreciables, con `acquisition_date <= fin de mes` y saldo > 0 (misma regla que el legado,
  salvo que se respeta `is_depreciable`).
- Una corrida y su partida se crean y se anulan **en la misma transacción**; la partida pasa por el contrato del libro mayor, no por escritura directa en tablas ajenas.
- Las líneas de la partida llevan `source = 'activo_fijo'`; el libro mayor no permite editarlas a mano (solo anular desde el módulo). El legado dejaba `GENERADO = 0` y se podían editar.

### 3.3 Cambios al scaffold existente (`modules/fixed-assets`)

| Hoy (`schema.ts`) | Cambio |
|---|---|
| `faAssets` sin `empresa_id`, sin código, sin `updated_at` | Añadir `empresa_id` (FK a `core_empresas` vía `refs.ts`), `code`, `updated_at`; único `(empresa_id, code)` |
| `account_id` (una sola cuenta) | Reemplazar por cuatro cuentas (`asset_account_id`, `accum_account_id`, `expense_account_id`, `loss_account_id`); FK a `coa_accounts` vía `refs.ts` |
| `useful_life_years` entero | `useful_life_months` entero (el legado guarda años × 12) |
| `purchase_date` / `purchase_cost` / `salvage_value` | Renombrar a `acquisition_date` / `acquisition_cost` (opcional) y añadir `in_service_date` |
| `depreciation_method` texto libre `'straight-line'` | Enumeración (`linea_recta`) |
| `name`, `description` | Conservar; `description` pasa a `notes` |
| (falta) | `category_id`, `location_id`, `cost_center_id`, `custodian_id`, `supplier_ref`, `model`, `serial`, `warranty`, `is_depreciable`, `status`, `opening_accumulated` |
| (faltan) | `fa_categories`, `fa_locations`, `fa_custodians`, `fa_settings`, `fa_depreciation_runs`, `fa_depreciation_lines` (y `fa_disposals` en una segunda fase) |
| `manifest.ts`: `permissions` solo `read`/`write`/`delete`; navegación de un solo ítem | Alinear con los permisos de la plataforma (`capture`, `reports`, `supervise`): `capture` para activos y catálogos, `supervise` para la corrida mensual y la anulación, `reports` para los reportes; navegación: Activos, Catálogos, Depreciación, Reportes |
| `routes.ts`, `pages/index` | Rutas: catálogos, activos, `POST /depreciation/preview`, `POST /depreciation/runs`, `POST /depreciation/runs/:id/void`, reportes |

Contrato nuevo en `@accounting/shared`: `gl.postEntry` con `source: 'activo_fijo'` y `sourceRef` (hoy `GL_ENTRY_SOURCES` solo admite `manual`, `bancos`, `iva`, `cierre`, `importado`; la columna `source_ref` ya existe en `gl_journal_entries`).

## 4. Notas de migración

### 4.1 Mapa de importación

| Origen | Destino | Notas |
|---|---|---|
| `CLASIFI` (23) | `fa_categories` | `legacy_code = CODIGO`; sin cuentas (se pueden deducir de las más usadas por categoría, para revisar con el contador) |
| `CCOSTOa` (8) | `fa_locations` | Memo `OBSERVA` (cp850 por marca de página `0x00`, memo en `.FPT`) |
| `EMPLEADO` (30) | `fa_custodians` | cp1252 |
| `ACTIVO` (143) | `fa_assets` | Tabla de decisiones abajo |
| `MOVDEPRE` (1,623) | `fa_depreciation_runs` (14) y `fa_depreciation_lines` | Agrupar por `SALFEC + TIPOPAR + NUMERO`; `gl_entry_id` = partida importada de CONTAC con la misma llave natural (el importador de CONTAC debe conservar esa llave en `legacy_key` o en una tabla de mapeo) |
| `PARTIDAS`/`DETAPART` de las 14 partidas | ya vienen del importador de CONTAC | Marcarlas `source = 'activo_fijo'` (hoy llegan como `importado`) y `source_ref` = corrida |

### 4.2 Decisiones por campo de `ACTIVO`

- **Residual:** no usar `VRESIDUAL` (N2, 1 desbordado `**`). `salvage_value = VCOMPRA − VDEPRE`. Verificar que `round2(VDEPRE / NCUOTAS) = CUOTADEP` (cuadra en 142 de 143; el que no cuadra es el del residual desbordado: usar su `CUOTADEP` y deducir el residual).
- **Acumulado y contadores:** no migrar; recalcular desde `MOVDEPRE`. **141 de 143 activos tienen `VACUMULA` distinto de la suma de sus líneas** (ver business-rules §6.2); por tanto, el valor en libros "según la ficha" no es una referencia de paridad.
- **`ACTIVOD`:** 129 con 1 (depreciable), 13 con 2 (no depreciable), 1 con 0. Importar `is_depreciable = (ACTIVOD ≠ 2)`. **Cuidado:** 11 de los 13 con 2 ya tienen líneas de depreciación; si se respeta el tipo, esos activos dejarían de depreciar desde la primera corrida nueva (pregunta 9).
- **`PORCEN`:** informativo; no migrar (se calcula `100 / años`).
- **Vida útil:** `NANOS` está en años con 2 decimales (todos enteros en datos); `useful_life_months = NANOS × 12`.
- **Códigos:** `CODIGOA` C10 con forma `AAAAAA999` en 139 de 143; comparar sin distinguir mayúsculas y recortando espacios (el `Format: K!` solo pone el nombre en mayúsculas).
- **Responsable y proveedor:** 105 y 128 llenos, todos válidos; `PROVEEDOR` se guarda como texto hasta que exista el maestro de proveedores de `accounts-payable` (en CONTAC es `PROVEDOR`, 73 filas).
- **Cuentas:** todas existen en el catálogo importado y son de detalle; mapear por código de cuenta al `coa_accounts` importado (error si falta).
- **Dos centros de costo:** `CCOSTO` (área) → `location_id`; `CCOSTOC` (contable) → `cost_center_id` por código en `gl_cost_centers`.

### 4.3 Datos sucios y ruido

- Filas borradas: `ACTIVO` 1,420 (1,372 en blanco + 48 con código, 2 de ellos vuelven a existir vivos), `MOVDEPRE` 239 (copia exacta de 202201–202203), `CLASIFI` 46, `CCOSTOa` 11, `USUARIOS` 20. El lector de `vfp.py` ya omite las marcadas; confirmar que el importador de producción también.
- `MOVDEPRE.ACTIVOA` siempre vacío; `NCUOTA` siempre 0; `TIPOMOV` de las líneas de abono de la partida = 1 (debería ser 2): el importador de CONTAC usa las columnas de cargo/abono, no `TIPOMOV`.
- Numeración: `NUMERO` C7 con ancho de 6 dígitos efectivos (`000038`), único por `(SALFEC, TIPOPAR)`; no es único global.
- `FECHAD` = fecha de la partida (fin de mes en las 14); `FECHAE` es la fecha real de ejecución (2022-01 a 2022-09 se ejecutaron meses después).
- Dos activos (2023-10) no tienen líneas: normal, son posteriores a la última corrida.
- **Partidas de 2023-01 y 2023-02 en CONTAC duplican el total de la corrida** (+ unas 15 líneas manuales cada una): no importar a ciegas como `activo_fijo`; marcar para revisión (pregunta 21).

### 4.4 Comprobaciones de paridad

1. **Conteos:** 143 activos, 1,623 líneas, 14 corridas, 14 partidas.
2. **Depreciación acumulada por activo** a cada fin de mes = suma de líneas hasta ese mes (la del reporte "Cuadro de Activo Fijo" del sistema viejo, no `VACUMULA`). Comprobar también que la suma de `VACUMULA` de todos los activos = suma de todas las líneas (en disco coincide al centavo, aunque está mal repartida: sirve de control de totales).
3. **Valor en libros por activo y por grupo** (categoría, área, cuenta de activo) a una fecha = `VCOMPRA − acumulado`; comparar con el reporte legado generado con la misma fecha y el mismo tipo de activo (cuidado con su filtro "Todos los Activos", business-rules §8).
4. **Totales mensuales:** suma de `VALORDEP` por mes = cargos de la partida del mes en CONTAC = abonos (se cumple en 12 de 14; los dos meses restantes son la excepción documentada).
5. **Por cuenta:** suma de cargos por cuenta de gasto de las líneas = movimiento en el libro mayor importado de esas partidas; ídem con la cuenta de depreciación acumulada.
6. **Cuota:** `round2((costo − residual) / meses)` = `CUOTADEP` y = `VALORDEP` de cada línea (hoy se cumple en las 1,623 líneas).
7. **Activos que debieron terminar** (ninguno hoy) y el activo que dejó de depreciar por el acumulado corrupto: informe de excepciones para el contador, no un error de la migración.
