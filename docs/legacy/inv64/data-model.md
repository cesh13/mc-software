# INV64 — Modelo de datos

Estructuras leídas de las cabeceras DBF (nunca datos de clientes). Conteos = registros físicos (entre paréntesis, los
marcados como borrados). Carpeta de datos: `MCERP/INV64/DBF` salvo indicación. **Los conteos de
`schema_dbf` iniciales estaban desactualizados; estos son de las cabeceras actuales.**
Convención: **[V]** verificado · **[I]** inferido.

## 1. Tablas legadas

### 1.1 Productos, catálogos y configuración

| Tabla | Propósito | Campos clave (nombres) | Registros |
|---|---|---|---|
| `ARTICULO` | Producto. Estructura **ancha** (≈190 campos): saldos por bodega, costos, precios, cuentas | `MODELO` C16 (código), `DESCRIP` C80, `GRUPO` N3, `SUBGRUPO` C3, `PROVEEDOR`, `FABRICANTE`, `UNIDAD`/`UNIDADM` (medida MH), `BARCODE`; saldos: `EXIST_INI`, `EXIST_MIN`, `MAXIMA`, `EXIST_ACT`, `BODEGA1..15` N13.5, `EBODE1..15` (congelado de toma física), `FISICO1..15`, `UBICA1..15`; costos: `COSTO_UNIT`, `COSTO_PROM`, `COSTOANT`, `CPROMANT`, `ULT*` (última compra), `PEN*` (compra anterior); precios: `PRECIO_VTA`, `PRECIO_CRE`, `PRECIO_OTR`, `PRECIO1..9`, `PRECIF`, `PCADENA`, `PVINETA`; cuentas: `CTA` (inventario), `CTAVENTA`, `CTADEVOL`, `CTAREBAJ`, `CTACOSTO`; banderas: `EXENTO`, `ESSERV`, `VENCE`, `PORFECHA`, `BONO`, `SERIE`, `FUERA` | 645 (0) |
| `TABLA` / `TABLA2` | Grupos (líneas) y subgrupos | `GRUPO`, `NOMBRE_GPO`, `CONTADO`, `CREDITO`, `COMISION` / `GRUPO`, `SUBGRUPO`, `NOMBRE`, `ORDEN` | 153 / 520 |
| `BODEGAS` | Bodegas activas | `BODEGA` N5, `N_CORTO`, `DESCRIPC`, `DIRECC` | 4 |
| `CONCEPTO` | Concepto de movimiento | `CONCEPTO` C2, `TIPO_MOV` E/S, `NOMBRECON`, `COSTO`, `ENVIO`, `GENCORRE`, `AFEC_INV`, `CTA`, `PASSWORD` | 16 (llaves duplicadas) |
| `UNIDADM` | Unidades de medida del catálogo MH | `CODIGO` C2, `MEDIDA` | 56 (16) |
| `FORMPAGO` | Formas de pago del catálogo MH | `CODIGO` C2, `NOMBRE` | 14 |
| `RECINTOF`, `REGIMEN`, `Incoterms` | Catálogos de exportación | `RECINTOFI`/`REGIMEN`/`CODINCOTER` + nombre | 4 / 56 (2) / 16 |
| `PROVEDOR` | Proveedor (copia) — el maestro está en CONTAC | `PROVEDOR`, `NOMBRE`, `REGISTRO`, `NIT`, `PLAZO`, `CTA`, `GRANCON`, … | 80 |
| `CORRE` | Tipos de documento de venta, series, resolución, correlativo | `TIPOFAC`, `DOCUMENTO`, `CORRE`, `NSERIE`, `NRESOLU`, `TIPDOC`, `VERSION` | 7 (1) |
| `CIERRE` | Meses cerrados de inventario | `FECHA` C6 (AAAAMM), `CERRADO`, `TIEMPO` | 164 |
| `EMPRESAS`, `USUARIOS`, `PERFIL`, `USREMP`, `BITACORA` | Sistema de usuarios compartido (en `FUENTE`) | ver contac | 1 / 3 / 522 / 6 / 23,607 (23,203) |

### 1.2 Documentos de venta

