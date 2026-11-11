# cxc64 — Modelo de datos

Estructura, llaves y conteos salen de los `.DBF` reales de `MCERP/cxc64/DBF` (datos de CxC), `MCERP/CONTAC/dbf` (libro mayor),
`MCERP/INV64/DBF` (inventario; solo las tablas que CxC lee) y del catálogo de índices `ARCHIVOS.DBF` (en `cxc64/FUENTE`).
Conteos = registros vivos (sin marcados como borrados). **No se copió ningún dato de cliente.** Los conteos sirven para la paridad.

## 1. Tablas legadas

### 1.1 Núcleo de cartera

| Tabla | Contenido | Campos clave | Registros |
|---|---|---|---|
| `CCCLI01` | **Clientes** | `FCTA` C10 (llave, índice `CLIENTE`), `FNCLI` C70 (razón social), `NCOMERCIAL`, `NSOCIEDAD`, `FDCLI` C90, `FTEL`, `FFAX`, `EMAIL`, `FREGIVA` C10, `FNIT` C18, `CEDULA` C12, `PASAPORTE`, `OTRODOC`, `FDEP` C2 + `FMUN` C3 (+ `COD_MUNICI`, `FCITY`), `PAIS`, `COD_PAIS` (MH), `ACT_ECO` C10, `FORMPAGO` C2, `TIPOCLI` N1 (natural/jurídica), `TCLIENTE` C1 (I/P), `FTINEG` C2 (tipo de negocio), `FVEND` C3 (vendedor), `CODVI` C3 (visitador), `MATRIZ` C10, `CTA` C14 (cuenta contable), `FPLAZ` N3 (plazo), `FLIMCRE` N10.2 (límite), `DESCUENTO` N5.2, `NPRECIO` N1, `FTIPC` C3 (clasificación), `FDCOB` C9 + `FSEM1..4` N1 (día y semana de cobro), `GRANCLI`, `FEXENTO`, `INACTIVO`, `SUSPENDIDO`, `CCONTADO`, `P90`, `LIBERAR`, `BLOQUEDADO` (todas L), referencias comerciales (`REFE1..3`, `TELREF*`, `TIEMPOREF*`, `PAGAREF*`, `CHERECHZ*`), `DIASP`/`VECESP` N12.2, `FCARM`/`FABOM`/`FSANT`/`FSALACT`/`FSALANT` N11.2 (saldos y contadores), `FFECING`, `FECHAUV`/`MONTOUV`, `FFECUF`/`FMONUF`, `FFECUP`/`FMONUP`, `FULVENTA`, `FCOMP1..3`/`MCOMP1..3`/`NFACT1..3` (últimas compras), `CODSUC`, `CODMED`, `ESPECIALCL`, `TRANSP`/`TRANSP0`, `AYUDANTE`, `USUARIO` | 1,792 (1,800 con 8 marcados) |
| `CCMOV01` | **Movimientos de cartera**: documentos y aplicaciones | ver §1.2 | 117,656 (118,442 con 786 marcados) |
| `CCTMOV` | **Tipos de movimiento** | `CTMOV` C2 (llave), `CDES` C30, `CTA` C14, `CTA2` C14, `CCTAE` C15 (cuentas contables del tipo; `CCTAE` = cuenta de exportación), `CCTA` C15 (siempre vacío), `USUARIO` | 16 |
| `CCVEND` | Vendedores | `CVEND` C3, `CNOM` C35, `CENREPORTE` L, `C30`..`C181` N12.2 (7 acumulados por tramo, no se usan para reportes) | 16 |
| `TNEGOCIO` | Tipos de negocio | `CNEG` C2, `CTNEG` C30 | 14 |
| `MATRIZ` | Casas matriz (cadenas) | `CODIGO` C10, `DESCRIP` C50, `OBSERVA` C100 | 18 (20 con 2 marcados) |
| `VISITADO` | Visitadores | `CODVI` C3, `DESCRIPCIO` C50 | 8 (36 con 28 marcados) |
| `BANCOS` | Bancos de los cheques de clientes | `CBANCO` C2, `NOMBANCO` C35, `AYUDANTE` C10 | 26 |
| `CCDEP01`, `CCMUN01`, `DISTRITOS`, `PAIS`, `PAISES`, `ACT_ECO` | Catálogos geográficos, país y giro (del Ministerio de Hacienda) | `FDEP`/`FMUN`/`COD_DEPART`/`COD_MUNICI`, `COD_PAIS`, `CODIGO` | 15 / 261 / 45 / 3 / 249 / 768 |
| `FORMPAGO` (en `INV64/DBF`) | Formas de pago del MH | `CODIGO` C2, `NOMBRE` C100 | 14 |
| `CIERREC` | **Meses cerrados** de cartera | `FECHA` C6 (`AAAAMM`), `CERRADO` L, `TIEMPO` C8 | 152 (176 con 24 marcados) |
| `INEMPRE`, `MOVI`, `PAIS` | Configuración heredada | — | 2 / 5 / 3 |

