# LOTE64 — Modelo de datos

Estructura, llaves y conteos salen de los `.DBF` reales (`MCERP/LOTE64/DBF`, `MCERP/LOTE64/FUENTE`, y las tablas de inventario de `MCERP/INV64/DBF` que la producción lee y escribe) y del catálogo
de índices `ARCHIVOS.DBF`. Conteos = registros vivos (sin marcados como borrados); entre paréntesis, los marcados como borrados. **No se copió ningún dato de cliente ni ninguna fórmula.**
Codificación: la marca de página de código del encabezado es `0x03` (cp1252) en `LOTE`, `DETALOTE`, `FORMULA`, `DETAFORM`, `DESPACHO`, `DETADESP`, `LACTIVI`, `LINDI`, `LMAQUINA`, `MOBRA`, `LABMAQUI`, y `0x00`
(cp850 según el playbook) en `CFINDI`, `ESTATUS`, `FORMULA2` y `DETAFOR2`.

## 1. Tablas legadas

### 1.1 Propias del módulo (`MCERP/LOTE64/DBF`)

| Tabla | Contenido | Campos clave | Registros |
|---|---|---|---|
| `LOTE` | **Orden de producción** (encabezado + costos congelados) | `LOTE` C7 (índice `LOTE` = `LOTE+CODIG_PROD`; `SALFEC`; `dtoc(FECHAF,1)+LOTE`; `CODIG_PROD`); `CODIG_PROD` C16; `LINEA` N3; `CANTIDAD` N14.2, `CANTIDADPR` N12.2; `MOD` N10.5, `MODM` N12.5, `CI` N5.2; `HORAS`; `FECHAP`, `FECHAF` D; `BODEGA` N5; `STATUS` C3; `PROCESADO`, `ANULADO` L; `LOTE2` C12, `FVENCE2` D; `ORDENC` C10; `CODIGOM` C3; `RESPONSAB` C35, `TURNO` C40, `OBSERVA` C40; `CMP`, `CME`, `CMOD`, `CMODM`, `CIND`, `VINETA` (costos); `ENTREGASP`; 11 campos `P*` de desperdicio; `FFARMA`, `PRESENTA` | **22,643** (17,442) |
| `DETALOTE` | **Líneas de insumos** de la orden | `LOTE` C7 + `CODIG_PROD` C16 + `CODIG_MATE` C16 (índice `LOTE`); `CANTIDADP` N13.5 (a consumir), `CANTIDADO` N12.5, `PUNIT` N12.5 (costo congelado); `MP`, `MG` L; `BODEGA` N5; `LOTEIN` C10, `LOTEPRO` C20, `PROVEEDOR` C10, `FEFABRICA`, `FEVENCE` D; `ADICION`, `DEVOL` N12.5 (sin uso) | **98,857** (105,870) |
| `FORMULA` | **Fórmula**: encabezado | `PRODUCTOF` C16 (índice `PRODUCTOF`; **no es único en los datos**); `MBASE` N10.2, `PROGRAMA` N14.2, `MOD` N12.5, `IND` N5.2; `LINEA` N3; `FFARMA`, `PRESENTA`, `GRANEL`, `NDIASP`, `OBSERVA1-4`, `COMENTARIO` (memo en `FORMULA.FPT`) | **377** (37); 282 productos distintos |
| `DETAFORM` | **Líneas de la fórmula** | `PRODUCTOF` + `PRODUCTO` C16; `CANTIDAD` N13.5; `MP`, `ME`, `MG` L | **1,777** (332) |
| `FORMULA2`, `DETAFOR2` | "Fórmula maestra": misma estructura que `FORMULA`/`DETAFORM`; ninguna otra pantalla las lee | — | 12 (3) y 166 (3) |
| `CFINDI` | Tarifa mensual de indirectos y mano de obra | `MES` N2 + `YEAR` C4 (índice `MES`); `INDI` N12.2 (%), `OBRA` N12.4 | 58 (23); solo 2013–2017 |
| `ESTATUS` | Estatus de la orden | `CODIGOS` C3, `ESTATUS` C50 | 6 (4) |
| `LACTIVI` | Actividades de producción (sin uso) | `CACTIVI` C5, `DESCRIPA` C50, `CPHORA` N12.2 | 3 (5) |
| `LINDI` | Indirectos (sin uso) | `CINDI` C5, `DESCRIPI`, `CPHORA` | 2 |
| `LMAQUINA` | Maquinaria (sin uso) | `CODMA` C5, `DESCRIPMA`, `MODELO`, `CPHORA` | 2 |
| `MOBRA` | Mano de obra (sin uso) | `CODEMP` C5, `NOMBREE` C50, `CPHORA` | 2 |
| `LABMAQUI` | Maquiladores | `CODIGO` C3, `NOMBRE` C100, `CONTACTO` C100, `BODEGA` N5 | 1 |
| `DESPACHO`, `DETADESP` | Vale de envío de órdenes a bodega | `NRUTA` C6 (índice `NRUTA`), `LOTE` C6, `FRUTA` D | 1 y 1 |
| `PPROVB06/22/31/23/24`, `DPROVB06/22/31/23/24` | Tablas de trabajo de partidas copiadas de BANCOC (mismos campos que `PARTIDAS`/`DETAPART`) | — | 1 y 6–7 c/u. **No se migran** |
| `*.BAK` (`lote.BAK` 15 MB, `DETALOTE.BAK` 1 MB, `FORMULA.BAK`, `DETAFORM.BAK`, `CFINDI.BAK`, `formula.TBK`), `RESPAL/` (copias de `LOTE`, `DETALOTE`, `FORMULA`, `DETAFORM`, `DESPACHO`, `DETADESP`, `DBFBK.ZIP` con `*.MDF`), `pp/`, `DBF.rar` | Respaldos | — | ignorar (`DBF.rar` no se abrió) |

