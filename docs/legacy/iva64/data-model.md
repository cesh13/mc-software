# IVA64 — Modelo de datos

Estructura, llaves y conteos salen de los `.DBF` reales (`MCERP/IVA64/dbf` y `MCERP/IVA64/fuente`) y del catálogo de índices `ARCHIVOS.DBF`.
Conteos = registros vivos (sin marcados como borrados); entre paréntesis, los marcados como borrados. No se copió ningún dato de cliente.
Codificación: la marca de página de código del encabezado del `.DBF` es `0x02` en `COMPRAS` e `IVAFIS` (cp850), `0x03` en `ivafac`, `CLIENTES`
y `CONTRIBU` (cp1252) y `0x00` en los catálogos y `RENTAT` (cp850 según el playbook).

## 1. Tablas legadas

### Propias del módulo (`MCERP/IVA64/dbf`)

| Tabla | Contenido | Campos clave | Registros |
|---|---|---|---|
| `COMPRAS` | **Libro de compras** (también compras a excluidos y renglones de retención) | `fcomp` C10 (documento) + `fregi` C14 (NRC) + `ftipo` C2 (llave natural, índice `fcomp`); `ffec` D, `salfec` C6 (mes del libro); `intex`/`intgr`/`ivaint` N12.2 (internas), `impex`/`impgr`/`ivaimp` (importaciones), `interexen`/`intergrav`/`impgravs` (anexo; sin uso), `ivaper`, `ivare`, `ivarete`, `ivar`, `ivaant`, `cotrans`, `fovial`, `otrosi`, `totalc`; `fnom` C40; `compra`/`retencion`/`excl`/`anulada`/`transf`/`cerrado` L; `nretencion` C10 (índice `nretencion`); `gravaexcl`/`ivaexcl`/`renexcl`; `nresolu` C19, `nserie` C13, `npimp` C9; `clasedoc` N1, `tipoope`/`clasific`/`sector`/`tipocosto` N1; `codgenera` C40, `ncontrol` C40, `sellor` C40; `concepto` C100, `sucursal` C10 | **19,494** (591) |
| `IVAFIS` | **Ventas a contribuyentes** (crédito fiscal, notas, retenciones) | `fcomp` C10 + `ftipo` C2 + `fregi` C14 (índice `fcomp`); `ffec`, `salfec`; `fexpo`/`fviex`/`fvgne`/`fvgiv` N11.2; `ivaper`, `ivare`, `ivaant`; `totalv` N12.2; `fnom` C30; `nserie`, `nresolu` C40; `codgenera`, `ncontrol`, `sellor` C40; `corre` N10; `transf`/`cerrado` L; `ftmov` C2 (sin uso); `sucursal`, `fpago` (sin uso) | **47,516** (18,298) |
| `ivafac` | **Ventas a consumidor final**, resumen diario por rangos | `fcomp1` + `fcomp2` C10 (índice `venta`); `ffec`, `salfec`; `ftipo`; `fvexen`/`fvgra` N11.2 (exentas / gravadas brutas), `exporta`, `totexp`, `vexensuje`, `vnsujeta`, `vexpdentro`, `vexpservi`, `vzonaf`, `vtercer`; `totalv`; `nresolu` C19, `nserie` C13, `nmaquinar` C14; `codgenera`/`ncontrol` (primero) y `codgeneraf`/`ncontrolf` (último) C40; `transf`/`cerrado` L | **802** (247) |
| `CONTRIBU` | Maestro de proveedores/contribuyentes | `fregi` C14 (NRC, llave), `fnom` C60, `fnit` C17, `fdirec` C50, `fdep` C2, `fmun` C2, `actividad` C50, `tipoc` N1, `grancon` L, `nresolu` C19, `nserie` C13, `dui` C10, `act_eco` C10 | **610** |
| `CLIENTES` | Maestro de clientes | `fregi` C14 (llave), `fnom` C60, `fnit` C17, `fdirec`, `fdep`, `fmun`, `actividad`, `tipoc` N1, `cta` C14, `grancli` L, `dui` C15, `act_eco` C10, `email` C80, `ftel` C25 | **1,158** (1) |
| `RENTAT` | **Renta retenida** | `fcomp` C10 + `nit` C14 (índice `nit`), `fnom` C50, `ffec`, `montog` N12.2 (base), `renta`, `salfec`, `afp`, `isss` (sin uso), `codigoi` C2 (código de ingreso) | **3** |
| `RENTA` | Versión anterior de `RENTAT` (misma estructura sin `afp`/`isss`/`codigoi`) | — | 0 |
| `CCDEP01`, `CCMUN01` | Departamentos (`fpais` C1, `fdep` C2, `fdes` C30) y municipios (`fdep` C2, `fmun` C3, `fdes` C30) | — | 24 (2) y 287 |
| `PPROVB06`, `DPROVB06` | Tablas de trabajo de partidas (copiadas de CONTAC) | — | 0 |
| `*.BAK` (`COMPRAS`, `CLIENTES`, `CONTRIBU`, `IVAFIS`, `ivafac`) | Respaldos | — | ignorar |