Índices relevantes de `CCMOV01` (de `ARCHIVOS.DBF`, textos de las expresiones, no son datos): por `FTMOV+FREF+FTICOM` (cargos `CARGOS`, `MOVFAC2` solo C0), `FTMOV+FREF+FTICOM+FCTA` (`MOVFAC`, `MOV2`), `FNFAC+FTICOM+FTMOV` (`CCMOV2`, para
ver las aplicaciones de un documento), `FCTA` y `FCTA` filtrado a saldos abiertos (`FACTURA`, `FACTURA2`), `FLIQUI+FREF+FTICOM+FNFAC+FTMOV` (`FLIQUI`), `FREF+FBANCO+FCTA` (`CHEQUES`), `FNUCHE+FBANCO+FCTA` (`CHEQUEP`), `FTMOV+sucursal+DTOC(FFEC)+FREF+FTICOM`
(`IVA`, el que usa el libro de IVA) y `FCTA+FNFAC+FTICOM+(C antes que A)+tipo` (`POSTEO`, el que usa la reconstrucción de saldos).

### 1.2 `CCMOV01` — campos

Una fila es un documento o una aplicación (§2 de las reglas). Campos y uso (con la proporción vacía/no vacía de los datos):

| Campo | Tipo | Uso |
|---|---|---|
| `FTMOV` | C2 | tipo de movimiento (C0, C4, A0, A1, …) |
| `FFEC` | D | fecha del documento |
| `FREF` | C10 | número del documento (o número de nota de abono / cheque en las filas A4/C3) |
| `FNFAC` | C10 | **documento al que se aplica** (en C0 = `FREF`; vacío en notas de crédito sin aplicar) |
| `FTICOM` | C1 | tipo de comprobante **C** crédito fiscal / **F** consumidor final / **E** exportación |
| `MOV2` | C2 | tipo del documento destino de una aplicación (C0, C2, C3; vacío = C0) |
| `FCTA` | C10 | cliente (en anuladas contiene "ANULADA"/"ANULADO") |
| `FMON` | N10.2 | monto total del documento (o de la aplicación) |
| `FGRAV`, `FEXEN`, `FVALIVA` | N10.2 / N9.2 | gravado, exento, IVA |
| `IVAPER` | N12.2 | retención de IVA por el cliente (§3.4 de las reglas) |
| `FCARGO` | N10.2 | suma de notas de débito aplicadas (en el documento) |
| `FABONO` | N10.2 | suma de aplicaciones recibidas (en el documento) |
| `FCONCEPTO` | C75 | texto libre; "CARGO POR FACTURACION" si lo escribe `ccmmov01` |
| `FVEND`, `FVEND2` | C3, C2 | vendedor del documento; quién cobró (en abonos) |
| `FPLAZO`, `FFPAGO` | N3, D | plazo y vencimiento |
| `FCANCELA` | D | fecha en que el saldo llegó a cero |
| `FTIPO` | C2 | forma de pago del abono (EF, CH, DE) |
| `FNUCHE`, `FBANCO`, `FCOBRO` | C10, C2, D | número de cheque, banco del cheque, fecha de cobro (postfechado) |
| `FLIQUI` | C9 | liquidación a la que pertenece un abono |
| `NRUTA`, `FQUEDAN`, `MOVAPLI`, `SUCURSAL`, `NUMENVI`, `MODELO` | — | casi sin uso (≤ 1 fila, salvo `MODELO` en 7 notas de débito) |
| `PORCOMI` | N5.2 | % de comisión (en 15,236 abonos) |
| `TRANSPORTE` | C60 | transportista (400 facturas) |
| `CONTADO`, `TRANSFER`, `QUIEN`, `BUTTER`, `EXISTEDTE` | L | abono por cancelación de contado (791), abono por transferencia (22,410), sin uso claro (`QUIEN` 21), marca de línea de producto (`BUTTER` 43,946 facturas + 412 cheques; significado por confirmar), nota de débito con DTE (5) |
| `ANULADA` | L | siempre falso: no se usa (la anulación reescribe `FCTA`) |
| `NSERIE` C13, `NRESOLU` C19 | | serie y resolución del documento (13,760 facturas, 335 notas) |
| `PESO`, `FLETE`, `SEGURO`, `FDESCU`, `PDESC`, `FDEVOL`, `DEVUELTO`, `DIAST`, `CTABANCO` C16 | | peso (facturas de inventario); `FLETE`, `SEGURO`, `FDESCU`, `PDESC`, `FDEVOL` valen 0 en todo el archivo; `DIAST` días de pago; `CTABANCO` en 18 abonos |
| `USUARIO`, `FECHAX`, `FECHAFA`, `FECHAA`, `NFACT` | | usuario que grabó y fechas auxiliares |

### 1.3 Cobranza operativa y comisiones (no son contabilidad)