| Tabla | Propósito | Campos clave | Registros |
|---|---|---|---|
| `CORFACT` | **Encabezado** de CCF/F/E | `TIPOFAC`, `NFACT_ENV` C10, `FECHA_MOV`, `TIPO_MOV`, `CONCEPTO`, `PROVEEDOR` (= código del cliente, nombre heredado), `VENDEDOR`, `FORMAPAGO`, `PLAZO`, `TIPO_PAGO`, `BODEGA`, `TRANSPORTE`, `EXENTOT`, `GRAVADOT`, `IVAT`, `IVAPER`, `TOTALT`, `FLETE`, `SEGURO`, `PESO`, `PORCOMI`, `IMPRESO`, `ANULADA`, `PEDIDO`, `NSERIE`, `NRESOLU`, `TIPDOC`, `FORMPAGO`, `RECINTOFI`, `REGIMEN`, `CODINCOTER`, `TIPOITEMEX`, `CODGENERA`, `NCONTROL` (copia), `NORDEN`, `NUMENVI`, `FENTREGA`, `USUARIO`, `COMENTARIO` (memo) | 56,396 (18) |
| `FACT` | **Líneas** de CCF/F/E | `TIPOFAC`, `NFACT_ENV`, `MODELO`, `LINEAOR`, `CANTIDAD` N13.5, `COMPRA` (vendidas), `BONIFICA1`, `PREVENTA`, `SUBTOTAL`, `DESCUEN`/`PORCEN`, `PUNIT`, `GRAVADO`, `EXENTO`, `IVA`, `TOTAL`, `COSTO_PROM`, `COSTO_PRE`, `BODEGA`, `LOTE`, `FVENCE`, `PEDIDO`, `PREBONI`, `IVARETLIN`, `PORVENTA`, `USUARIO` | 161,432 (29) |
| `CORDEV` / `DEVOL` | Encabezado / líneas de **nota de crédito** y nota de abono | como `CORFACT`/`FACT` más `APLICADOA`, `APLICAR`, `NCREDITO`, `TNC`, `RETENER`, `EXISTEDTE` | 2,180 (4) / 2,418 (8) |
| `PEDI`, `DPEDI` | Orden de compra | encabezado / líneas con `RECIBIDO` | 5 (2) / 3 |
| `REMISION`, `DETAREMI`, `PED`, `DETAPE`, `REMI`, `DETA`, `ENVFACT`, `CORENVFA`, `CORENV`, `DETAENV` | Pedidos de cliente, prefacturas, remisiones, egresos | — | **0** (sin uso) |
| `ENVIO` | Datos de envío | `NENVIO`, `NFACT_ENV`, `BULTOS`, `TRANSPORTE`, `FLETE` | 11 |
| `MOVPRO` | Último precio por cliente y producto | `MODELO`, `CLIENTE`, `NFACT_ENV`, `PREUNI`, `FECHA_MOV` | 10,761 (331) |
| `NUEVAT` | Despachos de reparto | `NDESPACHO`, `FDESPACHO`, `FTRA`, `FVEH` | 316 |
| `CVINETA`, `VINETA`, `DETAVINE` | Viñeta (impuesto/costo adicional por línea de grupo 1) | — | 0 |

### 1.3 Facturación electrónica

| Tabla | Propósito | Campos clave | Registros |
|---|---|---|---|
| `FELECTRO` | **Preparación y resultado del DTE**: una fila **por línea** del documento, con todos los datos del documento repetidos. Ancho (≈160 campos, fila de 3,791 bytes) | Identificación (`VERSION`, `AMBIENTE`, `TIPODTE`, `NCONTROL`, `CODGENERAC`, `FECEMI`, `HOREMI`); emisor (`NITEMISOR`… `CODPUNTOVE`); receptor (`NITRECEPTO`… `CORREORECE`, `TIPODOCUME`, `NUMDOCUMEN`); ítem (`NUMITEM`, `TIPOITEM`, `CODIGO`, `CANTIDAD`, `UNIMEDIDA`, `PRECIOUNI`, `VENTAGRAVA`, `VENTAEXENT`, `IVALIN`); resumen (`TOTALGRAVA`, `TOTALDESCU`, `VALTRIBU`, `IVARETE1`, `TOTALPAGAR`, `TOTALLETRA`, `CONDOPERA`, `CODIGOPAGO`, `PLAZO`); referencia a original (`TIPODOCNC`, `TIPOGENENC`, `NOCCFDENC`, `FECCFDENC`); exportación (`RECINTOFI`, `REGIMEN`, `CODINCOTER`, `FLETE`, `SEGURO`, `TIPOITEMEX`, `CODPAIS`); apéndices; control (`SELLORE`, `NUMVALIDAC`, `FHPROCESAM`, `PROCESADO`, `FALLO`, `INVALIDADA`); enlace (`NFACT_ENV`, `TIPODOC` F/C/N/D/E/S). `COMENTARIO` memo | 43,347 (7,403 borradas) = 35,944 vigentes = **11,690 documentos** |
| `FANULAR` | **Solicitud de invalidación** del DTE: una fila por documento | emisor, `TIPODTE`, `CODGENERAC`, `SELLORE`, `NCONTROL`, `FECEMI`, `MONTOIVA`, solicitante, responsable, `TIPOANULA`, `MOTIVOANUL`, `PROCESADO`, `FALLO`, `VERSION`, `NFACT_ENV`, `TIPODOC` | 522 (2) |