### Del sistema (`MCERP/IVA64/fuente`)

| Tabla | Contenido | Registros |
|---|---|---|
| `EMPRESAS` | Empresa: rutas (`camino`, `integra`, `integrap`, `rutainv`), `nit`, `registro`, `grande`, `moneda`, series/resoluciones de CF, FA y excluidos, `formaexcl`, `act_eco`, `fdep`, `fmun`, `email` | 1 |
| `CCTMOV` | Tipos de movimiento: `ctmov` C2, `cdes` C30, cuatro cuentas contables (`ccta`, `cctae`, `cta`, `cta2`; **ninguna se usa** en IVA64) | 18 |
| `USUARIOS`, `USREMP`, `PERFIL`, `BITACORA` | Sistema compartido de usuarios y auditoría | 2 (40), 4 (5), 88 (46), 335 |
| `MSGERR`, `ARCHIVOS` | Mensajes de error (37) y catálogo de índices (13) | — |
| `LIBROCF`, `LIBROVE` | Tablas de trabajo viejas con un solo mes (2013 y 2015); **no se migran** | 1,679 y 118 |
| `IVAVENC`, `IVA`, `FACTURA` | Estructuras de trabajo de libros anteriores, vacías | 0 |

### Archivos `.MEM` que forman parte del modelo

| Archivo | Contenido (nombres, no valores) |
|---|---|
| `IVA.MEM` (en `fuente`, global) | `ivax` (tasa de IVA) junto con el resto del entorno que dejó `SAVE TO iva` |
| `IVACFG.MEM` (por empresa, en `dbf`) | `cfg_iva`, `cfg_ivare`, `cfg_ivape`, `cfg_ivaan`, `cfg_iva_cf`, `cfg_iva_db`, `cfg_iva_re` |
| `FIRMAS.MEM` | Arreglo `firmas`: nombre y cargo de quien firma el libro |
| `MESACT.<usuario>` | Mes de trabajo por usuario (uno por usuario/empresa) |
| `CANTS.MEM`, `MESES.MEM`, `DRIVE.MEM`, `EMPRESA.MEM`, `B??.MEM` | Cantidades en letras, nombres de meses, unidad y sesiones: no se migran |

### De otros módulos (solo lectura desde IVA64)

| Tabla | Carpeta | Para qué se lee |
|---|---|---|
| `CCMOV01` (117,656 vivos) | `MCERP/cxc64/DBF` | Movimientos de CxC: `ftmov`, `fticom`, `fref`, `fnfac`, `fcta`, `fmon`, `fvaliva`, `fexen`, `fgrav`, `ivaper`, `ffec`, `nserie`, `nresolu` — fuente de las ventas |
| `CCCLI01` (1,792) | `MCERP/cxc64/dbf` | Clientes de CxC (`fregiva` = NRC, `fnit`, `fncli`, `fres`, `cedula`, `act_eco`, `ftel`, `grancli`) — se copia a `CLIENTES` |
| `FELECTRO` (35,944; 7,403 borrados) | `MCERP/INV64/DBF` | **DTE emitidos** (más de 120 columnas: `tipodte`, `ncontrol`, `codgenerac`, `sellore`, `fecemi`, totales, receptor…). IVA64 solo toma `codgenerac`, `ncontrol`, `sellore` por `nfact_env + tipo` |
| `DATAMOV` (57,597) | `MCERP/INV64/DBF` | Movimientos de inventario: `nfact_env`, `fecha_mov`, `tipo_mov`, `proveedor`, `gravado`, `exenta`, `iva`, `vtotal`, `siiva`… — fuente de compras por inventario |
| `QUEDAN` (204), `NCREDEB` (8), `PROVEDOR` (73) | `MCERP/CONTAC/dbf` | Documentos por pagar y notas de crédito/débito de CxP (ver [bancoc/data-model.md](../bancoc/data-model.md)) |
| `LIBCOMP` (0), `IVA` (0), `COMPROB` (4) | `MCERP/CONTAC/dbf` | `LIBCOMP` e `IVA` son estructuras viejas **vacías** del libro (CONTAC/BANCOC); `COMPROB` es el catálogo de tipos de comprobante de CxP |