### 1.2 Del sistema (`MCERP/LOTE64/FUENTE`)

| Tabla | Contenido | Registros |
|---|---|---|
| `EMPRESAS` | `EMPRESA`, `SIGLAS`, `CAMINO` (producción), `INTEGRA` (inventario), `CONTA` (contabilidad), `NUMEMPRE`, `CONSOLIDA`, **`CVINETA`** (costo de viñeta) | 1 |
| `USUARIOS`, `PERFIL` | Usuarios (`USRLVL`, `USRTYPE`, `VE_COSTO`) y permisos por pantalla (`PROGRAMA`) | 3 (16), 89 (16) — 32 pantallas, 4 usuarios |
| `ARCHIVOS` | Catálogo de índices (`lote`, `detalote`, `formula`, `detaform`, `despacho`, `detadesp`) | 9 |
| `MSGERR`, `ERROR`, `FOXUSER`, `PROCE` (503), `DETALLE2` (2,232), `DETALLES` (3,197), `LOT` (3), `DETA` (30) | Mensajes, bitácora de errores del sistema y **tablas temporales de reportes con datos reales** | **no se migran** |

### 1.3 Archivos `.MEM`

| Archivo | Contenido (nombres, no valores) |
|---|---|
| `MOVI.MEM` (en `FUENTE`) | `NFA` (concepto de entrada de producto terminado), `NDE` (concepto de salida de insumos) |
| `CUENTAS.MEM` (por empresa, en `dbf`) | `CFG_MOBR`, `CFG_INDI`, `CFG_MAQU`, `CFG_ETIQ` (cuentas de absorción), `CFG_CONTA` (validar contra catálogo), más variables heredadas de Bancos (`CFG_IVA`, `CFG_PROVE`, …) que producción no usa |
| `MESACT.<usuario>`, `BB??.MEM`, `MESES.MEM`, `EMPRESA.MEM`, `DRIVE.MEM` | Mes de trabajo por usuario y sesiones: no se migran |

### 1.4 De otros módulos (lectura y **escritura** desde producción)

Todas en `MCERP/INV64/DBF`, salvo `PARTIDAS`/`DETAPART`/`SALDOS`/`CATALOGO`/`TIPOPAR`/`PROVEDOR` (CONTAC).