| Tabla | Contenido | Registros |
|---|---|---|
| `LIQUIDA` | **Liquidaciones**: `NLIQUIDA` C9, `FTRAN` C2 (vendedor o transportista), `FECHALIQ`, `NDESPACHO`, `REMESA` N12.2, `CTABANCO` C16, `LIQUITRAN` L, `EFECTIVO`/`CHDIA`/`CHPOS`/`DEV` (siempre 0) | 11,031 |
| `COBRO`, `DETACOB` | Rutas de cobro: `NRUTA` C8, fecha, vendedor; detalle con la copia (`FCTA`, `FTMOV`, `FREF`, `FMON`) de los documentos | 2,200 / 55,281 |
| `DESPACHO`, `DETADES` | Rutas de despacho: transportista, vehículo, 3 ayudantes; detalle de documentos | 8,339 / 61,979 |
| `CCTRAN`, `CCVEH`, `AYUDANTE` | Transportistas, vehículos, ayudantes | 15 / 3 / 15 |
| `COMI2`, `COMVENT`, `COMISION`, `RENTA` | Comisiones y tramos de renta | 10 / 11 / 0 / 4 |
| `PVENDE`, `PCLIENTE`, `PVEND` | Presupuestos de ventas/cobros por vendedor, por cliente-visitador | 118 / 7,122 / 0 |
| `PCLIENT` | Precio por cliente y modelo (de inventario) | 1,017 |

### 1.4 Compartidas con otros módulos (no son de CxC)

- **CONTAC** (`CONTAC/dbf`): `PARTIDAS` (5,209), `DETAPART` (48,024), `CATALOGO` (618), `TIPOPAR` (10), `SALDOS` (11,730), `SALDOCC`; CxC escribe en `PARTIDAS`, `DETAPART`, `SALDOS` y `SALDOCC` (reglas §10).
- **INV64** (`INV64/DBF`): `CORFACT` (encabezado de factura, 56,378), `FACT` (líneas, 161,403), `DEVOL`/`CORDEV` (devoluciones, 2,410 / 2,176), `FELECTRO` (documentos tributarios electrónicos, 35,944), `FORMPAGO`. CxC solo las lee o les cambia el código de cliente.
- **IVA64** (`IVA64/dbf`): `IVAFIS` (libro de ventas), que se alimenta desde `CCMOV01` (reglas §11.2).
- **Plataforma** (`cxc64/FUENTE`): `EMPRESAS` (1 vigente), `usuarios` (2 vigentes), `PERFIL` (220), `USREMP`, `BITACORA` (23,455).
- **Bancos** (`BANCOC`, folder de CONTAC): `CTABANCO`, `MOVIBAN`; CxC solo referencia el código de cuenta (`LIQUIDA.CTABANCO`, `CCMOV01.CTABANCO`).

### 1.5 Tablas de trabajo, copias y vacías (no se migran)

- **Copias de `CCMOV01` en `FUENTE` con datos reales:** `CAL` (6,790), `REVISA` (2,743), `LORENA` (2,032), `WILDA` (2,031), `anti2` (904), `MOVIMI` (862), `cobroco2` (575), `VALIDA` (175), `SALDO` (24), `TABLAX` (6). También `CLIEN` (1,748, lista de clientes para impresión).
- **Trabajo por usuario/proceso:** `PPROV<nn>`/`DPROV<nn>` (16 usuarios; el posteador de partidas), `APLINUE`/`aplicanc` (aplicar NC; 4,644 marcados borrados), `TEMPC`, `TEMPOLIQ`, `PP`, `NUEVAT` (316, copia de `DESPACHO`), `WILDA` en `DBF` (1,569, copia de `DESPACHO`), `AUTOMA`, `DETA`, `PART`.
- **Vacías o sin uso:** `AUTOMA`, `CIERRE`, `COMISION`, `DETA`, `PVEND`, `TEMPOLIQ`; `ERROR`, `MSGERR` y `FoxyPreviewer_Settings` (de FoxPro).
- Archivos `.MEM` de configuración por empresa: `CXCCFG.MEM` (cuentas contables y parámetros de retención, ver abajo), `IVA.MEM` (tasa de IVA), `COMI.MEM`, `DESCU.MEM`, `CONFIG.MEM`, `CANTS.MEM` (números a letras), `MESES.MEM`, `MESACT.MEM`, `SEGUIR.MEM` (clave de cierre), `PAGOCO.MEM`.

**Configuración de CxC (`CXCCFG.MEM`, pantalla `config2`)** — solo se documenta qué es cada variable, no su valor: `cfg_iva_ccf` (cuenta de IVA débito de crédito fiscal), `cfg_iva_cfi` (cuenta de IVA de consumidor final), `cfg_iva_per` (IVA percibido),
`cfg_iva_re` (IVA retenido), `cfg_iva_cno` (cuenta para el IVA de las notas de abono), `cfg_flete`, `cfg_segu`, `cfg_costo`, `cfg_centro` (centro de costo), `cfg_conta` (integrado a contabilidad; **no se consulta**), `cfg_repetir` (permitir repetir el
número de recibo en otro cliente), `cfg_ivaper` (% de retención), `cfg_mper` (monto mínimo para retener). Además `EMPRESAS.GRANDE` (la empresa es gran contribuyente) y `EMPRESAS.FORMANC`/`FORMAND` (formatos de impresión de nota de crédito/débito).