Tablas que **no** existen en la copia aunque el código las usa: `CORREN` (correlativo de renta) [D].

### Índices y llaves (de `ARCHIVOS.DBF` y de los `USE … ORDER TAG`)

`COMPRAS`: `fcomp = FCOMP+FREGI+FTIPO`, `ffec = DTOC(FFEC,1)+FREGI+FCOMP`, `salfec`, `nretencion`, `fcomp2 = FCOMP`.
`IVAFIS`: `fcomp = FCOMP+FTIPO+FREGI`, `salfec`, `ffec = DTOC(FFEC,1)+FCOMP`. `ivafac`: `venta = FCOMP1+FCOMP2`, `salfec`, `ffec`.
`CONTRIBU`/`CLIENTES`: `fregi` (también `fnit` en CONTRIBU para renta). `RENTAT`: `nit` (y `nit2`).
Ninguna de estas llaves está declarada como única en VFP: la unicidad la vigila el formulario (y por eso hay repetidos, §3).

### Relaciones

```
EMPRESAS 1─1 (carpeta de datos)               EMPRESAS.integra ─→ cxc64\dbf    (CCMOV01, CCCLI01)
                                              EMPRESAS.integrap ─→ contac\dbf  (QUEDAN, NCREDEB, PROVEDOR)
                                              EMPRESAS.rutainv ─→ inv64\dbf    (DATAMOV, FELECTRO)
CONTRIBU 1─* COMPRAS (fregi)      ─ftipo→ CCTMOV
CLIENTES 1─* IVAFIS  (fregi)      ─ftipo→ CCTMOV
ivafac   (sin cliente; resumen)   ─ftipo→ CCTMOV
CONTRIBU 1─* RENTAT  (nit = fnit)
COMPRAS 1─0..1 COMPRAS  (retención: fcomp del renglón R = nretencion del documento)
CCDEP01 1─* CCMUN01 ;  CONTRIBU/CLIENTES ─(fdep, fmun)→ CCDEP01/CCMUN01
CCMOV01 ─→ IVAFIS / ivafac (transferencia; sin llave guardada; solo fcomp+ftipo)
QUEDAN / NCREDEB ─→ COMPRAS (transferencia; sin llave guardada)
FELECTRO ─(nfact_env + tipo)→ IVAFIS.codgenera/ncontrol/sellor (copia)
```

**Importante:** ninguna fila de `COMPRAS`/`IVAFIS`/`ivafac` guarda el identificador del documento origen (QUEDAN, CCMOV01, partida del GL, movimiento bancario). La trazabilidad hacia atrás sólo existe por coincidencia de número.

## 2. Modelo propuesto — módulo `tax` (`tax_`)

Reglas de la plataforma: tablas con prefijo, dinero como TEXT con dos decimales (`'1234.50'`), sin DELETE (`is_active` / estado `voided`),
fechas ISO, períodos `AAAA-MM`, `empresa_id` en toda tabla de negocio, ids de texto, ningún archivo de más de 200 líneas.
**Sin tablas de saldos**: los totales de los libros y de las declaraciones se calculan desde los documentos.
Los documentos de otros módulos se referencian por `source_module` + `source_ref`; no hay llaves foráneas entre módulos (solo el id de texto).