| Tabla | Para qué la usa producción | Registros en disco |
|---|---|---|
| `ARTICULO` | Producto/insumo: `MODELO`, `DESCRIP`, `UNIDAD`, `GRUPO` (= línea), `SUBGRUPO`, `COSTO_PROM`, `CPROMANT`, `PVINETA`, `VENCE`, `EXIST_ACT`, `BODEGA1..15`, `CTA` (cuenta de inventario) | 645 (**otro cliente**: 0 coincidencias con las fórmulas) |
| `BODEGAS` | Bodegas (`BODEGA`, `N_CORTO`, `DESCRIPC`) | 4 (1 a 4) |
| `MOVIMIEN` | Kárdex: la producción **agrega** salidas/entradas | 174,562 (38); sin conceptos de producción; **sin campo `LOTEPADRE`** |
| `DATAMOV` | Encabezado del documento de inventario | 57,597 (24) |
| `BODMES` | Existencias y costo por mes y bodega: la producción **actualiza** | 55,778 (2,759) |
| `MESES` | Existencias y costo por mes y artículo: **actualiza** | 47,248 |
| `SALDOLO`, `VENCE2` | Existencias por lote de vencimiento: **actualiza** | 280,103 (17,536) y 3,969 |
| `CIERRE` | Meses cerrados (solo `posteo` lo consulta) | 164 |
| `TABLA` | Líneas/grupos de producto (`GRUPO`, `NOMBRE_GPO`) | 153 |
| `PEDI`, `DPEDI` | Órdenes de compra (maquila): `DPEDI.RECIBIDO` **se actualiza** | 3 (2) y 3 |
| `DESALIDA` | Se abre en `lpmlote` pero **no se usa** | — |
| `PARTIDAS`, `DETAPART`, `SALDOS`, `CATALOGO`, `TIPOPAR` (CONTAC) | "Generar Partida Contable" escribe partidas y saldos | ver [contac](../contac/data-model.md) |
| `PROVEDOR` (CONTAC) | Proveedor del reporte de maquila | 73 |

**Tablas que el código usa y NO existen en disco:** `ENTREGAP` (entregas parciales), campo `MOVIMIEN.LOTEPADRE` y alias `entradap`; campos `LOTE.TRANSF`/`TRANS`, `DETALOTE.NLOTE`, variable `m.cvine` (viene de `EMPRESAS.CVINETA`) [D][V].

## 2. Contrato de escritura a inventario (para unir con el spec de INV64)

Lo que **"Procesar"**, **"Anular"**, **"Transferir"** y **"Entregas parciales"** escriben. `INV64` debe confirmar si estas columnas son la fuente de verdad o derivados del kárdex.

| Tabla.campo | Procesar (consumo) | Procesar (producto terminado) | Anular (revierte) | Transferir (`PP`) | Entrega parcial (`ET`/`SP`) |
|---|---|---|---|---|---|
| `MOVIMIEN` (fila nueva) | S, concepto `NDE`/`PR`, `NFACT_ENV` = lote, costo promedio, `LOTE` = `LOTEIN` | E, concepto `NFA`/`EP`, costo = (totge+viñeta)/cantidad, `LOTE`=`LOTE2`, `ORDENC` | **borra** ambas filas | S y E, concepto `PP` | E `ET` (costo actual) / S `SP` (costo unitario de la orden), `LOTEPADRE` |
| `DATAMOV` (fila nueva) | S/PR | E/EP | **borra** | S/PP y E/PP | E/ET, S/SP |
| `BODMES.SALIDAS`/`COSTOS` | `+=` | — | `-=` | `+=` (origen) | `SP`: `+=` |
| `BODMES.ENTRADAS`/`COSTOE` | — | `+=` | `-=` | `+=` (destino) | `ET`: `+=` |
| `BODMES.FINAL`/`COSTOF` | recalculados | recalculados | recalculados | recalculados | recalculados |
| `ARTICULO.BODEGAn` | `-=` | `+=` | inverso | origen `-=`, destino `+=` | `+=` (`ET`) / `-=` (`SP`) |
| `ARTICULO.EXIST_ACT` | `-=` | `+=` | inverso | **no cambia** | `+=` / `-=` |
| `ARTICULO.COSTO_PROM` | no cambia | **`= BODMES.COSTOF / BODMES.FINAL`** (5 dec.) | recalcula si `COSTOF > 0` | no cambia | no cambia |
| `ARTICULO.CPROMANT` | no cambia | `= COSTO_PROM` anterior | no restaura | — | — |
| `MESES.SALIDAS`/`COSTOS`/`ENTRADAS`/`COSTOE`/`FIN`/`COSTOF`/`COSTO_PROM` | salidas | entradas y `COSTO_PROM = COSTOF/FIN` | inverso | ambas | ambas |
| `VENCE2.FIN`, `SALDOLO.SALIDA`/`ENTRADA`/`FIN` | solo si hay `LOTEIN` | **siempre** (lote en blanco si no hay `LOTE2`) | inverso | si hay lote | si hay `LOTE2` |
| `DPEDI.RECIBIDO` | — | `+= cantidad` si hay `ORDENC` | `-=` | — | — |

