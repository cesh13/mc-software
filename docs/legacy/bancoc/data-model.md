# BANCOC — Modelo de datos

Estructura, llaves y conteos salen de los `.DBF` reales (`MCERP/CONTAC/dbf`, carpeta de datos de la empresa
que usa Bancos) y del catálogo de índices `ARCHIVOS.DBF`. **No hay `MCERP/BANCOC/dbf`**.
Conteos = registros vivos (sin marcados como borrados). No se copió ningún dato de cliente.

## 1. Tablas legadas

### Bancos

| Tabla | Contenido | Campos clave | Registros |
|---|---|---|---|
| `BANCOS` | Catálogo de bancos | `codban` C2, `nombre` C20 | 3 |
| `CTABANCO` | Cuenta bancaria | `ctabanco` C18 (llave), `nombrecta` C30, `codban` C2, `tipo` N1 (1 caja, 2 corriente, 3 ahorros, 4 plazo, 5 otra), `moneda` N1, `tasa` N8.2, `cuenta` C14 (**cuenta contable**), `fapertura` D, `saldoi` N12.2 + `fechasal` D (saldo y fecha iniciales), `cargos`/`abonos`/`saldoact`/`sdiant` N12.2, `corre` C10 (último cheque), `formachk` C8, `cexenta` L (exenta de LIOF), `dispo` L (afecta disponibilidad), `vencim` D, `observ` M | 3 |
| `TMOV` | Tipos de transacción | `tipo` N1 (llave), `nombre` C7, `nombre_ope` C25, `tipopar` C2 (**tipo de partida**), `tipo_ope` N1, `es_cheque`/`es_remesa`/`es_nc`/`es_na` L | 6 |
| `MOVIBAN` | **Encabezado del documento bancario** | `ctabanco`, `tipo`, `numdoc` C10, `salfec` C6, `fecha` D, `monto` N12.2, `a_nombre` C65, `concepto` C200, `tipopar` C2 + `numero` C7 (**partida en el GL**), `tipo_ope` N1, `moneda`, `tasa`, `impreso`, `enfirma`/`fecfirma`, `entregado`/`fecentrega`/`recibe`, `listo`, `postfe`/`fcobro`/`cobrado`, `anulado`, `cerrado`, `conciliado`/`mesconci`, `cimpuesto`, `provedor` C10, `clasif` C6, `xfer`, `es_quedan`, `hechopor`, `remep`, `montox` | 2,691 |
| `DETABANK` | Líneas contables del documento (copia de las de la partida) | `ctabanco`, `tipo`, `numdoc`, `salfec`, `tipopar`, `numero`, `cuenta` C14, `detalle` C200, `cargo`/`abono` N12.2, `tipomov` N1, `fecha`, `ccosto` C3, `impreso` | 12,724 |
| `CLASIF`, `DETACLA` | Clasificación de remesas | `clasif` C6, `nombrecla` C30 | 0 / 0 |

### Cuentas por pagar

| Tabla | Contenido | Campos clave | Registros |
|---|---|---|---|
| `PROVEDOR` | Proveedores | `provedor` C10 (llave), `nombre` C70, `registro` C10 (registro IVA, único), `nit` C17, `dui`, `direccion`, `telefono`, `fax`, `email`, `encargado`, `cta` C14 (cuenta contable), `plazo` N6 (días), `grancon` L, `nresolu`, `nserie`, `ventas` N12.2, `nacional` | 73 |
| `NOMBRES` | Proveedores "solo nombre" (código con `+`) | `provedor`, `nombre`, `direccion`, `telefono`, `cuenta` | 0 |
| `COMPROB` | Tipos de comprobante de CxP | `codigo` C4, `nombre`, `operacion` N1 (1 aumenta la deuda, 2 la disminuye), `lcom`/`lccf`/`lfac` (aparece en compras/CCF/facturas), `retener`, `referencia`, `tipodocu` | 4 |
| `QUEDAN` | **Documento por pagar** | `provedor` + `tipcomp` + `comprob` (llave natural), `quedan` C10 (número de quedan), `orden`, `fecha`, `recibido`, `vence`, `plazo`, `afecta`/`exenta`/`iva`/`ivare`/`ivaper`/`renta`/`otrocar`/`total`, `cargo`/`abono`/`saldo`/`pagos` N12.2, `pagado`, `anulado`, `cancelado` C10 (doc. bancario que lo pagó), `tipo`, `provision`/`provisiona` L, `tipopar` + `numdoc` (**partida de la provisión**), `salfec`, `moneda`, `siiva`, `compra`, `nretencion` C10, `nresolu`/`nserie`/`npimp`, `clasedoc`, `origen`, `pard`, `obser` M | 204 |
| `MOVQUE` | **Pago aplicado** a un documento | `provedor` + `tipcomp` + `comprob`, `ctabanco` + `tipo` + `numdoc` + `salfec` (documento bancario), `pago` N12.2, `porcen`, `fechach`, `operacion`, `sistema` (L: cancelación manual) | 162 |
| `NCREDEB` | Notas de crédito/débito | `provedor`, `tipcomp`, `comprob` (la nota), `tipcomp2`+`comprob2` (documento al que se aplica), `fecha`, `recibido`, montos, `operacion`, `ivare`/`ivaper`, `renta`, `provision`/`provisiona`, `tipopar`+`numdoc`, `siiva`, `compras` | 8 |
| `PROVISIO` | Líneas de provisión de cada documento | `provedor` + `doc` + `numero`, `cta`, `concepto`, `cargo`/`abono`, `ccosto`, `provision`, `origen` (1 documento, otro = nota), `renta`, `pard` | 638 |
| `UNIDADES` | Sucursales | `codigo` C10, `nombre`, `tipo` | 0 |