Llave de enlace con el documento: `NFACT_ENV + TIPODOC` (= `TIPOFAC`). El número de control y el código de generación
también se copian a `CORFACT.NCONTROL/CODGENERA` en algunos casos [V por estructura] y a `IVAFIS` (IVA64).
**Los campos de control los escribe un proceso externo que no está en el código fuente** (business-rules §11).

### 1.4 Kárdex y saldos

| Tabla | Propósito | Campos clave | Registros |
|---|---|---|---|
| `MOVIMIEN` | **Kárdex**: una fila por línea de movimiento (ventas, devoluciones, entradas, salidas, transferencias) | `MODELO`, `FECHA_MOV`, `TIPO_MOV` E/S, `CONCEPTO`, `NFACT_ENV` C15, `TIPOFAC`, `CANTIDAD` N13.5, `BODEGA` N5, `COSTO_PRE` N12.5, `COSTO_PROM` N9.3, `COSTO_ANT`, `EXIST_ANT`, `TOTAL`, `LOTE`, `FVENCE`, `TRANSFERIR`, `DESTINO`, `ORDENC`, `GRUPO`, `SUBGRUPO`, `PROVEEDOR` (en ventas va en blanco) | 174,600 (38) |
| `DATAMOV` | Encabezado del documento de movimiento (también uno por factura) | `TIPO_MOV`, `CONCEPTO`, `NFACT_ENV` C15, `FECHA_MOV`, `PROVEEDOR`, `BODEGA`, `EXENTA`, `GRAVADO`, `IVA`, `VTOTAL`, `IMPORTA`, `IVAIMP`, `QUEDAN`, `TIPCOMP`, `RECIBIDO`, `VENCE`, `MONEDA`, `CREDITO`, `CERRAR`, `DESTINO`, `NORDEN`. **Faltan en disco** `SIIVA`, `NCONTROL`, `CODGENERA`, `SELLOR`, `CLASEDOC`, `TIPOOPE`, `CLASIFIC`, `SECTOR`, `TIPOCOSTO`, `OBSERVA`, `AREA` (las pantallas los manejan) | 57,621 (24) |
| `MESES` | Saldo y valor **por producto y mes** | `SALFEC` C6, `MODELO`, `INICIO`, `ENTRADAS`, `SALIDAS`, `FIN`, `COSTOI`, `COSTOE`, `COSTOS`, `COSTOF`, `COSTO_PROM`, `COSTO_UNIT`, `COSTO_VEND`, `UNIDA_VEND`, `VALOR_VTA` | 47,248 |
| `BODMES` | Igual **por producto, bodega y mes** | `SALFEC`, `MODELO`, `BODEGA`, `INICIAL`, `ENTRADAS`, `SALIDAS`, `FINAL`, `COSTOI/E/S/F`, `COSTO_VEND`, `UNIDA_VEND`, `VALOR_VTA` | 58,537 (2,759) |
| `SALDOLO` | Saldo **por lote, bodega y mes** | `MODELO`, `SALFEC`, `LOTE`, `FVENCE`, `INICIAL`, `ENTRADA`, `SALIDA`, `FIN`, `BODEGA` | 297,639 (17,536) |
| `VENCE2` | Existencia vigente por lote (todas las bodegas) | `MODELO`, `GRUPO`, `SUBGRUPO`, `LOTE`, `FVENCE`, `ENTRADA`, `SALIDA`, `FIN` | 3,969 |