Llaves de los índices usados (`USE … ORDER TAG`): `MOVIMIEN` `borra`, `borra2`, `relote`, `lotepadre`, `borra`; `DATAMOV` `numero`, `compra`; `BODMES`/`MESES`/`SALDOLO` `salfec`/`modelo`; `VENCE2` `vence`, `lote2`, `lotein`; búsquedas por `tipo_mov + concepto + nfact_env + modelo (+ lote)`.
Los **conceptos `PR`, `EP`, `ET`, `SP`, `PP`** deben existir en `CONCEPTO` del cliente (no están en la copia).

## 3. Relaciones

```
ARTICULO (INV) ─┬─< FORMULA (PRODUCTOF)  ─< DETAFORM (PRODUCTO → ARTICULO)
                ├─< LOTE (CODIG_PROD) ─< DETALOTE (CODIG_MATE → ARTICULO, BODEGA → BODEGAS)
                │        │-- STATUS → ESTATUS, CODIGOM → LABMAQUI, ORDENC → PEDI/DPEDI
                │        │-- fechaf → CIERRE (solo recalcular)
                │        └── MOVIMIEN/DATAMOV por NFACT_ENV = LOTE, CONCEPTO PR / EP / ET / SP / PP
DESPACHO (NRUTA) ─< DETADESP (LOTE[6])      (sin relación a inventario ni a CxC)
CFINDI (MES+YEAR) → LOTE (por FECHAF) y FORMULA (procesos de §14)
ARTICULO.CTA, CUENTAS.MEM → PARTIDAS/DETAPART (partida de costos, sin vínculo a LOTE)
```

**Compartidas:** con **inventario** (`ARTICULO`, `BODEGAS`, `MOVIMIEN`, `DATAMOV`, `BODMES`, `MESES`, `SALDOLO`, `VENCE2`, `CIERRE`, `TABLA`, `DPEDI`/`PEDI`); con **CONTAC** (partidas, saldos, catálogo, tipos de partida; el proveedor del reporte de maquila);
con **CxP/Bancos** (la orden de compra de maquila `ORDENC` apunta al módulo de compras de `INV64`); con **CxC**: **ninguna** (el "despacho" de LOTE64 no es el de reparto de CxC, aunque comparte nombre y estructura).

## 4. Modelo propuesto en la plataforma nueva

### 4.1 ¿Módulo propio o parte de `inventory`?

**Módulo propio `production`** (prefijo `prod_`), dependiente de `inventory` y del libro mayor. Razones:
1. **Solo lo usan algunos clientes** (los que fabrican o empacan; en disco el otro cliente de inventario no tiene un solo movimiento de producción): debe poder activarse por cliente (`alwaysOn: false`).
2. Entidades propias (fórmulas, órdenes, costos de proceso, tarifas) que no pertenecen al kárdex.
3. La regla de oro de `docs/module-guide.md`: los módulos no se importan entre sí ni escriben en tablas ajenas. Hoy la producción escribe nueve tablas de inventario; en la plataforma nueva debe pedírselo a `inventory` por un **contrato**.
4. Mantiene el spec y la construcción de INV64 (el módulo más grande) desacoplados.

**Contratos que hay que crear en `@accounting/shared`** (a diseñar con el spec de INV64):
- `inventory.postMovements({ empresaId, source: 'produccion', sourceRef, date, lines: [...] })`: salidas (artículo, bodega, cantidad, lote opcional) valuadas por `inventory` (que devuelve costo unitario y total) y entradas con **costo total provisto** (producto terminado, lote y vencimiento opcionales). Operación atómica; devuelve los ids de movimiento y es
  reversible por `sourceRef` (movimientos inversos).