### `tax_settings` (una fila por empresa; sustituye `IVA.MEM`, `IVACFG.MEM`, campos de `EMPRESAS`)
| Columna | Origen |
|---|---|
| empresa_id (único), valid_from | nuevo (vigencia por fecha) |
| vat_rate | `ivax` (global → por empresa) |
| vat_withholding_rate | `cfg_ivare` |
| vat_perception_rate | `cfg_ivape` |
| vat_advance_rate | `cfg_ivaan` |
| is_large_taxpayer | `EMPRESAS.GRANDE` |
| perception_min_base (sales) | constante `100` de `ivamfis2` |
| consumer_final_threshold | constante `200` de los F987 |
| income_default_rate | constante `0.10` de renta y excluidos |
| nit, nrc, economic_activity_code, department, municipality, email | `EMPRESAS.NIT`, `REGISTRO`, `ACT_ECO`, `FDEP`, `FMUN`, `EMAIL` |
| gl_vat_credit_account_id, gl_vat_debit_account_id, gl_vat_withheld_account_id, gl_vat_perceived_account_id, gl_income_tax_account_id | `cfg_iva_cf`, `cfg_iva_db`, `cfg_iva_re` (y las de Bancos `cfg_iva_pe`, `cfg_renta`); validadas (existen, de detalle) |
| signers (json: nombre y cargo) | `FIRMAS.MEM` |
| created_at, updated_at | nuevo |

### `tax_series` (series y resoluciones por tipo de documento)
`id`, `empresa_id`, `document_kind` (`consumer_final`/`credit_fiscal`/`excluded`), `series`, `authorization_no`, `valid_from`, `valid_to`, `is_active`.
Origen: `EMPRESAS.FASERIE/FARESOLU`, `CFSERIE/CFRESOLU`, `EXSERIE/EXRESOLU`. Único `(empresa_id, document_kind, series, authorization_no)`.

### `tax_taxpayers` (une `CONTRIBU` y `CLIENTES`)
| Columna | Origen |
|---|---|
| id, empresa_id | nuevo |
| kind (`supplier`/`customer`/`both`) | nuevo (por qué tabla venía) |
| nrc | `fregi` |
| nit | `fnit` (sin guiones) |
| dui | `dui` |
| name | `fnom` |
| address, department_code, municipality_code | `fdirec`, `fdep`, `fmun` |
| activity, economic_activity_code | `actividad`, `act_eco` |
| is_foreign | `tipoc` (a confirmar) |
| is_large_taxpayer | `grancon` / `grancli` |
| default_authorization_no, default_series | `nresolu`, `nserie` (solo proveedor) |
| email, phone | `email`, `ftel` |
| supplier_id, customer_id (texto, sin FK) | enlace a `ap_suppliers` / `ar_customers` |
| is_active, created_at, updated_at | nuevo |

Único `(empresa_id, nrc)` donde `nrc` no es vacío. Clientes sin NRC (2,395 ventas lo tienen vacío) se identifican por `nit` o `dui` y `nrc` nulo.

### `tax_document_types`
`id`, `empresa_id`, `legacy_code` (`C0`, `A1`…), `name`, `sign` (`+1`/`−1`: los `A*` son −1), `book` (`purchases`/`sales_credit`/`sales_consumer`), `annex_document_code` (`03`, `05`, `06`, `01`, `11`, `12`…), `is_active`. Único `(empresa_id, legacy_code, book)`.
Origen: `CCTMOV` más los mapeos de `genarchi`.