### Compartidas con CONTAC (no son de Bancos)

`PARTIDAS` (5,209) y `DETAPART` (48,024): el GL; `TIPOPAR` (10; campo `bancos` L sin uso), `CATALOGO` (618),
`CCOSTO` (5), `SALDOS` / `SALDOCC` (cache del GL, no se importan), `EMPRESAS` (1), `USUARIOS`, `USREMP`, `PERFIL`,
`BITACORA`. El libro de IVA (`LIBCOMP`) y las retenciones de renta (`RENTAT`) son del módulo IVA.

### Tablas vacías, sin código o de trabajo (no se migran)

Sin uso: `REMESA`, `CONFIGUR`, `MOVBAN`, `MOVCONT`, `MOVCUEN`, `TIPODOC`, `CORREDOC`, `CORREL`, `CUADRE`, `SALIDA`,
`DETAQUE`, `DISPONE` (trabajo del reporte). De trabajo: `PTEMP*`, `DTEMP*`, `PPROV*`, `DPROV*`, `ESTCXP`, `FLUJO`,
`AUXI`, `PA`, `PP`, `PP2`, `KK`, `SALVE`, `CONCI`, `CONCI2`, `NCREDEBV`, `MOVQUEV`. De obra: `CHEQUE`.
Índices y llaves (de `ARCHIVOS.DBF`): `MOVIBAN` por `SALFEC+CTABANCO+STR(TIPO)+NUMDOC` y por `CTABANCO+STR(TIPO)+NUMDOC`
(esta última es la unicidad de cheques entre meses); `QUEDAN` por `PROVEDOR+TIPCOMP+COMPROB`; `MOVQUE` por
`CTABANCO+NUMDOC` y `PROVEDOR+TIPCOMP+COMPROB`.

### Relaciones

```
EMPRESAS 1─* (carpeta de datos)
BANCOS 1─* CTABANCO ──cuenta── CATALOGO
CTABANCO 1─* MOVIBAN ─tipo→ TMOV ─tipopar→ TIPOPAR
MOVIBAN 1─* DETABANK            (misma llave ctabanco+tipo+numdoc+salfec)
MOVIBAN ──(salfec+tipopar+numero)── PARTIDAS 1─* DETAPART     (sin id; llave por texto)
MOVIBAN *─1 PROVEDOR ──cta── CATALOGO
PROVEDOR 1─* QUEDAN ─tipcomp→ COMPROB
QUEDAN 1─* MOVQUE *─1 MOVIBAN   (pago aplicado)
QUEDAN 1─* NCREDEB              (tipcomp2+comprob2)
QUEDAN / NCREDEB 1─* PROVISIO   ──(tipopar+numdoc)── PARTIDAS   (partida de provisión)
```

## 2. Modelo propuesto — módulo `banking` (`bnk_`)