Claves naturales: `ARTICULO.MODELO`; `MOVIMIEN` = (`TIPOFAC`,`TIPO_MOV`,`CONCEPTO`,`NFACT_ENV`,`MODELO`,`LOTE`) (índice `boralo`); `DATAMOV` = (`TIPO_MOV`,`CONCEPTO`,`NFACT_ENV`,`PROVEEDOR`) — **no única en los datos**;
`MESES` = (`SALFEC`,`MODELO`); `BODMES` = (`SALFEC`,`MODELO`,`BODEGA`); `SALDOLO` = (`MODELO`,`SALFEC`,`LOTE`,`BODEGA`); `CORFACT`/`FACT` = (`TIPOFAC`,`NFACT_ENV`) [V].

### 1.5 Tablas de otros módulos que INV64 usa o escribe

| Tabla | Módulo | Uso |
|---|---|---|
| `CCMOV01` | cxc64 | **Se escribe**: `C0` (factura), `A1` (nota de crédito), `A6` (nota de abono), `C4` (nota de débito); se lee para saldos y validaciones. Fila única por (`ftmov`,`fref`,`fticom`) |
| `CCCLI01`, `CCVEND`, `CCDEP01`, `CCMUN01`, `PAISES`, `ACT_ECO` | cxc64 / catálogos | Cliente (precio, crédito, exención, gran contribuyente, datos DTE), vendedor, geografía y actividad económica |
| `PARTIDAS`, `DETAPART`, `SALDOS`, `SALDOCC`, `CATALOGO`, `TIPOPAR` | CONTAC | **Se escriben** por `CGADIPAR` desde los tres procesos de contabilización |
| `QUEDAN`, `PROVEDOR` | CONTAC (CxP de Bancos) | `QUEDAN` se escribe al "Provisionar" una compra |
| `COMPRAS`, `DEXCLU`, `IVAFIS`, `IVAFAC`, `CONTRIBU`, `CLIENTES` | IVA64 | Existen **copias** en `INV64/DBF` (IVA64 las reconoce como suyas); sujeto excluido escribe `COMPRAS`/`DEXCLU` |
| `DPEDI.RECIBIDO`, `ARTICULO`, `MOVIMIEN`, `DATAMOV`, `BODMES`, `MESES`, `SALDOLO`, `VENCE2` | lote64 | Producción escribe en estas (ver lote64 data-model §2) |

### 1.6 Tablas vacías o de uso nulo (no se migran)

`ARANCEL`, `ARCHIVOS`, `BANCOS`, `CATG`, `CDTVEN`, `CONTROL`, `COPIA`, `CORENV(FA)`, `COSTOS`, `CVINETA`, `DESALIDA`, `DETA*`,
`DETAI0*`, `DETAPE`, `DETAPEDI`, `DETAREMI`, `DETAVINE`, `ENVFACT`, `ERROR`, `FACTOR`, `FACTURA`, `FIXED`, `IMPAIS`,
`IMPART`, `IMPUESTO`, `KARDEX`, `MARCAS`, `MODELO`, `MODPRO`, `MOV2`, `PEDIDO`, `PRODUCTO`, `PROY*`, `PSUGE`, `PVEND`,
`REMI(SION)`, `RENTA`, `TRANS`, `UBICA`, `UNICO`, `UNIDADES`, `VENCE`, `VENDART`, `VINE*`, `XX`: **0 filas** [V]. Las
tablas de retaceo (`PEDIDO`, `DETAPEDI`, `COSTOS`, `IMPUESTO`, `ARANCEL`, `BANCOS`) están vacías.
`FABRICAN` tiene 356 filas, **todas borradas**. Las demás en `FUENTE` (`ARTI`, `COR`, `WILDA`, `VEN*`, `VENTAS*`…)
son copias de trabajo: ignorar.

### 1.7 Relaciones