- `gl.postEntry({ source: 'produccion', sourceRef, ... })`: hoy `GL_ENTRY_SOURCES` solo admite `manual`, `bancos`, `iva`, `cierre`, `importado`; hay que añadir `produccion` (y decidir con INV64 quién contabiliza el costo de existencias).

### 4.2 Tablas (todas con `empresa_id`, `is_active`, `created_at`, `updated_at`; dinero y cantidades como `TEXT` decimal)

| Tabla | Columnas (origen legado) | Llaves y notas |
|---|---|---|
| `prod_settings` | `empresa_id`; `consumption_concept` (`NDE`), `output_concept` (`NFA`); `labor_account_id` (`CFG_MOBR`), `overhead_account_id` (`CFG_INDI`), `subcontract_account_id` (`CFG_MAQU`), `label_account_id` (`CFG_ETIQ`); `use_label_cost` (`EMPRESAS.CVINETA`); `default_input_warehouse_id` (hoy 1), `post_mode` (`por_orden`/`por_periodo`) | 1 fila por empresa |
| `prod_formulas` | `id`; `product_id` (→ artículo de `inventory`, vía `refs.ts`); `version` (nuevo, 1 al importar); `status` (`vigente`/`historica`); `valid_from`; `batch_size` (`PROGRAMA`, 2 dec.); `base_measure` (`MBASE`); `labor_per_unit` (`MOD`, 5 dec.); `overhead_pct` (`IND`); `line_code` (`LINEA`); `notes` (`COMENTARIO`); `legacy_code` (`PRODUCTOF`) | **único** `(empresa_id, product_id, version)`; una sola `vigente` por producto |
| `prod_formula_lines` | `id`; `formula_id`; `line_no`; `component_id` (`PRODUCTO`); `kind` (`materia_prima` ← `MP`, `empaque` ← `ME`, `semiterminado` ← `MG`; las 475 líneas sin `MP`/`ME` marcado se importan como `empaque` y se reportan); `quantity` (`CANTIDAD`, 5 dec.) | único `(formula_id, line_no)` |
| `prod_orders` | `id`; `order_no` (`LOTE`); `product_id` (`CODIG_PROD`); `formula_id` y `formula_version` (nuevos; en datos viejos el que haya); `line_code` (`LINEA`); `planned_qty` (`CANTIDADPR`); `produced_qty` (`CANTIDAD`); `planned_date` (`FECHAP`); `production_date` (`FECHAF`); `period` (derivado de `FECHAF`/`FECHAP`, no `SALFEC`); `status` (`programada`/`procesada`/`anulada`, de `PROCESADO`/`ANULADO`); `tracking_status_id` (`STATUS`); `responsible` (`RESPONSAB`), `shift` (`TURNO`), `notes` (`OBSERVA`); `output_warehouse_id` (`BODEGA`); `subcontractor_id` (`CODIGOM`); `purchase_ref` (`ORDENC`); `output_lot_no` (`LOTE2`), `output_expiry` (`FVENCE2`); `labor_rate` (`MOD`), `subcontract_rate` (`MODM`), `overhead_pct` (`CI`), `hours` (`HORAS`); **costos congelados**: `material_cost` (`CMP`), `packaging_cost` (`CME`), `labor_cost` (`CMOD`), `subcontract_cost` (`CMODM`), `overhead_cost` (`CIND`), `label_cost` (`VINETA`), `total_cost`, `unit_cost`; `processed_at`/`processed_by`; `voided_at`/`voided_by`/`void_reason` | **único** `(empresa_id, order_no)`; el número es texto libre (hasta 7 en el legado; permitir 20) |
| `prod_order_lines` | `id`; `order_id`; `line_no`; `component_id` (`CODIG_MATE`); `kind`; `planned_qty` (`CANTIDADO`, vacío si 0); `consumed_qty` (`CANTIDADP`); `unit_cost` (`PUNIT`, congelado); `warehouse_id` (`BODEGA`); `input_lot_no` (`LOTEIN`); `input_expiry` (`FEVENCE`) | único `(order_id, line_no)`. **No** se migran `ADICION`/`DEVOL`/`LOTEPRO`/`PROVEEDOR`/`FEFABRICA` (siempre vacíos) |
| `prod_waste_types`, `prod_order_waste` | 11 tipos sembrados (quebrado … falto de manteca); `order_id`, `waste_type_id`, `amount` (de los 11 campos `P*`) | solo si el negocio lo confirma (pregunta 28) |
| `prod_order_links` | `order_id`; `kind` (`consumo`, `entrada`, `traslado`, `parcial`); `inventory_movement_id` (devuelto por `inventory`); `reversed_by_link_id` | **enlace** con los movimientos; sin duplicar su contenido |
| `prod_order_postings` | `order_id`; `gl_entry_id`; `period`; `kind` (`costo`/`reversa`) | enlace con la partida del libro mayor (`source = 'produccion'`, `source_ref = order id`) |
| `prod_statuses` | `id`, `code`, `name` (`ESTATUS`) | único `(empresa_id, code)` |
| `prod_subcontractors` | `id`, `code`, `name`, `contact`, `warehouse_id`, `supplier_id` (a enlazar con CxP/`PROVEDOR`) | único `(empresa_id, code)` |
| `prod_overhead_rates` | `period` (`MES`+`YEAR`), `overhead_pct` (`INDI`), `labor_rate` (`OBRA`) | solo si se mantiene §14 (pregunta 17); datos 2013–2017 |
| `prod_dispatches`, `prod_dispatch_lines` | `dispatch_no`, `date`; `order_id` | **opcional** (pregunta 27); 1 fila de datos |
| `prod_partial_receipts` | `order_id`, `document`, `date`, `qty`, `warehouse_id`, `movement link` | **opcional** (pregunta 24); 0 filas de datos |