Reglas de la plataforma: tablas con prefijo, dinero como TEXT con dos decimales, sin DELETE (`is_active`
o estado `voided`), fechas ISO, `empresa_id` en toda tabla de negocio, id de texto. **Sin tablas de saldos.**
Las líneas contables **no se duplican**: viven en `gl_journal_lines` (el documento guarda `gl_entry_id`).

### `bnk_banks`
`id`, `empresa_id`, `code` (C2), `name`, `is_active`. Único `(empresa_id, code)`. Origen: `BANCOS`.

### `bnk_accounts`
| Columna | Origen |
|---|---|
| id, empresa_id | nuevo |
| bank_id | `codban` |
| number | `ctabanco` |
| name | `nombrecta` |
| kind (`caja\|corriente\|ahorros\|plazo\|otra`) | `tipo` |
| gl_account_id (activo, de detalle) | `cuenta` |
| opening_balance, opening_date | `saldoi`, `fechasal` |
| opened_on, maturity_date | `fapertura`, `vencim` |
| next_check_number | `corre` (**sugerencia**; el cheque único se valida contra documentos) |
| check_format | `formachk` |
| liof_exempt, affects_availability | `cexenta`, `dispo` |
| notes | `observ` |
| is_active, created_at, updated_at | nuevo |

Único `(empresa_id, number)`. La pantalla captura una tasa de interés (`t_interes`) pero **la tabla no tiene ese campo**: nunca se guardó. Se descartan `cargos`, `abonos`, `saldoact`, `sdiant`, `tasa`/`moneda` (una moneda por empresa;
el importador avisa si hay cuentas con otra moneda). No se permite desactivar con documentos sin conciliar.

### `bnk_transaction_types`
`id`, `empresa_id`, `legacy_code` (`tipo`), `code` (`nombre`), `name` (`nombre_ope`), `entry_type_id` (→ `gl_entry_types`, `tipopar`),
`direction` (`in\|out`, derivada de `tipo_ope` del catálogo: 1→`in`, 2→`out`), `kind` (`check\|deposit\|debit_note\|credit_note\|transfer\|other`
a partir de `es_cheque/es_remesa/es_nc/es_na`), `is_active`. Único `(empresa_id, code)`.

### `bnk_documents` (cheque, remesa, NC, NA, transferencia)
| Columna | Origen |
|---|---|
| id, empresa_id | nuevo |
| account_id, type_id | `ctabanco`, `tipo` |
| number | `numdoc` |
| period (`AAAA-MM`) | `salfec` |
| date | `fecha` |
| amount | `monto` |
| direction (`in\|out`) | `tipo_ope` guardado (1→`out`, 2→`in`) — **convención de MOVIBAN, no la de TMOV** |
| payee_name, concept | `a_nombre`, `concepto` |
| supplier_id (→ `ap_suppliers`) | `provedor` |
| post_dated_for | `fcobro` |
| liof_applied | `cimpuesto` |
| status (`draft\|issued\|voided`) | `anulado` → `voided`; resto `issued` |
| printed_at | `impreso` (fecha desconocida: nulo con marca) |
| signed_on, delivered_on, received_by, collected | `enfirma/fecfirma`, `entregado/fecentrega/recibe`, `cobrado` |
| reconciliation_id | `conciliado/mesconci` (→ `bnk_reconciliations`) |
| gl_entry_id | (`salfec`,`tipopar`,`numero`) → `gl_journal_entries.id` |
| legacy_ref | `salfec\|ctabanco\|tipo\|numdoc` |
| created_by, created_at, updated_at | nuevo / `hechopor` |

Únicos: `(empresa_id, account_id, type_id, number)` **parcial para tipo cheque** (el legado lo exige entre meses) y
`(empresa_id, account_id, type_id, period, number)` para el resto. Las 9 llaves de partida con más de un movimiento
(transferencias con dos patas) se resuelven con un documento por pata, ambos con el mismo `gl_entry_id`.
Se descartan: `cerrado` (período del GL), `listo`, `impreso` por documento no-cheque, `xfer`, `es_quedan`, `remep`, `montox`, `tasa`, `moneda`.

### Cómo se enlaza cada documento con su partida en el GL
1. Grabar/aplicar: `banking` llama a la API del GL para crear la partida con `source = 'bancos'`, `source_ref = bnk_documents.id`,
   tipo = `bnk_transaction_types.entry_type_id`, número del siguiente disponible; la partida nace `aplicada`.
   Las líneas: la de la cuenta bancaria (`gl_account_id`), las contrapartidas capturadas, las del proveedor y las del LIOF.