### `tax_purchases` (libro de compras; origen `COMPRAS`)
| Columna | Origen |
|---|---|
| id, empresa_id | nuevo |
| period (`AAAA-MM`) | `salfec` |
| document_date | `ffec` (puede ser anterior al período; nunca posterior) |
| document_type_id | `ftipo` |
| number | `fcomp` |
| taxpayer_id | `fregi` → `tax_taxpayers` (creando el tercero faltante) |
| taxpayer_name_snapshot | `fnom` |
| kind (`normal`/`excluded`/`withholding_voucher`) | `excl` / `retencion` |
| is_purchase (frente a gasto) | `compra` |
| internal_exempt, internal_taxable, internal_vat | `intex`, `intgr`, `ivaint` |
| import_exempt, import_taxable, import_vat | `impex`, `impgr`, `ivaimp` |
| internment_exempt, internment_taxable, import_services | `interexen`, `intergrav`, `impgravs` |
| vat_perceived, vat_withheld, vat_advance | `ivaper`, `ivare` (o `ivar` en el renglón R), `ivaant` |
| cotrans, fovial, other_taxes | `cotrans`, `fovial`, `otrosi` |
| excluded_base, excluded_vat, excluded_income_withheld | `gravaexcl`, `ivaexcl`, `renexcl` |
| total | `totalc` (**se calcula y se compara con el original**, §3) |
| withholding_voucher_no | `nretencion` (único por empresa cuando no es nulo) |
| authorization_no, series, internal_correlative | `nresolu`, `nserie`, `npimp` |
| document_class (`printed`/`unique_form`/`other`/`dte`) | `clasedoc` 1–4 |
| operation_type, cost_class, sector, cost_type | `tipoope`, `clasific`, `sector`, `tipocosto` |
| dte_generation_code, dte_control_number, dte_seal | `codgenera`, `ncontrol`, `sellor` |
| source_module, source_ref, source_hash | `transf` + (nuevo) — `cxp`/`inventory`/`bank`/`manual`/`csv`/`dte_json` |
| gl_entry_id | partida del GL cuando el documento se originó en "Ingresar al IVA" |
| concept | `concepto` |
| status (`active`/`voided`) | borrado → `voided`; `anulada` |
| created_by, created_at, updated_at | nuevo / bitácora |

Únicos: `(empresa_id, document_type_id, taxpayer_id, number, dedupe_seq)` (`dedupe_seq` = 0 salvo duplicados del legado, §3); `(empresa_id, dte_generation_code)` parcial donde no es nulo; `(empresa_id, withholding_voucher_no)` parcial. Índice `(empresa_id, period)`.

### `tax_sales_invoices` (ventas a contribuyentes; origen `IVAFIS`)
| Columna | Origen |
|---|---|
| id, empresa_id, period, document_date, document_type_id, number, taxpayer_id, taxpayer_name_snapshot | `salfec`, `ffec`, `ftipo`, `fcomp`, `fregi`, `fnom` |
| exports, exempt, taxable, vat | `fexpo`, `fviex`, `fvgne`, `fvgiv` |
| vat_perceived, vat_withheld_by_customer, vat_advance | `ivaper`, `ivare`, `ivaant` |
| total | `totalv` (se recalcula: `exports + exempt + taxable + vat + vat_perceived`) |
| authorization_no, series | `nresolu`, `nserie` |
| dte_generation_code, dte_control_number, dte_seal | `codgenera`, `ncontrol`, `sellor` |
| source_module (`ar`/`manual`/`csv`/`dte_json`), source_ref, source_hash | `transf` + nuevo (id del movimiento de CxC) |
| status, created_by, created_at, updated_at | nuevo |

Único `(empresa_id, document_type_id, number, taxpayer_id, dedupe_seq)`; DTE único parcial. `fregi` vacío → `taxpayer_id` nulo con nombre guardado.

### `tax_sales_daily_summaries` (consumidor final; origen `ivafac`)
`id`, `empresa_id`, `period`, `document_date` (`ffec`), `document_type_id`, `number_from`/`number_to` (`fcomp1`/`fcomp2`), `exempt` (`fvexen`), `exempt_non_subject_proportion` (`vexensuje`), `non_subject` (`vnsujeta`), `taxable_gross` (`fvgra`, **con IVA incluido**), `exports_outside` (`exporta`), `exports_inside` (`vexpdentro`), `exports_services` (`vexpservi`), `free_zone` (`vzonaf`), `third_party` (`vtercer`), `total` (`totalv`, recalculado con **una** fórmula), `authorization_no`, `series`, `dte_generation_code_from/to`, `dte_control_number_from/to`, `source_module`/`source_ref` (CxC; rango de movimientos), `status`, auditoría.
Único `(empresa_id, document_type_id, document_date, number_from, number_to)`.
El IVA del mes **no se guarda**: lo calcula el servicio de libros.