Catálogos de actividades, indirectos, mano de obra y maquinaria (`LACTIVI`, `LINDI`, `MOBRA`, `LMAQUINA`): **no se crean** (ninguna regla los usa). Decisión a confirmar (pregunta 28 y business-rules §2).

### 4.3 Reglas del modelo

- Dinero y cantidades como `TEXT` decimal exacto: **cantidades y costos unitarios con 5 decimales** (como `N13.5`/`N12.5` en el legado) y totales de partida contable con 2 (`toMoney`). Cada línea se redondea a 5 decimales antes de sumar para igualar al sistema anterior (redondeo mitad hacia afuera).
- Sin DELETE: anulación con `status = 'anulada'`; las líneas se conservan. La orden no se reescribe (se actualiza con auditoría).
- El **período** de una orden procesada sale de `production_date`; una orden en un período cerrado no se procesa ni se anula.
- Los movimientos de inventario **no se duplican** en `production`: solo se guarda el vínculo (`prod_order_links`).

## 5. Notas de migración

### 5.1 Volúmenes

`LOTE` 22,643 vivas → `prod_orders` (más 2,018 filas borradas de órdenes eliminadas sin procesar y 1 procesada borrada, **no se importan**); `DETALOTE` 98,857; `FORMULA` 377 → 282 fórmulas; `DETAFORM` 1,777; catálogos a lo sumo unas decenas de filas. Archivos: `LOTE.DBF` 22 MB y `DETALOTE.DBF` 36 MB (casi todo filas
borradas por el patrón borrar/reinsertar). Una importación completa son ~125 mil filas: unos segundos.

### 5.2 Codificación

`LOTE`/`DETALOTE`/`FORMULA`/`DETAFORM` en cp1252; `FORMULA2`/`DETAFOR2`/`CFINDI`/`ESTATUS` en cp850. El importador DBF existente detecta la marca. Los nombres de estatus y observaciones llevan acentos y `ñ` (p. ej. "Viñeta" en los textos de reportes).

### 5.3 Datos sucios a reportar (conteos de la copia)