2. Se guarda `gl_entry_id` en el documento en la **misma transacción**.
3. Anular: se anula la partida (soft delete, número retenido) y el documento pasa a `voided`; el GL rechaza
   anular o editar directo una partida con `source = 'bancos'`.
4. Borrador: partida en `borrador`; no cuenta en saldos.

### `bnk_reconciliations` y `bnk_reconciliation_items`
`bnk_reconciliations`: `id`, `empresa_id`, `account_id`, `period`, `statement_balance`, `prepared_by`, `reviewed_by`, `approved_by`,
`status (open\|closed)`. Único `(empresa_id, account_id, period)`. Origen: `CONCILIA.MEM` (firmantes) y `SALBAN` (que en el
legado solo existe al imprimir).
`bnk_reconciliation_items`: `reconciliation_id`, `document_id`, `reconciled_at`. Origen: `MOVIBAN.CONCILIADO` + `MESCONCI`.
Único `(reconciliation_id, document_id)`.

### `bnk_settings` (configuración por empresa)
`empresa_id`, `liof_rate` (`cfg_liof`), `liof_threshold` (hoy fija en el código), `liof_expense_account_id` (`cfg_gasto`),
`check_form`, `entry_number_width` (`cfg_digcom`). Las tasas y cuentas de IVA y renta van en `tax_settings`.

## 3. Boceto — módulo `accounts-payable` (`ap_`)

La evidencia (reglas §10: documentos, vencimientos, pagos aplicados, antigüedad, provisión) respalda un módulo completo.

| Tabla | Origen / notas |
|---|---|
| `ap_suppliers` | `PROVEDOR` (+ `NOMBRES` como proveedor sin registro): `code`, `name`, `registry_no`, `tax_id`, `dui`, `address`, `phone`, `contact`, `gl_account_id` (`cta`), `credit_days` (`plazo`), `is_large_taxpayer` (`grancon`), `default_resolution`/`default_series`, `bank_account`, `is_active`. Único `(empresa_id, code)` y `(empresa_id, registry_no)` cuando no es nulo |
| `ap_document_types` | `COMPROB`: `code`, `name`, `effect` (`increase\|decrease`, de `operacion`), flags de libro |
| `ap_documents` | `QUEDAN` + `NCREDEB`: `supplier_id`, `type_id`, `number`, `applies_to_document_id` (las notas), `voucher_no` (quedan), `issue_date`, `received_date`, `due_date`, montos (`taxable`, `exempt`, `vat`, `vat_withheld`, `vat_perceived`, `income_tax`, `other_charge`, `total`), moneda implícita, `withholding_cert_no`, `status (open\|void)`, `gl_entry_id` (provisión), DTE (`generation_code`, `control_no`, `seal`), `legacy_ref`. Único `(empresa_id, supplier_id, type_id, number)`. **No se guardan `abono`, `cargo`, `saldo`, `pagos`**: se calculan |
| `ap_payment_applications` | `MOVQUE`: `document_id`, `bank_document_id` (nulo si cancelación manual), `amount`, `date`, `is_manual`, `legacy_ref`. Hoy `saldo = total + cargo − abono`; en el modelo nuevo `saldo = total − Σ créditos aplicados + Σ débitos aplicados − Σ pagos` |
| `ap_provision_lines` | `PROVISIO`: `document_id`, `line_no`, `account_id`, `cost_center_id`, `detail`, `debit`, `credit` |
| `ap_provision_batches` | (nuevo) la partida generada por `qwgpro01`: `entry_type_id`, `entry_number`, `date`, `concept`, `gl_entry_id`, lista de documentos |

Fuente de la partida: `source = 'cxp'` (requiere agregarlo a `GL_ENTRY_SOURCES`; hoy no existe, ver pregunta 21). Los reportes
(antigüedad con tramos ≤0, 1–30, 31–60, 61–90, 91–120, ≥121 días; estado de cuenta; histórico; auxiliar) son consultas sobre
estas tablas. El libro de compras y la renta retenida se publican a `tax`.

## 4. Notas de migración