```
EMPRESAS.camino/cxc/bancos/lote/rutainv/rutapdf ─→ SET PATH (inv64\dbf; cxc64\dbf; contac\dbf; lote64; …)

CCCLI01 (cxc64) ─1:N→ CORFACT ─1:N→ FACT ─(modelo)→ ARTICULO ─(grupo,subgrupo)→ TABLA/TABLA2
                          │             └─ genera 1:1 → MOVIMIEN (S/SV) ─→ BODMES / MESES / SALDOLO / VENCE2 / ARTICULO.BODEGAn
                          ├─ 1:1 → DATAMOV (S, SV, número)          [encabezado de movimiento]
                          ├─ 1:1 → CCMOV01 (C0, fref=nfact_env, fticom=tipofac)   [cartera]
                          └─ 1:N → FELECTRO (nfact_env + tipodoc)  ─ 1:0..1 → FANULAR
CORFACT ─(aplicadoa)← CORDEV ─1:N→ DEVOL ─→ MOVIMIEN (E/ED)           [CCMOV01 A1 al imprimir]
CORRE(tipofac) → serie/resolución/tipdoc/versión del documento
DATAMOV (E) ─1:N→ MOVIMIEN ─(ordenc)→ DPEDI ; provedor ─→ QUEDAN (CONTAC) ; siiva → COMPRAS (IVA64)
CORFACT/FACT/MOVIMIEN ──(rango de fechas, sin marca)──→ PARTIDAS/DETAPART (CONTAC) vía CGADIPAR
```

## 2. Modelo propuesto

### 2.1 ¿Facturación como módulo separado de `inventory`? **Sí.**

Razones: (1) el sistema anterior mezcla tres ciclos de vida distintos (existencias/costo, documentos de venta y
documentos tributarios electrónicos) en las mismas pantallas y esa mezcla es la causa de los hallazgos más graves
(documentos que se reescriben en cartera al imprimir, DTE preparado por línea, costo re-valuado después). (2) Los
documentos de venta tienen reglas tributarias propias (series, tipos de documento, IVA, percepción, DTE) que cambian
por país/norma y no deben vivir junto al kárdex. (3) CxC, IVA, DTE y el libro mayor consumen *ventas*, no existencias.
(4) `inventory` también lo usan compras, producción (`LOTE64`) y ajustes, que no son ventas. Por eso:

| Módulo | Prefijo | Contenido |
|---|---|---|
| `inventory` | `inv_` | Productos, bodegas, lotes, conceptos, **movimientos** (fuente de verdad), saldos y costo promedio, documentos de movimiento (entrada/salida/transferencia/ajuste), toma física, recepciones de compra, cierre de período |
| `sales` (nuevo) | `sal_` | Series, documentos de venta (CCF, factura, exportación, nota de crédito/débito), líneas, impuestos, condiciones, pedidos/cotizaciones (opcional), vínculos con CxC/GL/inventario |
| `electronic-invoicing` (nuevo, id `dte`) | `dte_` | Documentos tributarios electrónicos, eventos (emisión, rechazo, invalidación), configuración de establecimientos/puntos de venta, interfaz con el proveedor de firma/transmisión |
| `tax` (ya planeado) | `tax_` | Libros de IVA: se llenan desde `sal_`/AP |
| `accounts-receivable` | `ar_` | Reciben el cargo de la venta por evento |
| `accounts-payable` | `ap_` | Reciben la provisión de la compra |

`inventory` **no** conoce clientes ni impuestos de venta; `sales` llama a `inventory.postMovements` y a
`accounts-receivable`/`gl` a través de contratos (los módulos no se importan entre sí).

### 2.2 `inventory` (`inv_`)