### `tax_income_withholdings` (renta retenida; origen `RENTAT`)
`id`, `empresa_id`, `period`, `voucher_no` (`fcomp`), `voucher_date` (`ffec`), `taxpayer_id` (por `nit`), `taxpayer_name_snapshot`, `income_code` (`codigoi` → `tax_income_codes`), `taxable_base` (`montog`), `income_tax_withheld` (`renta`), `afp`, `isss` (columnas informativas, sin captura), `source_module`/`source_ref` (CxP/Bancos), `status`, auditoría. Único `(empresa_id, voucher_no, taxpayer_id)`.
Los comprobantes se numeran con `tax_sequences` (reemplaza `CORREN`).

### `tax_income_codes` y `tax_sequences`
`tax_income_codes`: `id`, `empresa_id`, `code` (2), `name`, `rate`. `tax_sequences`: `id`, `empresa_id`, `kind` (`income_voucher`/`vat_withholding_voucher`), `next_number`, `width`. Único `(empresa_id, kind)`.

### `tax_periods`
`id`, `empresa_id`, `period`, `status` (`open`/`closed`/`filed`), `closed_at`, `closed_by`, `filed_at`, `filed_ref`. Único `(empresa_id, period)`.
Sustituye la columna `cerrado` repetida en cada fila de las tres tablas.

### `tax_export_runs` (bitácora de archivos para Hacienda)
`id`, `empresa_id`, `kind` (`annex_purchases`/`annex_credit_fiscal`/`annex_consumer`/`annex_excluded`/`vat_withholding`/`vat_perception`/`f930`/`f910`/`f987`), `period_from`, `period_to`, `file_name`, `sha256`, `rows`, `totals` (json: bases e IVA), `generated_by`, `generated_at`. Permite repetir la comparación contra el libro y detectar cambios posteriores.

### Cómo se enlaza con el GL y los otros módulos
1. Por defecto **`tax` no escribe en el GL** (como el sistema anterior). La partida de la compra o venta la crea su módulo de origen (Bancos/CxP/CxC) y `tax` guarda `gl_entry_id` cuando el documento llega con él.
2. "Ingresar al IVA" desde la partida o el documento bancario: el GL (o Bancos) llama a `POST /api/tax/purchases` con `source_module = 'gl'|'banking'` y `source_ref`; `tax` rechaza duplicados por `(source_module, source_ref)`.
3. Sincronizaciones (CxP, CxC, inventario): jobs idempotentes por `source_ref`; `source_hash` detecta cambios; los documentos transferidos no se borran, se anulan si desaparecen del origen.
4. Opcional (pregunta 5): asiento de liquidación del período con `source = 'iva'`, `source_ref = tax_periods.id`.

## 3. Notas de migración

### 3.1 Qué se importa
- `COMPRAS`, `IVAFIS`, `ivafac`, `CONTRIBU`, `CLIENTES`, `RENTAT`, `CCDEP01`, `CCMUN01`, `CCTMOV`; configuración de `IVACFG.MEM`, `IVA.MEM` y `FIRMAS.MEM`; series de `EMPRESAS`.
- **No** se importan: filas con marca de borrado, `*.BAK`, `LIBROCF`, `LIBROVE`, `IVAVENC`, `FACTURA`, `IVA`, `RENTA`, `LIBCOMP` (vacía), `PPROVB06`, `DPROVB06`, ni archivos `B??.MEM`.
- Conversión de código de página por tabla (arriba). Los nombres de columna se pasan a minúsculas; los `L` a booleanos; las fechas vacías a `NULL`.

### 3.2 Datos sucios encontrados (se importan tal cual y se reportan)