| # | Hallazgo | Conteo | Tratamiento propuesto |
|---|---|---|---|
| 1 | Fórmulas con encabezado duplicado | 47 productos (377 filas → 282); 32 con parámetros distintos | tomar la última fila física como `vigente` y las demás como `historica` en orden inverso; reportar |
| 2 | Líneas de fórmula repetidas o con insumo repetido | 14 completas, 17 con otra cantidad | conservar todas, reportar |
| 3 | Fórmulas sin `MP`/`ME` marcado | 475 líneas | `kind = 'empaque'` por omisión, reportar |
| 4 | `FORMULA.MOD = 0` pero órdenes con `MOD > 0` | 377 de 377; 18,768 órdenes | importar el valor de la orden tal cual |
| 5 | Órdenes procesadas con cantidades de línea ≤ 0 | 116 líneas | importar; excluir del chequeo de paridad |
| 6 | Líneas procesadas con `PUNIT = 0` | 24 (más 776 de órdenes pendientes, normal) | importar |
| 7 | Órdenes procesadas con costo de materiales 0 | 8 | importar y reportar |
| 8 | `CMP`/`CME` no igualan a Σ líneas | 5 y 1 órdenes | importar las cifras guardadas (son lo contabilizado); reportar |
| 9 | `SALFEC` vacío | 22,590 de 22,592 procesadas | derivar `period` de `FECHAF` |
| 10 | Órdenes con bodega 0 | 25 | usar 1 como el sistema viejo, reportar |
| 11 | Órdenes sin líneas | 1 | importar sin líneas, marcar |
| 12 | Insumo repetido dentro de una orden | 6 órdenes | importar ambas líneas |
| 13 | Órdenes pendientes antiguas | 50 (de 2019-03 a 2020-10) | importar como `programada`; preguntar si se cierran |
| 14 | Orden anulada sin procesar | 1 | `anulada` |
| 15 | Orden procesada y borrada | 1 | no importar; reportar |
| 16 | `STATUS` en blanco | 61 | `tracking_status_id` nulo |
| 17 | `LOTE2` presente / `FVENCE2` ausente | 13 / 0 | importar `LOTE2` sin vencimiento |
| 18 | Productos de órdenes y fórmulas **sin artículo** en el `ARTICULO` de disco | 173 de 173 | necesita el `ARTICULO` del cliente; el importador valida contra `inventory` ya importado |
| 19 | `DETALOTE`/`FORMULA` cuyas cantidades ya no cuadran con la fórmula vigente | 7,044 de 12,861 líneas (muestra) | no recalcular: la orden es histórico |

### 5.4 Importador (propuesta)

1. Leer `LOTE`/`DETALOTE`/`FORMULA`/`DETAFORM` **sin las filas borradas** (el lector `vfp.py` ya las omite) y los catálogos.
2. Fórmulas: aplicar la regla del hallazgo 1; `kind` según `MP`/`ME`/`MG`.
3. Órdenes: `status` desde `PROCESADO`/`ANULADO`; costos tal como están (no recalcular); `period` desde `FECHAF` (o `FECHAP` si está vacía); `formula_id` nulo salvo que exista una fórmula con ese producto (se enlaza a la `vigente` solo como referencia).
4. **No** importar los movimientos de inventario desde `LOTE64`: vienen con `INV64` (`MOVIMIEN` con concepto `PR`/`EP` y `NFACT_ENV = lote`); el importador de producción debe **enlazar** `prod_order_links` por esa llave.
5. Importar `CFINDI` solo si se confirma la pregunta 17.

### 5.5 Controles de paridad

- **Dentro de LOTE64** (verificados contra los datos): por orden procesada, `CMOD = round(CANTIDAD × MOD, 5)` (22,592/22,592); `CIND = round((CMP + CME + CMOD + CMODM) × CI / 100, 5)` (22,592/22,592, tolerancia 0.01); `CMP`/`CME` = Σ `round(CANTIDADP × PUNIT, 5)` por tipo (22,587 y 22,591 de 22,592).
  El importador debe repetirlos y reportar las diferencias.
- **Contra inventario** (necesita la copia de `INV64` del cliente): para cada orden procesada, una salida `PR` por línea y una entrada `EP` con `NFACT_ENV = LOTE`, cantidades y totales iguales a `DETALOTE` y `LOTE` (`TOTAL` de la entrada = `CMP + CME + CMOD + CMODM + CIND + VINETA`); por producto, mes y bodega, `BODMES.ENTRADAS`/`SALIDAS` incluyen la suma de las órdenes.
  **No se pudo ejecutar con el disco actual** (§1.4).
- **Contra contabilidad:** la partida de "Generar Partida Contable" de un rango debe igualar Σ de costos de las órdenes del rango (§business-rules 15). **No verificable** sin la copia de CONTAC del cliente.
- **Totales:** número de órdenes por mes (435 a 1,453), unidades fabricadas y costo total por mes y producto, contra los reportes "Producción por Fecha"/"Producción Anual" del sistema viejo.