| Tabla | Columnas principales (origen legado) | Claves |
|---|---|---|
| `inv_items` | `id`, `empresa_id`, `sku` (`MODELO`), `name` (`DESCRIP`), `group_id` (`GRUPO`), `subgroup_id` (`SUBGRUPO`), `unit_id` (`UNIDADM`), `barcode`, `is_service` (`ESSERV`), `is_tax_exempt` (`EXENTO`), `tracks_lots` (`VENCE`), `min_qty` (`EXIST_MIN`), `max_qty` (`MAXIMA`), `weight`, `inventory_account_id` (`CTA`), `sales_account_id` (`CTAVENTA`), `cogs_account_id` (`CTACOSTO`), `is_active`, `vendor_id`, `manufacturer_id` | **único** (`empresa_id`,`sku`) |
| `inv_item_prices` | `item_id`, `price_list` (1..9 ← `PRECIO_VTA`,`PRECIO_CRE`,`PRECIO_OTR`,`PRECIO1..9`), `price`, `price_with_tax` (derivado), `valid_from` | (`item_id`,`price_list`,`valid_from`) |
| `inv_warehouses` | `code` (`BODEGA`), `name`, `address` | único (`empresa_id`,`code`) |
| `inv_lots` | `item_id`, `lot_no` (`LOTE`), `expires_on` (`FVENCE`) | único (`empresa_id`,`item_id`,`lot_no`) |
| `inv_movement_types` | `code` (`CONCEPTO`), `direction` (E/S), `name`, `updates_cost` (`COSTO`), `requires_approval` (`PASSWORD`), `gl_account_id` (`CTA`), `source_kind` (compra/venta/devolución/ajuste/transferencia/producción) | único (`empresa_id`,`code`,`direction`) — **resolver los códigos repetidos** |
| `inv_documents` | `id`, `empresa_id`, `type_id`, `doc_no`, `date`, `warehouse_id`, `supplier_id`, `purchase_order_ref`, `notes`, `status` (borrador/aplicado/anulado), `source`, `source_ref`, `legacy_key` | único (`empresa_id`,`type_id`,`doc_no`,`supplier_id`) para nuevos; el legado se importa sin esa restricción |
| `inv_movements` | `id`, `empresa_id`, `document_id`, `item_id`, `warehouse_id`, `lot_id`, `date`, `direction`, `quantity` (decimal 5), `unit_cost` (decimal 5), `total_cost` (decimal 5→2), `type_id`, `reversal_of`, `source` (`ventas`,`compras`,`produccion`…), `source_ref`, `legacy_*` | índice (`item_id`,`warehouse_id`,`date`) |
| `inv_balances` | caché por (`item_id`,`warehouse_id`,`lot_id`,`period`): `qty`, `value`; **derivable** de `inv_movements` | reconstruible; sustituye a `MESES`/`BODMES`/`SALDOLO`/`VENCE2`/`ARTICULO.BODEGAn` |
| `inv_cost_state` | `item_id`, `qty`, `value`, `avg_cost` (promedio móvil por producto), `last_cost` | única por producto |
| `inv_receipts` | recepción de compra: `document_id`, `supplier_doc_ref`, `taxable`, `exempt`, `vat`, `perception`, `import_amount`, `dte_control_no`, `dte_generation_code`, `dte_seal` (de compras recibidas), `cost_class`, `post_to_tax`, `ap_document_ref` | |
| `inv_count_sessions`, `inv_count_lines` | toma física con ajuste automático | |
| `inv_period_locks` | `period`, `closed_at`, `closed_by`, `reopened_at`, `reopened_by`, `reason` | único (`empresa_id`,`period`) |

El cierre de período **no recalcula**: solo bloquea. La existencia y el costo se obtienen sumando movimientos.

### 2.3 `sales` (`sal_`)

| Tabla | Columnas principales (origen legado) | Claves |
|---|---|---|
| `sal_series` | `doc_type` (`TIPOFAC`: ccf/factura/exportación/nc/nd/sujeto excluido), `dte_type` (`TIPDOC`), `series` (`NSERIE`), `authorization` (`NRESOLU`), `establishment_id`, `pos_id`, `next_no`, `range_from`, `range_to`, `active` | único (`empresa_id`,`doc_type`,`series`,`establishment_id`,`pos_id`) |
| `sal_documents` | `id`, `empresa_id`, `doc_type`, `series_id`, `doc_no` (`NFACT_ENV`), `date`, `customer_id` (`PROVEEDOR`), `salesperson_id`, `terms` (contado/crédito), `payment_days` (`PLAZO`), `payment_method_code` (`FORMPAGO`), `due_date`, `warehouse_id`, `subtotal_taxable`, `subtotal_exempt`, `subtotal_nonsubject`, `discount_total`, `vat` (`IVAT`), `vat_withheld`/`vat_perceived` (`IVAPER`, con `kind`), `freight`, `insurance`, `total` (`TOTALT`), `weight`, `commission_pct`, `ref_document_id` (`APLICADOA`), `credit_reason` (`TNC`), `po_ref` (`NORDEN`), `status` (borrador/emitido/anulado), `voided_at`, `voided_by`, `void_reason`, `created_by` (`USUARIO`), `legacy_key`, `printed_at` | **único** (`empresa_id`,`doc_type`,`series_id`,`doc_no`) |
| `sal_document_lines` | `document_id`, `line_no` (`LINEAOR`), `item_id`, `description`, `qty_sold`, `qty_bonus` (`BONIFICA1`), `unit_price`, `discount_pct`, `discount_amount`, `taxable`, `exempt`, `vat`, `line_total`, `warehouse_id`, `lot_id`, `unit_cost_at_sale` (← `COSTO_PRE`/`COSTO_PROM`, **fijo**), `price_includes_tax` | |
| `sal_exports` | `document_id`, `customs_enclosure` (`RECINTOFI`), `customs_regime`, `incoterm`, `item_kind` (`TIPOITEMEX`), `destination_country`, `declaration_no` | |
| `sal_customer_last_price` | caché de `MOVPRO` | (`customer_id`,`item_id`) |
| `sal_document_postings` | `document_id`, `kind` (`inventory`,`ar`,`gl_sales`,`gl_cogs`), `ref_id`, `posted_at`, `period` | enlaza al movimiento de inventario, al cargo de cartera y a las partidas |
| `sal_orders` (opcional) | pedido/cotización/prefactura | no migrar tablas vacías |