| Hallazgo | Cantidad | Tratamiento |
|---|---|---|
| `COMPRAS` con llave `fcomp+fregi+ftipo` repetida entre filas vivas | 167 llaves | `dedupe_seq` 1, 2, … y reporte para que el negocio decida si es un doble registro |
| `IVAFIS` con llave `fcomp+ftipo` repetida | 4 | igual |
| Compras cuyo NRC no existe en `CONTRIBU` | 166 | crear tercero con nombre del documento, `needs_review` |
| Ventas cuyo NRC no existe en `CLIENTES` | 27 | igual |
| Ventas CF crédito fiscal sin NRC | 2,395 | `taxpayer_id` nulo; reporte |
| `totalc` ≠ suma de componentes (con la fórmula del §2 de las reglas) | 63 | guardar el total original en `legacy_total` y marcar; el libro nuevo usa el recalculado solo si el negocio lo aprueba |
| `ivaint` o `fvgiv` ≠ base × tasa (13 % del código comentado) | 151 en compras, 136 en ventas | conservar el IVA del documento (el documento legal manda); reporte |
| Compras con fecha de documento anterior al período del libro | 1,913 de 19,494 | normal (registro tardío): conservar |
| Compras con fecha posterior al período | 1 | conservar y reportar |
| Ventas con `salfec` vacío | 3 | período = mes de `ffec` |
| Resumen CF con `fcomp1 > fcomp2` | 1 | intercambiar y reportar |
| Resumen CF con `fcomp1 = fcomp2` | 499 de 802 | parte es carga CSV con el defecto de `documentof` (reglas §13.11): no se puede inferir el fin del rango; conservar |
| Clientes/proveedores con NRC sin guion o con formatos distintos | por medir | normalizar para comparar, guardar el original |
| `clasedoc`/`tipoope`/`clasific`/`sector`/`tipocosto` vacíos antes de la época del DTE; valor `0` en ~420 filas | 18,111–18,824 vacíos | `NULL`; el `0` se importa como `unknown` hasta que el negocio lo defina |
| `CORREN` inexistente | 1 tabla | `tax_sequences.next_number` = mayor `fcomp` de `RENTAT` + 1 |
| Ruta `INTEGRAP` apunta a `\MC\CONTAC\DBF` (no existe hoy) | 1 | el importador recibe las rutas por parámetro |

### 3.3 Enlaces entre módulos al importar
- `IVAFIS`: buscar en `CCMOV01` por `fref = fcomp` y `ftmov = ftipo` para llenar `source_ref` cuando `transf = .T.`; si no hay coincidencia, `source_module = 'manual'`.
- `COMPRAS`: buscar en `QUEDAN` por `comprob = fcomp` y registro del proveedor; si no, `manual`. En la copia no hay filas con `transf`, por lo que el enlace es de mejor esfuerzo.
- Identificadores del DTE: se importan los que traiga cada fila; opcionalmente reconciliar con `FELECTRO` por `nfact_env` (la copia de IVAFIS trae 2,977 códigos).
- Enlace con el GL: no existe en el legado. Para compras que vengan de Bancos se puede reconstruir buscando en `PARTIDAS` una partida del mismo día con una línea en la cuenta de IVA crédito fiscal y el mismo importe de IVA: heurística opcional, siempre marcada `inferred`.

### 3.4 Paridad (qué debe cuadrar al centavo con el sistema anterior)
Para cada mes cargado, comparar contra los **libros impresos** (pendientes de recibir; hoy solo se puede comparar contra el cálculo directo de las tablas):
1. **Compras:** totales por columna del libro (exentas internas e importaciones, gravadas internas e importaciones, IVA interno e importaciones, retenido/percibido, anticipo, total, excluidos), por separado para compra, gasto, notas de crédito y notas de débito; cantidad de renglones.
2. **Ventas a contribuyentes:** exentas, gravadas, débito fiscal, retenido/percibido, anticipo y total, por separado para `C0`, `C4` y `A*`.
3. **Consumidor final:** exentas, gravadas brutas, exportaciones y total del mes; IVA del mes = `TOTGRA − ROUND(TOTGRA/(1+tasa/100), 2)` (una sola vez); debe coincidir con el pie "CALCULO DEL DEBITO FISCAL".
4. **Renta:** monto sujeto y renta retenida por NIT y código (F910 anual).
5. **Archivos para Hacienda:** regenerar el anexo de cada mes y comparar fila a fila con un archivo guardado del sistema anterior (los `.XLS` están en la carpeta de salida de cada usuario; no están en `MCERP`).
6. **Cuadre contra Contabilidad:** el IVA crédito del libro de compras de un mes debe ser comparable con el saldo de la cuenta de IVA crédito fiscal del GL; con el IVA64 independiente no se garantiza que coincida (las compras se registran al margen de las partidas). Es un reporte de control, no una condición de paridad (pregunta 4).
Resultados con la copia actual: pendiente de ejecutar (aún no hay importador `tax`).