### 1.6 Relaciones

```
EMPRESAS (rutas: CxC; CONTAC; INV64)
CCCLI01 ─FVEND→ CCVEND            CCCLI01 ─MATRIZ→ MATRIZ        CCCLI01 ─FTINEG→ TNEGOCIO   CCCLI01 ─CTA→ CATALOGO
CCCLI01 1─* CCMOV01 ─FTMOV→ CCTMOV ─CTA,CTA2,CCTAE→ CATALOGO
CCMOV01 (documento C0/C2/C3) 1─* CCMOV01 (aplicaciones A0/A1/A3/A5/A6; llave FNFAC+FTICOM+FCTA, MOV2 = tipo del destino)
CCMOV01 (documento C0)       1─* CCMOV01 (C4 notas de débito; FNFAC)
CCMOV01 (C3 cheque)          1─* CCMOV01 (A4 remesa; llave FREF+FBANCO+FCTA)
CCMOV01 (abono A0) *─1 LIQUIDA (FLIQUI = NLIQUIDA) ─NDESPACHO→ DESPACHO/COBRO ─detalle→ DETADES/DETACOB
LIQUIDA ─CTABANCO→ CTABANCO (Bancos)     CCMOV01 ─FBANCO→ BANCOS (de clientes)
CCMOV01 (C0) ─(FREF+FTICOM)→ CORFACT (inventario, NFACT_ENV+TIPOFAC) 1─* FACT (líneas)
CCMOV01 ─(fecha, tipo)→ [transferencia a petición] → IVAFIS (libro de IVA)
CCMOV01 ─(rango de fechas, sin llave)→ PARTIDAS 1─* DETAPART        (concepto "VENTAS DEL … AL …")
CIERREC (AAAAMM) ← consultada por toda pantalla de movimiento
```

## 2. Modelo propuesto — módulo `accounts-receivable` (`ar_`)

Reglas de la plataforma: tablas con prefijo, dinero como TEXT con dos decimales, sin DELETE (`is_active` o estado `voided`), fechas ISO, `empresa_id` en toda tabla de negocio, id de texto. **Sin tablas de saldos** ni columnas
`paid`/`balance`. Las líneas contables no se duplican: las partidas viven en `gl_journal_lines`. El espejo de cuentas por pagar (BANCOC §3) usa la misma forma (`ap_documents` + `ap_payment_applications`).

### `ar_customers`
| Columna | Origen |
|---|---|
| id, empresa_id | nuevo |
| code (C10) | `FCTA` |
| name, trade_name, legal_name | `FNCLI`, `NCOMERCIAL`, `NSOCIEDAD` |
| address, delivery_address, city, department_code, municipality_code, district_code, country_code | `FDCLI`, `FRES`, `FCITY`, `FDEP`, `FMUN`, `COD_MUNICI`, `COD_PAIS` |
| phone, fax, email, contact | `FTEL`, `FFAX`, `EMAIL`, `CONTACTO` |
| registry_no, tax_id (NIT), dui, passport, other_doc | `FREGIVA`, `FNIT`, `CEDULA`, `PASAPORTE`, `OTRODOC` |
| economic_activity_code, payment_form_code, person_kind (`natural\|juridica`), client_kind | `ACT_ECO`, `FORMPAGO`, `TIPOCLI`, `TCLIENTE` |
| is_large_taxpayer, is_exempt, is_cash_only, is_suspended, is_active | `GRANCLI`, `FEXENTO`, `CCONTADO`, `SUSPENDIDO`, `INACTIVO` (inactivo ⇒ `is_active = 0` y no se factura) |
| credit_limit, credit_days | `FLIMCRE`, `FPLAZ` |
| default_discount_pct, price_list | `DESCUENTO`, `NPRECIO` |
| classification | `FTIPC` |
| collection_day, collection_weeks (bits 1–4) | `FDCOB`, `FSEM1..4` |
| salesperson_id, business_type_id, group_id (casa matriz), visitor_id | `FVEND`, `FTINEG`, `MATRIZ`, `CODVI` |
| gl_account_id (cuenta de control, opcional) | `CTA` (en el legado casi todos la misma; propuesta: una cuenta por empresa en `ar_settings`, la del cliente solo si se quiere auxiliar) |
| commercial_references (texto o tabla `ar_customer_references`) | `REFE1..3` |
| legacy_code, created_at, updated_at | `FCTA`, `FFECING` |

Único `(empresa_id, code)`. **Se descartan** `FSALACT`, `FSANT`, `FSALANT`, `FCARM`, `FABOM`, `DIASP`, `VECESP`, `P90` (se calculan), `FFECUF/FMONUF/FFECUP/FMONUP/FULVENTA/FCOMP*/MCOMP*/NFACT*` (último movimiento: consulta),
`LIBERAR`, `BLOQUEDADO`, `TEMPORAL`, `NEWFLD`. No se puede desactivar un cliente con saldo (advertencia, no bloqueo; pregunta 5).