### 2.4 `electronic-invoicing` (`dte_`)

| Tabla | Columnas principales | Claves |
|---|---|---|
| `dte_settings` | por `empresa_id`: ambiente, tipos de documento habilitados, referencia al secreto del proveedor (**no el secreto**), carpetas de PDF | |
| `dte_establishments` | `code_mh`, `code_internal`, `type`, `pos_code_mh`, `pos_code_internal`, dirección | sustituye los literales fijos en el código |
| `dte_documents` | `id`, `empresa_id`, `sales_document_id` (o `purchase_document_id` para sujeto excluido), `dte_type`, `schema_version`, `control_no` (`NCONTROL`), `generation_code` (`CODGENERAC`), `reception_seal` (`SELLORE`), `issued_at` (`FECEMI`+`HOREMI`), `status` (preparado/transmitido/aceptado/rechazado/invalidado/contingencia), `payload_json` (JSON emitido, inmutable), `legacy_rows` | **único** (`empresa_id`,`generation_code`); único (`empresa_id`,`dte_type`,`control_no`) |
| `dte_events` | `dte_document_id`, `kind` (emitir/invalidar/consultar), `request`, `response`, `error`, `attempts`, `created_at`, `processed_at`, `invalidation_type`, `invalidation_reason`, `requested_by` | cola con reintentos |
| `dte_files` | `dte_document_id`, `pdf_ref`, `qr_ref`, `json_ref` | |

### 2.5 Qué cambiar en el esqueleto actual (`modules/inventory`)

El `schema.ts` actual tiene solo `inv_items` (con `quantityOnHand` y `unitCost` guardados) e `inv_transactions`
(`type` = purchase/sale/adjustment). Cambios necesarios:
1. Quitar `quantityOnHand` y `unitCost` de `inv_items`: la existencia y el costo se calculan (`inv_balances`, `inv_cost_state`).
2. Añadir `empresa_id` a todas las tablas (hoy no lo tienen) y `legacy_key`/`legacy_*` para trazabilidad del importador.
3. Reemplazar `inv_transactions` por `inv_documents` + `inv_movements` (con `warehouse_id`, `lot_id`, `source`/`source_ref`, `reversal_of`, decimales de 5).
4. Agregar bodegas, lotes, conceptos, series, grupos, unidades y cierre de período.
5. Cuenta: `accountId` único se reemplaza por tres cuentas (inventario, ventas, costo).
6. `manifest.ts`: dependencias de `chart-of-accounts` y `general-ledger` (contrato de posteo); permisos por acción; los módulos `sales` y `dte` se registran aparte.
7. `GL_ENTRY_SOURCES` (en `packages/shared/src/gl.ts`) hoy solo admite `manual`, `bancos`, `iva`, `cierre`, `importado`: agregar `ventas`, `inventario`, `costo` (y `produccion`, `cxp`, `cxc` de otros specs).

## 3. Notas de migración