### Codificación
Las marcas de página de código observadas: `0x03` (Windows-1252) en `MOVIBAN`, `DETABANK`, `CTABANCO`, `QUEDAN`, `PROVEDOR`,
`PROVISIO`, `TMOV`, `BANCOS`, `PARTIDAS`; **`0xC8`/`0xC9` (marcas de cp1250/cp1251) en `MOVQUE`, `NCREDEB`, `PERIODO`, `PRESUP`** y `0x02` en `COMPROB`. El
importador de CONTAC solo prevé `0x03` y `0x00/0x02`. Las `0xC8` deben decidirse por contenido (tratar como cp1252 salvo que
aparezcan caracteres imposibles); verificarlo con las columnas de texto de cada tabla. Memos: `CTABANCO.OBSERV`, `QUEDAN.OBSER`
en `.FPT`.

### Qué datos sucios esperar (medido en la empresa disponible)
| Hallazgo | Tratamiento |
|---|---|
| 14 `MOVIBAN` sin líneas en `DETABANK`; 23 grupos de `DETABANK` sin encabezado en `MOVIBAN` | Importar el documento sin líneas propias (las líneas vienen de la partida); reportar los huérfanos |
| 1,067 de 12,724 líneas de `DETABANK` sin equivalente en `DETAPART` (partida editada desde CONTAC) | **El GL manda.** Las líneas de `DETABANK` no se importan; solo se reporta la diferencia por documento |
| 1 partida de Bancos descuadrada en `DETABANK` | Se refleja en el reporte (el GL ya trae la partida con `imported_unbalanced`) |
| 9 llaves de partida usadas por más de un movimiento | Un documento por movimiento, mismo `gl_entry_id` |
| `generado` vacío en partidas de Bancos (versión actual del programa) | El enlace sale de `MOVIBAN`, no de `generado` |
| `QUEDAN`: 1 llave natural duplicada; 1 `MOVQUE` sin documento; 10 documentos con `pagos` ≠ Σ `MOVQUE` | Detener el import de AP si el saldo recalculado difiere de `QUEDAN.SALDO` más que la tolerancia (0); reportar |
| `MOVIBAN.TIPO_OPE` con convención opuesta a `TMOV` | Derivar `direction` de la bandera `es_cheque/es_nc` y verificar contra el signo de la línea bancaria del GL |
| 2 movimientos con `tipo` vacío o 0 | Reportar; asignar tipo según `tipopar` si es unívoco |
| Posible partida de Bancos borrada en CONTAC con el movimiento aún vivo | Reportar movimientos cuya partida no existe (0 en esta empresa) |
| Registros marcados como borrados en el DBF | No se importan (igual que CONTAC); `DETABANK` 495 y `MOVIBAN` 19 |
| Folders con varias empresas o cuentas en otra moneda | El importador avisa; la plataforma usa una sola moneda |

### Enlace con el importador del GL
El importador de CONTAC deja `source = 'importado'` y `source_ref = salfec|tipopar|numero`. El importador de Bancos busca la partida
por esa referencia, y — **única excepción permitida** — cambia `source` a `'bancos'` y `source_ref` al id del documento en la misma
transacción, para que el GL respete la regla "se anula desde Bancos" también en el historial (pregunta 14). Lo mismo para `'cxp'` en
las provisiones (`QUEDAN.TIPOPAR`+`NUMDOC`).

### Chequeo de paridad (debe cuadrar al centavo)
1. **Por cuenta bancaria y fecha:** `saldoi + Σ entradas − Σ salidas` (`MOVIBAN.TIPO_OPE`) de la cuenta nueva = saldo de su cuenta
   contable en el GL nuevo (desde `fechasal`) = `SALDOS.saldo` del mes, y comparar con `CTABANCO.saldoact` (puede fallar por los
   caminos de actualización del §6 de las reglas; informar, no bloquear).
2. **Disponibilidad diaria** (reporte D) del legado vs la consulta nueva para fechas elegidas.
3. **CxP por proveedor:** `Σ saldo` nuevo = `Σ QUEDAN.SALDO` y = saldo de la cuenta contable del proveedor cuando esa cuenta es única por proveedor.
4. **Antigüedad** (K/M) por tramo = reporte `sbanti01` del legado a la misma fecha.
5. **Conteos:** 2,691 documentos, 204 documentos de CxP + 8 notas, 162 aplicaciones, 638 líneas de provisión, 73 proveedores, 3 cuentas
   (menos los marcados como borrados en el DBF).
6. **Enlace con el GL:** cada documento tiene `gl_entry_id` y la partida tiene su línea de banco por el mismo monto y sentido.