### `ar_customer_groups`, `ar_salespeople`, `ar_business_types`
`ar_customer_groups` (casa matriz): `code`, `name`, `notes` ← `MATRIZ`. `ar_salespeople`: `code` (C3), `name`, `is_collector`, `is_active`, `include_in_reports` ← `CCVEND` (`CENREPORTE`). `ar_business_types`: `code`, `name` ← `TNEGOCIO`.
El visitador (`VISITADO`) y los catálogos geográficos/giro/forma de pago/país del MH van a catálogos compartidos (`tax` o plataforma), no a `ar_`.

### `ar_document_types` y `ar_posting_accounts`
`ar_document_types`: `id`, `empresa_id`, `legacy_code` (C0, C4, A0…), `code`, `name`, `kind` (`invoice`, `debit_note`, `credit_note`, `receipt`, `check_postdated`, `check_rejected`, `internal_charge`, `internal_credit`, `remittance`, `advance`), `is_active`.
`ar_posting_accounts`: `type_id`, `role` (`sales_taxpayer`, `sales_final`, `sales_export`, `debit_note_sales`, `debit_note_other`, `returns`, `discounts`, `cash_bank`, `checks_postdated`, `checks_rejected`), `gl_account_id`. Origen: `CCTMOV.CTA/CTA2/CCTAE` (el rol sale del tipo y de la
posición, reglas §10.2). Las cuentas de IVA, flete y retención van en `ar_settings`/`tax_settings`.

### `ar_documents` — facturas, notas, cargos (el lado "cargo" y las notas de crédito)
| Columna | Origen |
|---|---|
| id, empresa_id | nuevo |
| type_id, kind | `FTMOV` |
| tax_kind (`C\|F\|E`) | `FTICOM` |
| number | `FREF` (sin ceros a la izquierda o con ellos: decisión de importación; guardar `legacy_number` tal cual) |
| series, resolution_no | `NSERIE`, `NRESOLU` |
| customer_id (nulo solo si `voided`) | `FCTA` |
| date, due_date, terms_days | `FFEC`, `FFPAGO`, `FPLAZO` |
| taxable, vat, exempt, vat_withheld, total | `FGRAV`, `FVALIVA`, `FEXEN`, `IVAPER`, `FMON` |
| applies_to_document_id | `FNFAC`+`FTICOM` en notas de débito (C4) y en el documento destino de las notas de crédito *aplicadas por una sola vez* (si no, `ar_applications`) |
| salesperson_id | `FVEND` |
| commission_pct | `PORCOMI` |
| source (`inventory\|manual\|import`), source_ref | origen: `inventory` = id de la factura de inventario |
| dte_generation_code, dte_control_no, dte_seal | de `FELECTRO` por factura |
| status (`open\|void`), void_reason, voided_at | `FCTA = 'ANULADA'/'ANULADO'` o monto 0 con ese texto |
| posting_batch_id | lote contable que lo contabilizó (nulo si falta) |
| legacy_ref | `FTMOV\|FREF\|FTICOM\|FCTA` |
| created_by, created_at, updated_at | `USUARIO` |

Único `(empresa_id, kind, tax_kind, number)` para facturas; `(empresa_id, type_id, number)` para notas. **No se guardan** `FCARGO`, `FABONO`, `saldo`, `FCANCELA`: `balance = total + Σ notas de débito aplicadas − Σ aplicaciones`; `settled_on` = fecha de la última aplicación cuando el saldo llega
a cero (se calcula). El IVA y la retención llegan ya calculados por el servicio de `tax` en el documento de origen; AR solo valida `taxable + vat + exempt − vat_withheld = total` (tolerancia 0.00).

### `ar_receipts` — el instrumento de cobro (abono A0, anticipo PA)
| Columna | Origen |
|---|---|
| id, empresa_id | nuevo |
| customer_id | `FCTA` |
| number | `FREF` (**no único**; ver §4) → se guarda como `legacy_number`; el nuevo número lo asigna AR por empresa |
| date | `FFEC` |
| method (`cash\|check\|deposit\|transfer`) | `FTIPO` (EF→cash, CH→check, DE→deposit) + `TRANSFER` |
| bank_id, check_number, post_dated_for, held_by | `FBANCO`, `FNUCHE`, `FCOBRO`, `FCONCEPTO` |
| amount | Σ de las aplicaciones (+ saldo no aplicado, si es anticipo) |
| collector_id | `FVEND2` |
| collection_batch_id | `FLIQUI` |
| commission_pct | `PORCOMI` |
| is_cash_sale_settlement | `CONTADO` |
| status (`active\|voided`) | — |
| posting_batch_id | lote contable |
| legacy_ref | `FLIQUI\|FREF\|FCTA` |

La importación agrupa las filas `A0` por `(FLIQUI, FREF, FCTA)` en un recibo (≈ 40,609 recibos para 57,183 filas).