### 3.1 Volúmenes
Documentos de venta ≈ 56,400 + 2,180 notas; líneas ≈ 161,400 + 2,400; movimientos 174,600; encabezados de movimiento
57,600; DTE 11,690 documentos (35,944 filas); saldos mensuales ≈ 47,200 + 58,500 + 297,600. Es un volumen pequeño:
una importación completa debe correr en minutos.

### 3.2 Reglas de importación
- **Codificación:** tablas con marca `cp=03` (cp1252) y `cp=00` (cp850): `CLIENTES`, `CONTRIBU`, `DPROVI0*`, `IVAFAC`, `IVAFIS`, `GASTOS`, `PROYVIS`, `RENTAT`; las demás cp1252. Usar el detector del importador existente.
- **Importar el histórico, no los saldos:** cargar `MOVIMIEN` como movimientos (con su costo ya fijado) y **calcular** los saldos; comparar con `MESES`/`BODMES`/`SALDOLO` y reportar diferencias, sin forzarlas.
- **Documentos:** `CORFACT`+`FACT` → `sal_documents`+`sal_document_lines` (anulados: encabezado con totales originales de `CORFACT` si se conservaron, líneas inexistentes); `CORDEV`+`DEVOL` igual; el tipo (`TIPOFAC`) fija `doc_type`; `TIPDOC` vacío antes de 2024-11 se completa por `TIPOFAC`.
- **DTE:** colapsar las filas de `FELECTRO` vigentes por (`NFACT_ENV`,`TIPODOC`) a un `dte_documents`; descartar las filas borradas (intentos de preparación); el estado final = `ACEPTADO` si hay `NCONTROL`+`CODGENERAC`+`SELLORE`; `FANULAR` con `PROCESADO` → `invalidado`; los 13 sin número de control quedan `preparado/fallido` para revisar. No se reconstruye el JSON: se guardan las cifras y los identificadores.
- **CxC:** el cargo `C0` ya existe en cxc64. El importador de ventas debe enlazar `sal_documents` con `CCMOV01` por (`ftmov='C0'`, `fref`, `fticom`) y **no crear un segundo cargo**; reportar las `C0` sin documento y los documentos sin `C0` (el módulo viejo lo hacía con `INCUADRE`).
- **Contabilidad:** no se reimportan las partidas (están en CONTAC). Los vínculos documento→partida no existen: dejar `sal_document_postings` vacía hasta contabilizar con el nuevo flujo desde una fecha de corte.
- **Sujeto excluido:** viene de `COMPRAS`/`DEXCLU` (IVA64), no de inventario.
- **Marcadores de código y claves repetidas:** `CONCEPTO` con duplicados; `DATAMOV` con 1,442 llaves repetidas; usar id estable y guardar la llave legada.

### 3.3 Chequeos de paridad
1. **Existencia y valuación** por producto y bodega (y lote): suma de movimientos importados = `ARTICULO.BODEGAn`/`EXIST_ACT` y `BODMES.FINAL`, `COSTOF` por mes; esperadas diferencias en 21 productos con lote (967 unidades netas) y en los meses con re-valuado.
2. **Costo promedio:** `MESES.COSTOF/FIN` por mes = costo promedio recalculado; reportar los 40 productos que no coinciden con `ARTICULO.COSTO_PROM`.
3. **Ventas por mes y tipo** (gravado, exento, IVA, retención, total) = suma de `CORFACT` = suma de `CCMOV01` (`C0`) = libro de ventas de IVA64 = reporte `incorca` del sistema viejo. Meses con DTE: también contra la suma de `FELECTRO` vigente.
4. **Correlativos:** sin huecos ni duplicados por (tipo, serie); reportar los huecos y compararlos con `danulado`.
5. **Compras por mes** contra el libro de compras (`COMPRAS`).
6. **Costo de ventas** del período contra las partidas "COSTO DE VENTA" de CONTAC (requiere la copia viva de CONTAC; la que hay en disco termina en 2024-03).
7. **Notas de crédito** contra `CCMOV01` `A1` (2,233) y su aplicación a `C0.fabono`.

### 3.4 Datos que faltan
- Copia viva de `DATAMOV` (con las columnas fiscales) y de la tabla `RESOL` (usada por `danulado`; no está en el disco).
- La configuración del proceso externo del DTE (qué hace, dónde corre): ver open-questions.
- Una copia de CONTAC posterior a 2024-03 y de cxc64/IVA64 del mismo día que INV64.