### `ar_applications` — aplicación de un recibo o una nota a un documento
`id`, `empresa_id`, `document_id` (el cargo que se rebaja), `receipt_id` o `credit_document_id` (uno de los dos; también `internal_credit`), `amount`, `applied_on`, `kind` (`receipt`, `credit_note`, `internal_credit`, `remittance`), `legacy_ref`, `created_by`.
Origen: `A0`, `A1`/`A3`/`A6`, `A5` (con `FNFAC` + `FTICOM` + `FCTA`/`MOV2`) y `A4` (remesa sobre `C2`/`C3`). Una nota de crédito **sin aplicar** (252) no tiene aplicaciones: su saldo disponible es `total − Σ aplicaciones`. Una aplicación puede ser a un documento de otro cliente solo si
ambos clientes pertenecen al mismo grupo (46 casos en los datos).

### `ar_checks` y `ar_check_deposits` — cheques en cartera y remesas
`ar_checks` ← filas `C3` (y `C2` cuando es cheque devuelto): `receipt_id`, `bank_id`, `check_number`, `amount`, `due_on` (`FCOBRO`), `held_by`, `status` (`postdated`, `deposited`, `rejected`), `customer_id`. `ar_check_deposits` ← `A4`: `check_id`, `amount`, `deposited_on`, `bank_document_id`
(→ `bnk_documents` del depósito, nulo para el historial). Un cheque rechazado genera un cargo (`ar_documents.kind = check_rejected`) ligado a la factura original (`applies_to_document_id`).

### `ar_collection_batches` — liquidación de cobranza
`id`, `empresa_id`, `number` (9 caracteres), `date`, `collector_id`, `remittance_amount` (`REMESA`), `bank_account_id` (→ `bnk_accounts`, nulo si no se conoce), `bank_document_id`, `status`, `legacy_ref`. Origen: `LIQUIDA`. Las rutas de despacho/cobro, transportistas, vehículos y ayudantes **no** se migran (se guardan como archivo de consulta).

### `ar_posting_batches` — vínculo con el libro mayor
| Columna | Origen / uso |
|---|---|
| id, empresa_id | nuevo |
| kind (`sales\|returns\|credit_memos\|receipts\|remittances`) | los 5 procesos de Generación de Partida |
| date_from, date_to | rango (hoy solo está en el concepto de la partida) |
| entry_type_id | `TIPOPAR` elegido |
| gl_entry_id (→ `gl_journal_entries.id`) | la partida creada |
| concept, status (`draft\|posted\|voided`) | `m.con` |
| created_by, created_at | — |

`ar_posting_batch_items` (opcional): `batch_id`, `document_id` o `receipt_id` para **impedir contabilizar dos veces**. `gl_journal_entries.source = 'cxc'`, `source_ref = ar_posting_batches.id`. Para el historial, el importador crea un lote por cada partida del libro cuyo concepto coincida con los textos
del posteo (880 en CONTAC) con `status = 'posted'` y sin items (el vínculo es solo por rango; pregunta 14).

### `ar_settings`, `ar_periods`
`ar_settings` (una fila por empresa): `retention_rate` (`cfg_ivaper`), `retention_min_taxable` (`cfg_mper`), `allow_repeat_receipt_number` (`cfg_repetir`), `credit_limit_mode` (`none\|warn\|block`), `aging_buckets` (JSON `[30,60,90,120,150,180]`), `ar_control_account_id`,
`freight_account_id` (`cfg_flete`), `cost_center_id` (`cfg_centro`), `posting_mode` (`batch\|per_document`); las cuentas de IVA (`cfg_iva_ccf`, `cfg_iva_cfi`, `cfg_iva_per`, `cfg_iva_re`, `cfg_iva_cno`) y la tasa de IVA (`ivax`) van en `tax_settings`.
`ar_periods` (opcional): `period` (`AAAA-MM`), `closed_at`, `closed_by` ← `CIERREC`; mientras no exista cierre propio, AR consulta `gl_periods`.

### Qué cambiar en el scaffold existente (`modules/accounts-receivable`)
El scaffold (`schema.ts`, `manifest.ts`, `routes.ts`) es una plantilla genérica con **tres tablas y todas insuficientes**:
1. `arCustomers`, `arInvoices`, `arPayments` **no tienen `empresa_id`** ni `refs.ts` con las llaves foráneas hacia `core_empresas` y `coa_accounts`; `arPayments.invoiceId` es obligatorio (un pago a una factura) y no admite cobros que cubren varias facturas,
   notas de crédito sin aplicar, cheques postfechados, ni anticipos. Hay que reemplazarlas por el conjunto de arriba.
2. `arInvoices.amountPaid`, `status` y `amountPaid` guardan un saldo derivado: **se eliminan** (el saldo se calcula).
3. Faltan: impuestos (gravado/IVA/exento/retención), vendedor, plazo, tipo de comprobante C/F/E, serie/resolución, DTE, grupo (casa matriz), liquidaciones, lotes de posteo y configuración.
4. `manifest.ts`: `dependsOn` debe incluir `chart-of-accounts` y `general-ledger` y, por la integración, `banking` y `tax` (opcionales); los permisos usan los roles viejos (`owner/admin/member`) en lugar de `capture/reports/supervise`; `navItems` debe tener
   las pantallas de §3 del README (clientes, documentos, recibos, liquidaciones, antigüedad, contabilización).
5. `routes.ts` solo tiene comentarios; las rutas útiles son `customers`, `documents` (+ `from-inventory`), `receipts`, `applications`, `collection-batches`, `aging`, `statements`, `posting-batches`.
6. Los módulos no se importan entre sí: el posteo al libro mayor y la publicación desde inventario necesitan un **contrato compartido** en `@accounting/shared` (`PostEntryRequest` con `source`, `sourceRef`) y una entrada `cxc` en `GL_ENTRY_SOURCES`.
7. Respetar las reglas de `docs/module-guide.md`: cada archivo ≤ 200 líneas (el schema se divide en `schema/customers.ts`, `documents.ts`, `receipts.ts`, `posting.ts`), contratos Zod en `packages/shared/src/accounts-receivable.ts`, pruebas en `apps/api/tests/accounts-receivable`.

### Cómo se enlaza cada documento con su partida en el GL
1. **Contabilizar** (equivale a "Generación de Partida"): el usuario elige el tipo de proceso y el rango; AR crea un `ar_posting_batches` en borrador con las líneas calculadas (editables), y al aplicarlo llama al GL con `source = 'cxc'` y
   `source_ref = batch.id`; la partida nace `aplicada`. El `gl_entry_id` se guarda en el lote en la **misma transacción**; los documentos y recibos del lote guardan `posting_batch_id`.
2. **Anular un lote:** anula la partida (soft delete, número retenido) y limpia `posting_batch_id` de sus documentos; el GL rechaza anular o editar directo una partida `cxc`.
3. **Anular un documento ya contabilizado:** exige anular primero el lote (o generar una partida de reverso) y deja bitácora.
4. **Vínculo con Bancos:** `ar_collection_batches.bank_document_id` y `ar_check_deposits.bank_document_id` apuntan a los documentos de depósito de `banking`; el recibo en efectivo/cheque acredita al cliente, el depósito de Bancos debita la cuenta bancaria
   y el GL reconcilia por la cuenta de caja/cheques en tránsito.

## 3. Mapeo del importador (CCMOV01 → tablas nuevas)

| `FTMOV` | Filas | Destino |
|---|---|---|
| `C0` | 56,774 | `ar_documents` (invoice); `FCTA = 'ANULADA'` (2,384) → `status = 'void'`, `customer_id` nulo, número y fecha conservados |
| `C4` | 8 | `ar_documents` (debit_note) con `applies_to_document_id` |
| `C2` | 1 | `ar_documents` (check_rejected) |
| `C3` | 615 | `ar_checks` (postdated) con su estado según las remesas |
| `C6` | 0 | `ar_documents` (internal_charge) |
| `A0` | 57,183 | `ar_receipts` (agrupados por liquidación + número + cliente) + `ar_applications` |
| `A1`, `A3`, `A6` | 2,233 / 84 / 2 | `ar_documents` (credit_note) + `ar_applications` si `FNFAC` no está vacío (252 quedan sin aplicar); `FCTA = 'ANULADO'` (45) → void |
| `A4` | 625 | `ar_check_deposits` + aplicación al cheque |
| `A5` | 128 | `ar_documents` (internal_credit) + `ar_applications` |
| `PA`, `A7`, `A8`, `C5`, `CR`, `A2` | 0 | sin registros; el importador acepta y reporta |
| (vacíos) | 3 | se omiten y se reportan |

Además: `CCCLI01` → `ar_customers`; `MATRIZ`, `CCVEND`, `TNEGOCIO` → catálogos; `CCTMOV` → `ar_document_types` + `ar_posting_accounts` (con validación contra el plan de cuentas); `LIQUIDA` → `ar_collection_batches`; `CIERREC` → `ar_periods`.

## 4. Notas de migración

### Codificación
`CCCLI01`, `CCMOV01`, `CCTMOV`, `LIQUIDA`, `COBRO`, `DETACOB`, `CCVEND`, `BANCOS`, `TNEGOCIO` y los catálogos de MH traen la marca de página `0x03` (Windows-1252). Sin marca (`0x00`): `CIERREC`, `MATRIZ`, `PAIS`, `VISITADO`, `INEMPRE`, `MOVI`, `PP`, `TEMPC` → decidir por contenido
(cp1252 salvo caracteres imposibles, luego cp850), igual que CONTAC. **Ninguna tabla de CxC tiene memos** (no hay `.FPT` para los campos de cartera).

### Qué datos sucios esperar (medido en la empresa disponible)
| Hallazgo | Tratamiento |
|---|---|
| 3 filas de `CCMOV01` con tipo vacío/nulo y fechas nulas; 12–15 con fecha vacía; 5 con fecha anterior a 2017 (2013–2016) | Reportar y omitir las de tipo vacío; las demás se importan con aviso |
| `FCTA = 'ANULADA'` (2,384 C0) y `'ANULADO'` (45 NC), 1 código mal formado | Importar como documentos anulados sin cliente (el número se conserva para los libros); reportar |
| 47 filas de movimientos con cliente que no existe en `CCCLI01` (45 anulados + 2) | Reportar los 2; crear cliente provisional "(cliente no encontrado en el sistema anterior)" si tienen saldo |
| 2 códigos de cliente repetidos entre los 1,792 vigentes | Detener el import de clientes hasta decidir cuál conserva; reportar |
| Números de abono repetidos: 799 números aplicados a más de un cliente y 189 a más de una liquidación; un número cubre hasta 544 filas | Agrupar por `(FLIQUI, FREF, FCTA)`; `legacy_number` no único; reportar |
| 7 notas de crédito (A1) aplicadas a una factura que no existe; 9 remesas (A4) sin cheque `C2/C3`; 1 cheque duplicado | Importar la nota como **sin aplicar** y reportar; la remesa como depósito sin cheque |
| 46 aplicaciones de nota de crédito a una factura de **otro cliente** (misma casa matriz) | Permitir (regla de matriz); validar que ambos pertenezcan al mismo grupo |
| 8 facturas con saldo negativo (sobrepago) | Importar tal cual; saldo a favor; reportar |
| 3,000 facturas con monto cero (2,384 anuladas + 616 con cliente real) | Importar; las anuladas como `void` |
| 42 facturas donde `total ≠ gravado + IVA + exento − retención` (±0.02) | Importar con `FMON` como total y aviso |
| `FABONO` y `FCARGO` almacenados vs aplicaciones | **Cuadran en las 56,774 facturas** (0 diferencias); el chequeo debe pasar en el importador (si alguna difiere se detiene) |
| 252 notas de crédito sin aplicar | Se importan como saldo a favor disponible |
| 505 facturas existen solo en CxC y 17 solo en inventario (`CORFACT`); 56,269 están en ambos | Comparar con inventario antes de importar; las manuales de CxC no tienen contraparte |
| Cuenta contable del cliente: 1,786 comparten una; `CCTMOV` y `config2` apuntan a cuentas que en su mayoría no existen en el `CATALOGO` de CONTAC del disco (la copia llega a 2024-03) | Validar contra el plan de cuentas **vigente** y reportar las inexistentes; no inventar cuentas |
| Registros marcados como borrados en el DBF | No se importan (igual que CONTAC): `CCMOV01` 786, `CCCLI01` 8, `DETACOB` 481, `DETADES` 10,065, `LIQUIDA` 16 |
| `BUTTER` (43,946 facturas) | Preguntar qué significa antes de descartarlo (pregunta 22); se guarda como atributo |

### Enlace con el importador del GL
El importador de CONTAC deja `source = 'importado'` y `source_ref = salfec|tipopar|numero`. El importador de CxC busca las partidas de ventas/abonos por el concepto (`VENTAS DEL …`, `ABONOS DE CLIENTES DEL …`, `DEVOLUCIONES …`, `REMESAS POR CHEQUES …`) y, como **única excepción
permitida**, cambia `source` a `'cxc'` y `source_ref` al id del lote en la misma transacción (pregunta 14). Los textos de las líneas históricas no coinciden con los del código actual (otra versión del programa); el enlace es por el **concepto de la partida**, no por el texto de las líneas.

### Chequeo de paridad (debe cuadrar al centavo)
1. **Saldo por documento:** `total + Σ nd − Σ aplicaciones` nuevo = `CCMOV01.FMON + FCARGO − FABONO` del legado para las 56,774 facturas (hoy cuadra por construcción).
2. **Saldo por cliente:** `Σ` de documentos abiertos − notas sin aplicar nueva = la del legado recalculada con el mismo criterio de §7.1 de las reglas (incluye `C2/C3` abiertos). `CCCLI01.FSALACT` es 0 en todos y **no sirve de referencia**.
3. **Antigüedad** (`ccranti2`, tramos 0–30, 31–60, 61–90, 91–120, ≥ 121 por fecha del documento) a la fecha de corte del último cierre (2024-04) y a una fecha reciente, contra el reporte impreso del sistema viejo.
4. **Conteos:** 56,774 + 8 + 1 + 615 documentos de cargo; 2,319 notas de crédito (252 sin aplicar); 57,183 abonos en ~40,609 recibos; 625 remesas; 128 abonos internos; 1,792 clientes; 16 vendedores; 18 matrices; 16 tipos de movimiento; 11,031 liquidaciones (menos marcados).
5. **Totales por mes** de ventas netas, IVA, retención, devoluciones y cobros contra el libro de IVA (`IVAFIS`) y contra las partidas "VENTAS DEL…"/"ABONOS DE CLIENTES…" del libro mayor (solo hasta 2024-03: hay partidas de CxC en el libro de CONTAC del disco, 880).
6. **Contra inventario:** `ar_documents.total` = `CORFACT.TOTALT` en las 56,269 facturas presentes en ambos (hoy difieren 4 no anuladas).
7. **Cuenta de control:** el saldo de la cuenta de clientes en el GL = saldo de cartera + cheques postfechados en cartera (cuando los hay) al cierre de cada mes. No se espera que cuadre con el libro de CONTAC del disco (periodo y plan de cuentas distintos); sí con el libro que se importe junto con CxC.
