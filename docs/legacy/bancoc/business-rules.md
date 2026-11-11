# BANCOC — Reglas de negocio

Extraídas de `sbmdoc01.scx` (emisión de documentos), `sbmcue01.scx`, `sbmope01.scx`, `sbmconci.scx`,
`sbrconci.scx`, `sbreme01.scx`, `sbichv01.scx`, `sbchgnum.scx`, `sbmfac01.scx`, `sbmfac02.scx`,
`sbmfac03.scx`, `sbmcom01.scx`, `sbmpro01.scx`, `qwprovi1.scx`, `qwgpro01.scx`, `qwcque01.scx`,
`ccranti1.scx`, `ccranti2.scx`, `sbrsaldo.scx`, `sbrdisp1.scx`, `config2.scx`, `ivacomp2.scx`,
`ivarenta.scx`; programas `SBADTRAN.PRG`, `SBADIMOV.PRG`, `CGADIPAR.PRG`, `CGADIPA2.PRG`,
`CGADIPAC.PRG`, `QWCANQUE.PRG`, `SBCDIANT.PRG`, `SBICHE02.PRG`, `LLENACXP.PRG`, `OFCOMPRA.PRG`,
`SBMCOR01.PRG`; menú `BAMENU.MPR`; reporte `sbanti01.frx`; y de `CONTAC/fuente`: `cgcmes01.scx`,
`cgames01.scx`. Las cifras de registros y las comprobaciones de integridad salen de una lectura de
las tablas de `MCERP/CONTAC/dbf` (solo conteos; no se copió ningún dato).

Convenciones: **[V]** verificado en el código; **[D]** verificado en los datos; **[I]** inferido.
"Nueva plataforma:" marca dónde el sistema nuevo debe diferir a propósito.

## 1. Cómo está armado el sistema (contexto)

- Bancos y CxP trabajan sobre el **mismo folder de datos que CONTAC** [V]. Una transacción bancaria
  escribe directo en `PARTIDAS`, `DETAPART`, `SALDOS` y `SALDOCC` (las tablas del GL), con las mismas
  rutinas que CONTAC (`CGADIPAR.PRG` hace el posteo de saldos con roll-up por cuenta padre).
- Cada documento bancario tiene **dos copias de sus líneas**: `DETABANK` (líneas del módulo) y
  `DETAPART` (líneas de la partida contable). El encabezado también: `MOVIBAN` y `PARTIDAS` [V].
  En los datos, 1,067 de 12,724 líneas de `DETABANK` ya no tienen una línea idéntica en `DETAPART`
  (la partida se editó después desde CONTAC) y 1 partida de Bancos no cuadra [D].
- El mes de trabajo (`mesact`, `AAAAMM`) es el de CONTAC; cada usuario guarda el suyo en `MESACT.<usuario>` [V].
- **Nueva plataforma:** una sola fuente de verdad. El documento bancario guarda su referencia a la partida
  del GL (`gl_entry_id`); las líneas viven **solo** en el GL.

## 2. Configuración por empresa (`BANCOCFG.MEM`, pantalla `config2`)

Se guarda en un archivo `.MEM` por empresa en el folder de datos. Variables [V] (los valores son
configuración del cliente y no se copian):

| Variable | Qué es |
|---|---|
| `cfg_conta` | Trabajar integrado a Contabilidad (si es falso, no se captura la partida ni se usan cuentas) |
| `cfg_prove` | Trabajar con Cuentas por Pagar |
| `cfg_l_iva` | Pasar al libro de IVA de compras (depende de `cfg_prove`) |
| `cfg_bancos` | Integración de correlativos de partida con Bancos (su efecto está en `conta()`, no incluido en el proyecto; ver §15) |
| `cfg_cuadre` | Exigir partidas cuadradas (en `sbmdoc01` **no se consulta**: siempre se exige; ver §4.9) |
| `cfg_iva` | Tasa de IVA (%) |
| `cfg_ivare` | Tasa de IVA retenido (%); se usa **también** para el IVA percibido (ver §9.2) |
| `cfg_liof` | % del impuesto LIOF |
| `cfg_iva_cf`, `cfg_iva_re`, `cfg_iva_pe`, `cfg_renta`, `cfg_gasto` | Cuentas contables: IVA crédito fiscal, IVA retenido, IVA percibido, renta, gasto de impuesto (todas deben ser cuentas de detalle: "Cuenta no es de detalle!") |
| `cfg_lineas`, `cfg_qlinea` | Líneas del voucher; líneas de la provisión de un documento |
| `cfg_digcom` | Ancho del correlativo de partida |
| `cfg_llave` | Restringir fecha de documentos de CxP al mes de trabajo (y hasta 2 meses atrás) |
| `cfg_digique`, `cfg_hoja`, `cfg_formaq` | Captura del número de quedan, vista en hoja de los documentos a pagar, formato de impresión del quedan |
| `cfg_liqui`, `cfg_obra` | Clasificación de remesas (`CLASIF`); cheques a contratistas |

Además `EMPRESAS.GRANDE` (gran contribuyente) y `PROVEDOR.GRANCON` (proveedor gran contribuyente) gobiernan
retención/percepción (§9). La moneda de cada cuenta bancaria sale de `MONEDA.MEM` (5 códigos, ver §3.2).

**Nueva plataforma:** tasas y cuentas en una tabla de configuración por empresa (`tax_settings`/`bnk_settings`,
con `empresa_id`), con las cuentas validadas (existen, son de detalle, de la empresa). `cfg_cuadre` desaparece
(ver decisión 1 de CONTAC); `cfg_conta` y `cfg_prove` desaparecen (la plataforma siempre integra; CxP es un módulo
que se habilita o no); `cfg_bancos` ver pregunta 20.

## 3. Catálogos

### 3.1 Bancos y cuentas bancarias (`sbmban01`, `sbmcue01`)

- Banco: código de 2 caracteres y nombre de 20 [V].
- Cuenta bancaria (`CTABANCO`, llave `ctabanco` C18): descripción obligatoria; banco debe existir
  ("Banco no Existe"); número de cuenta no vacío y único ("Cuenta ya Existe"); al repetir, abre la existente [V].
- **Tipo de cuenta** (`TCTA.MEM`): 1 Caja · 2 Corriente · 3 Ahorros · 4 A plazo · 5 Otra [V]. Solo las cuentas
  tipo 2 (corriente) pueden emitir cheques: "Debe seleccionar una cuenta corriente!!!" [V].
  Las **a plazo** piden fecha de vencimiento (posterior a la apertura: "Fecha incorrecta!") y tasa de interés (esta última **no se guarda**: la tabla no tiene el campo).
- **Cuenta contable obligatoria:** "Cuenta no puede quedar en blanco"; debe existir en el catálogo,
  **ser de tipo 1 (Activo)** y de detalle (la búsqueda se hace con `"1"+cuenta`) [V].
- Saldo inicial (`saldoi`) y su fecha (`fechasal`, obligatoria: "No se puede dejar en blanco!"). **Ningún
  movimiento puede tener fecha ≤ `fechasal`**: "La fecha debe ser mayor que …" [V].
- `corre`: último número de cheque usado (sugiere el siguiente). `formachk`: nombre del formato de impresión.
  `cexenta`: cuenta exenta del impuesto LIOF. `dispo`: la cuenta afecta la disponibilidad [V].
- `cargos`, `abonos`, `saldoact`: acumulados guardados (ver §6). Al grabar la cuenta se recalcula
  `saldoact = saldoi + cargos − abonos` [V].
- Eliminar una cuenta pide confirmación, deja bitácora y **borra físicamente sin revisar si tiene
  movimientos** [V]. **Nueva plataforma:** no se puede desactivar una cuenta con movimientos
  no conciliados ni con partidas abiertas; nunca borrar; bitácora.
- Los tipos de cuenta y monedas son listas fijas en archivos `.MEM`. En los datos: 3 cuentas, todas
  corrientes en dólares [D].

### 3.2 Monedas

`MONEDA.MEM`: 1 Dólares · 2 Colones · 3 Quetzales · 4 Lempiras · 5 Otro, con símbolo y tasa
(`MOTASA`) guardados en el mismo archivo [V]. Solo la moneda 1 genera líneas contables automáticas
(`if m.moneda=1`); con otra moneda el usuario captura los montos a mano y hay un campo "Tipo de cambio"
[V]. **Nueva plataforma:** una moneda por empresa (decisión 13 de CONTAC). Si una empresa tiene cuentas en
otra moneda hay que decidirlo antes de migrar (pregunta 9).

### 3.3 Tipos de transacción (`TMOV`, pantalla `sbmope01`)

Es la tabla que **gobierna la integración con el GL** [V]. Campos: `tipo` (1 dígito, clave), `nombre`
(siglas), `nombre_ope`, `tipopar` (tipo de partida contable que genera: debe existir, "Tipo de Comprobante
Contable NO Existe!!!"), `tipo_ope` ("Generar un Cargo" = 1 / "Generar un Abono" = 2: **sentido de la línea
de la cuenta bancaria en la partida**), y banderas excluyentes `es_cheque`, `es_remesa`, `es_na` (nota de
abono), `es_nc` (nota de cargo). Código de operación único ("Código de Operación Ya Existe!").

Seis tipos en los datos [D]: 1 Cheque (partida de egreso, abono), 2 Remesa (partida de ingreso, cargo),
3 Nota de Cargo, 4 Nota de Abono, 5 Ventas, 6 Transferencia (en los datos se usa para pagos a proveedores
y la partida es de "transferencia a proveedor"). El sentido de la línea bancaria sale siempre de `TMOV.TIPO_OPE`, no de las banderas (el tipo 5 Ventas
tiene `es_remesa` pero sentido 2, abono: *inferido* un dato de catálogo mal puesto).

**Dos convenciones de `tipo_ope`** (trampa para el importador) [V]:

| Dónde | 1 significa | 2 significa |
|---|---|---|
| `TMOV.TIPO_OPE` (catálogo) | la línea bancaria es **cargo** (entra dinero) | la línea bancaria es **abono** (sale dinero) |
| `MOVIBAN.TIPO_OPE` (documento guardado; lo fija `SBADIMOV`/`SBADTRAN`) | **sale** dinero (cheque o nota de cargo) | **entra** dinero (resto) |

Es decir, el valor guardado en `MOVIBAN` está invertido respecto al catálogo y se deriva de las
banderas (`es_cheque OR es_nc` → 1, otro → 2). **Nueva plataforma:** una columna `direction`
(`in`/`out`) derivada del tipo, no dos convenciones.

## 4. Documentos bancarios (cheque, remesa, NC, NA, transferencia) — `sbmdoc01`

### 4.1 Flujo de captura

Orden de los campos: tipo de operación (se elige de una lista de `TMOV`) → cuenta bancaria (si es cheque,
filtra solo corrientes) → "A nombre de" (cheque) o "Concepto" (otros) → fecha → proveedor (opcional) →
monto → partida contable (tipo y número) → líneas contables → Grabar [V]. Con `cfg_conta` el campo
"Concepto contable general" se llena con el beneficiario si está vacío.

Botones: Agregar, Buscar, Eliminar, Modificar, Anterior, Siguiente, Finalizar, Anular, Grabar, Cancelar,
Imprimir, Ingresar al Iva, Ingresar Renta, Partidas. Se puede dejar una partida **suspendida** (los temporales
`PTEMP<usuario>`/`DTEMP<usuario>` conservan el borrador; al volver pregunta si procede).
**Nueva plataforma:** el borrador es un documento con `status = 'draft'` y su partida en `borrador`.

### 4.2 Fecha y mes

- La fecha debe estar en el mes de trabajo: "Año Incorrecto. Debe ser …" / "Mes Incorrecto. Debe ser …" [V].
- La fecha debe ser mayor que la fecha del saldo inicial de la cuenta (§3.1) [V].
- Mes cerrado: se avisa "MES CERRADO EN CONTABILIDAD..." / "MES CERRADO. SOLAMENTE CONSULTA..." y se
  deshabilitan Agregar, Eliminar y Modificar (queda Buscar, Anterior, Siguiente, Imprimir) [V]. Se evalúa por la
  bandera `cerrado` del primer movimiento del mes.

### 4.3 Numeración del documento

- Número obligatorio: "Debe digitar el Numero de la Transaccion" [V].
- **Cheques:** el sistema sugiere `corre + 1` (último número de la cuenta). Único por cuenta + tipo **sin
  importar el mes** ("Comprobante Ya Existe fue hecho en ! <mes>") [V]. Al grabar, si el número ya fue tomado,
  se reasigna el siguiente (`proximo()`), y `corre` se actualiza si el número es mayor [V].
- **Otros documentos:** único por mes + cuenta + tipo + número [V].
- En los datos hay documentos cuyo número se reutiliza entre partidas (9 llaves de partida referenciadas por más
  de un movimiento) [D]; ver §6 y la pregunta 12.

### 4.4 Monto y líneas generadas (moneda base)

Al capturar el monto, con `cfg_conta`, el sistema **arma la línea de la cuenta bancaria** y el usuario completa
las contrapartidas [V]:

| Tipo | Línea de banco | Contrapartida |
|---|---|---|
| Cheque | **Abono** a la cuenta contable de la cuenta bancaria por el monto. Detalle: `CH # <número> <beneficiario>` | Si hay proveedor: **cargo** a la cuenta del proveedor (`PROVEDOR.CTA`) por el monto, detalle `Canc.<proveedor> <documentos>`. Si no, el usuario captura (gasto, etc.) |
| Remesa / NA | **Cargo** a la cuenta bancaria (según `TMOV.TIPO_OPE = 1`). Detalle = concepto | La captura el usuario (puede ser una partida de varias líneas) |
| Nota de cargo | Abono (sale dinero) según `TMOV` | Captura el usuario |
| Transferencia | Abono, igual que el cheque | Cargo a la cuenta del proveedor si se eligió proveedor |

La línea generada para un cambio de monto reemplaza a la anterior de la misma cuenta (al agregar o modificar).
Las líneas llevan `tipopar`, `numero`, `fecha`, `salfec`, `ctabanco`, `tipo`, `numdoc`.

### 4.5 Validaciones de las líneas contables

Las mismas que CONTAC [V]: cuenta debe existir ("Cuenta No Existe!") y ser de detalle ("Cuenta no es de
detalle!"); centro de costo obligatorio si la cuenta lo exige ("Debe digitar el campo del Centro de Costo"),
prohibido si no ("Cuenta no lleva Centro de Costo"), debe existir; detalle obligatorio ("No se puede dejar en
blanco!"); cargo o abono, no ambos; ambos en cero solo con confirmación ("El cargo y el abono estan a cero desea
actualizar de todas maneras?").

### 4.6 Impuesto LIOF

- Casilla "Calcular Impuesto LIOF" (`CIMPUESTO`). Solo con moneda base, **monto > 1,000** (umbral fijo en el
  código), y si la cuenta bancaria **no** es exenta (`cexenta`) [V].
- Genera dos líneas: **abono** a la cuenta bancaria y **cargo** a `cfg_gasto`, por
  `redondeo(monto × cfg_liof / 100, 2)`. Detalle `IMPUESTO POR EMISION DE CHEQUE No. <n>` [V].
- **Hallazgo:** el código condiciona estas líneas a `TMOV.TIPO_OPE = 1` (tipos que *cargan* banco, como la
  remesa), mientras que el cheque tiene `TIPO_OPE = 2`. Leído al pie de la letra, el impuesto no se generaría para
  cheques. En los datos hay líneas con la palabra "IMPUESTO" en transferencias y cheques (164 líneas) y 22 documentos
  con la casilla marcada, así que **en la práctica se usó**; el texto de esas líneas no coincide con el del código
  actual [D]. No se pudo resolver sin ejecutar; ver pregunta 13.
- **Nueva plataforma:** el impuesto es una **línea más del documento** con regla de configuración
  (`liof_rate`, `liof_threshold`, cuenta de gasto), calculada con decimal exacto, redondeo a 2 decimales,
  visible y editable antes de aplicar.

### 4.7 Estatus del cheque y postfechados

- Casillas: **Impreso** → **Firmado** (pide fecha: `fecfirma`) → **Entregado** (pide fecha y quién recibe:
  `fecentrega`, `recibe`) → **Cobrado**. Solo cheques; Firmado exige Impreso; Entregado exige Firmado;
  Cobrado exige Impreso y postfechado [V]. Si se desmarca Impreso, se limpian Listo y Entregado.
- **Postfechado:** si hay "Postfechado para" (`fcobro`), `postfe = verdadero` [V]. El reporte H lista los
  cheques con `fcobro` posterior a la fecha de consulta y no anulados [V]. La disponibilidad (§12) los descuenta
  del saldo disponible hasta su fecha.
- En los datos: 1 postfechado de 2,691 movimientos y ninguno con "Cobrado" [D]; las banderas de firmado y
  entregado se usan poco.

### 4.8 Impresión

- **Cheque:** "Imprimir" en `sbmdoc01` o el lote en `sbichv01` (cheque inicial/final, "Cheque Continuo" o
  "Cheque Manual"). Marca `impreso`. Al terminar ofrece "Desea emitir detalle de facturas canceladas" (reporte
  `sbdque01`: los documentos que paga el cheque) [V]. El formato es el nombre en `CTABANCO.FORMACHK` [V].
- Documentos que no son cheque: "Imprimir" abre el comprobante contable (`cgipar01`) del número de partida.
- **Hallazgo:** hay **dos caminos que suman al saldo de la cuenta**: grabar (si `impreact`) y la impresión por
  lote (`SBICHE02` suma el monto de los cheques aún no impresos). Ver §6.

### 4.9 Grabar

1. Si el número de partida está vacío: "Debe especificar el numero de partidas".
2. Recalcula `tipomov` de cada línea (1 cargo / 2 abono).
3. **Si cargos ≠ abonos:** "La partida NO CUADRA por X" y **no graba** (sin consultar `cfg_cuadre`) [V].
4. Revisa si alguna línea usa `cfg_iva_cf`: habilita "Ingresar al Iva" y, con `cfg_l_iva`, abre `ivacomp2` al terminar.
5. **Número de partida** (ver §5.2): si ya existe, toma el siguiente.
6. Cheque nuevo: reasigna número si colisiona y actualiza `corre`.
7. Si hay proveedor: libera y vuelve a aplicar los pagos a documentos (§10.5).
8. Escribe `MOVIBAN` + `DETABANK`, actualiza el saldo de la cuenta (§6) y **escribe la partida en el GL** (§5).
9. En modificación primero **revierte** el documento anterior (borra encabezado y líneas, resta del saldo,
   revierte los saldos del GL) y luego graba el nuevo [V].

Las transacciones que no son cheque quedan `impreso = verdadero` al grabarse [V].

### 4.10 Anular

Pide confirmación (`Anular Comprobante <oper> <número>?`) y ofrece "Desea Copiarlo Con un Nuevo Numero"
(`sbchgnm2`). Luego [V]:

- libera los documentos de CxP que pagaba el cheque (`qwcanque` modo 2);
- revierte el efecto en el saldo de la cuenta;
- deja el encabezado con monto 0, `anulado = verdadero`, `impreso = verdadero`, beneficiario y concepto
  `** ANULADO **` (y `ANULADO CH. No. <n>` en las líneas), **conserva el número**;
- en el GL deja la partida con concepto ` ANULADO ` y **todas las líneas en cargo 0 / abono 0** (detalle
  `ANULADO`), revirtiendo los saldos.

En los datos: ningún movimiento anulado [D].
**Nueva plataforma:** anular = estado `voided` del documento + **anular la partida del GL** (soft delete con
su número retenido) y liberar los pagos aplicados; no se ponen líneas en cero.

### 4.11 Eliminar y modificar

- Eliminar: bloqueado si el cheque ya está impreso ("CHEQUE YA ESTA IMPRESO... NO PUEDE SER ELIMINADO..") [V].
  Si no, pide "Se eliminara <oper> # <n>!!!", libera pagos, revierte saldo y **borra físicamente** el
  movimiento y su partida [V]. **Nueva plataforma:** nunca borrar; un cheque no impreso se anula.
- Modificar: reversa y regraba (§4.9). Un documento de mes cerrado no se toca [V].
- **Cambiar número a comprobante** (`sbchgnum`): cambia el número del documento (solo tipos cheque; el nuevo
  número no puede existir: "Comprobante Ya Existe") [V]. Si propaga el cambio al texto de las líneas o al GL no se
  verificó *(inferido: no)*. **Nueva plataforma:** permitido con bitácora, el número queda como atributo, el GL
  conserva la referencia por id.

## 5. Integración con el GL (cómo Bancos postea en CONTAC)

### 5.1 Mecanismo [V]

Cada transacción crea **una partida en `PARTIDAS` + sus líneas en `DETAPART`** en la misma operación que
guarda el movimiento, dentro de la pantalla del usuario (sin proceso por lotes). El tipo de partida es
`TMOV.TIPOPAR`. Las partidas generadas solo tienen las columnas estándar (`tipopar`, `numero`, `concepto`,
`fecha`, `salfec`, `cerrado`, `generado`). El vínculo con el movimiento bancario es solo por
`MOVIBAN.TIPOPAR + NUMERO + SALFEC` (no existe un id).
`CGADIPAR.PRG` además actualiza `SALDOS` y `SALDOCC` sumando hacia arriba por la cadena `anterior`, con la
naturaleza por tipo de cuenta (deudora: 1, 4, 6; acreedora: 2, 3, 5, 7), idéntico a CONTAC.

### 5.2 Número de partida

El siguiente número del tipo (`TMOV.TIPOPAR`) en el mes = mayor número del mes + 1, con ceros según
`cfg_digcom`; el usuario puede escribir otro; si ya existe ("Comprobante <tipo> <n> YA EXISTE!.") o el
número está tomado en otro sistema (`conta()`), no avanza. Al grabar, si fue ocupado entretanto, se toma
el siguiente. **No hay tabla de correlativos en uso** (`CORREL` existe y está vacía) [V][D].
**Nueva plataforma:** pedir el siguiente número a la API del GL (`nextNumber`), dentro de la misma
transacción; el número de una partida anulada no se reutiliza.

### 5.3 Marca de origen (`generado`)

CONTAC bloquea borrar partidas con `generado = 1` ("ELIMINE DESDE EL MÓDULO DE BANCOS"). **La versión viva ya
no escribe `1`:** la línea que lo hacía (`replace generado with sistema`) está comentada en `CGADIPAR.PRG`;
`CGADIPA2.PRG` (remesa concentrada) escribe `9` por omisión. En los datos de partidas: `generado = 1`
en 1,551 partidas, `9` en 40, `0` en 1,649 y vacío en 1,969 [D]; que las vacías sean las más recientes y
las de egresos/transferencias de Bancos es una deducción *(inferido)*, porque el campo `fecha` de la partida no
indica la versión del programa que la creó. Es decir, **hoy las partidas de Bancos más
nuevas se pueden editar o borrar desde CONTAC**, y eso es lo que produce las diferencias entre `DETABANK`
y `DETAPART` (§1).
**Nueva plataforma:** `gl_journal_entries.source = 'bancos'` y `source_ref = <id del documento bancario>`;
el GL rechaza editar o anular una partida con `source = 'bancos'` desde su pantalla ("Anule el documento desde
Bancos"). Para el historial: el importador marca `source = 'bancos'` cuando existe un `MOVIBAN` que apunta a la
partida (por `salfec + tipopar + numero`), aunque `generado` esté vacío (pregunta 14).

### 5.4 Qué se debita y se acredita

| Evento | Partida (tipo según `TMOV.TIPOPAR`) | Dónde se define |
|---|---|---|
| Cheque / transferencia con proveedor | Cargo: cuenta del proveedor (`PROVEDOR.CTA`) por el monto · Abono: cuenta contable de la cuenta bancaria | `sbmdoc01` |
| Cheque / transferencia sin proveedor | Abono: banco · Cargo: líneas que captura el usuario | `sbmdoc01` |
| Remesa / NA / ventas | Cargo: banco · Abono: líneas que captura el usuario | `sbmdoc01` |
| Nota de cargo | Abono: banco · Cargo: captura | `sbmdoc01` |
| LIOF | Abono: banco · Cargo: `cfg_gasto` (§4.6) | `sbmdoc01` |
| Provisión de un documento de CxP | Ver §10.6 | `qwprovi1`, `qwgpro01` |

### 5.5 Cuándo se crea, actualiza y elimina

| Acción en Bancos | Efecto en el GL |
|---|---|
| Grabar documento nuevo | Crea partida y línea de saldos |
| Modificar | Borra la partida anterior (revierte saldos) y crea la nueva, **con el número que tenga el formulario** |
| Eliminar (cheque no impreso) | Borra la partida |
| Anular | Deja la partida con líneas en cero y concepto ` ANULADO ` |
| Imprimir cheque | No cambia el GL |
| Conciliar | No cambia el GL |

### 5.6 Quién bloquea qué

- CONTAC bloquea eliminar partidas con `generado = 1` (§5.3).
- Mes cerrado en CONTAC (`PARTIDAS.CERRADO`) bloquea Bancos para ese mes (§4.2, §11).
- No hay bloqueo del GL hacia **modificar** el monto de una partida de Bancos desde CONTAC [V].

### 5.7 Remesa concentrada y la integración inversa (`sbreme01`, `CGADIPA2.PRG`)

"Partida de Remesa Concentrada" es una captura de **partida contable directa** (copia del editor de CONTAC,
con `cfg_bancos = .F.`). Al grabarla, `CGADIPA2.PRG` crea la partida con `generado = sistema (9)` **y por cada línea
cuya cuenta es la cuenta contable de alguna cuenta bancaria genera un movimiento en `MOVIBAN`**:
cargo → `tipo_ope = 2` (entra dinero); abono → `tipo_ope = 1`; el tipo (`tipo`) sale de buscar `TMOV` por el tipo de
partida; monto = el cargo/abono; beneficiario = concepto de la partida; `impreso = verdadero`; sin proveedor
[V]. **No actualiza `cargos`/`abonos` de la cuenta** (revisar al migrar, §6). Sirve para depósitos con
muchas líneas y para registrar en Bancos lo que se contabilizó directo. **Nueva plataforma:** en lugar de
generar movimientos, el módulo `banking` debe poder **vincular** un movimiento bancario a una línea de partida
existente de una cuenta bancaria (pantalla "Movimientos sin documento").

## 6. Saldo de la cuenta bancaria

- Guardado en `CTABANCO`: `cargos`, `abonos`, `saldoact = saldoi + cargos − abonos`, actualizados
  **incrementalmente** en `SBADIMOV`/`SBADTRAN` al grabar, modificar, anular o eliminar (`tipo_ope = 1` suma a
  `abonos`; el resto a `cargos`) [V]. Existe la utilidad "Reconstruir Saldos", pero **su código está comentado**.
- Los reportes **no** usan `saldoact`: recalculan desde los movimientos. `SBCDIANT.PRG`: saldo anterior a una
  fecha = `saldoi` + Σ monto (`tipo_ope = 2`) − Σ monto (`tipo_ope = 1`) de los movimientos con fecha entre
  `fechasal + 1` y el día anterior; si la consulta es anterior a `fechasal`, el saldo es 0 [V].
- Riesgos del legado: dos caminos suman al saldo (grabar e imprimir por lote); `CGADIPA2` no lo actualiza;
  la edición de la partida desde CONTAC no lo actualiza. No se pudo verificar si `saldoact` cuadra con
  los movimientos; hay que comprobarlo en la paridad.
- **Nueva plataforma:** el saldo **se calcula** (saldo inicial + Σ movimientos aplicados hasta la fecha); no hay
  tabla de saldos. El saldo del banco según libros debe cuadrar con el saldo de la cuenta contable en el GL.

## 7. Clasificación de remesas (`cfg_liqui`)

Con `cfg_liqui` activo, al grabar se ejecuta `clasifica` para clasificar el ingreso con la tabla `CLASIF`
(código y nombre; `DETACLA` = detalle por cuenta). En los datos `cfg_liqui` está apagado y `CLASIF`/`DETACLA`
están vacías en el folder de datos [V][D]. *(Inferido)* sirve para liquidar remesas por rubro; no se migra salvo
que el negocio lo pida (pregunta 15). La remesa concentrada está en §5.7.

## 8. Conciliación bancaria

**Existe, pero es mínima: solo marca movimientos; no se captura el estado de cuenta** [V]
(`sbmconci`, `sbrconci`).

- Se elige la cuenta y el mes. Aparecen **todos los movimientos de esa cuenta hasta el mes de trabajo que no
  están conciliados** (`salfec ≤ mesact` y no `conciliado`), más los ya conciliados *en este mes*
  (`mesconci = mesact`).
- Una casilla por movimiento (y "Conciliar Todo"). Grabar guarda `conciliado` y `mesconci` por movimiento
  (la llave es mes + cuenta + tipo + número + monto; si hay dos movimientos idénticos se confunden).
- Reporte (`sbrconci`): el usuario escribe el **saldo final según banco**, "Elaborada por / Revisado /
  Autorizado", y se imprime la conciliación: saldo en libros (por `sbcdiant`), saldo del banco y la lista de
  movimientos **no conciliados al fin del mes** (con partidas conciliadas después del mes). Los formatos y nombres de los firmantes se recuerdan en `CONCILIA.MEM`.
- No hay importación de estados de cuenta (la tabla `CONFIGUR`, que parece describir el formato de un archivo
  del banco, está vacía y sin código que la use [D]). No hay emparejamiento automático.
- En los datos **ningún movimiento está conciliado** (0 de 2,691): la función casi seguramente no se usa [D].
- **Nueva plataforma:** `bnk_reconciliations` por cuenta y mes (saldo del banco, firmantes, cierre) e ítems
  por documento; la pantalla es la misma de marcar, más el saldo del estado de cuenta y la diferencia visible
  (saldo libros − saldo banco ± partidas en tránsito). Importación de estado de cuenta: fase posterior.

## 9. Impuestos

### 9.1 IVA crédito fiscal

`cfg_iva_cf` es la cuenta del IVA crédito. Si una línea de la partida de Bancos la usa, se habilita "Ingresar
al Iva" y (con `cfg_l_iva`) se abre `ivacomp2` para registrar el documento en el libro de compras (`LIBCOMP`):
comprobante, registro, fecha, tipo de movimiento, exentas, gravada, internas/importaciones, IVA, IVA retenido
y percibido, Cotrans, Fovial, otros impuestos, retención a terceros, y la clasificación de la declaración
(tipo de documento, tipo de operación, clasificación costo/gasto, sector, tipo de costo/gasto) [V]. La
rutina `OFCOMPRA.PRG` actualiza el libro. **Nueva plataforma:** pertenece al módulo `tax`; Bancos y CxP solo
le pasan los datos del documento (`source_ref`).

### 9.2 IVA retenido y percibido (CxP: `sbmfac01`)

- IVA = `redondeo(afecta × cfg_iva / 100, 2)`, recalculado al cambiar el afecto; editable [V].
- **IVA retenido:** solo si la **empresa** es gran contribuyente (`EMPRESAS.GRANDE`), el **proveedor no** lo es
  y el documento tiene número de comprobante de retención: `redondeo(afecta × cfg_ivare / 100, 2)` [V].
- **IVA percibido:** si la empresa **no** es gran contribuyente y el proveedor sí:
  `redondeo(afecta × cfg_ivare / 100, 2)` — se usa la **misma** tasa `cfg_ivare` [V].
- **Renta** (retención de renta): monto digitado; si es > 0 se registra en `RENTAT` (comprobante, NIT, nombre,
  monto gravado, renta, fecha, período) [V]. Si se modifica, el registro se borra y se vuelve a crear.
- **Total** = afecta + exenta + IVA − IVA retenido + IVA percibido − renta + otro cargo; saldo inicial = total [V].
  Los 204 documentos de los datos cumplen la fórmula [D].
- Comprobante de retención: número de 10 dígitos con ceros; único por documento ("# Retencion ya fue asignado a
  otro documento"); se imprime con el reporte `qwreten` [V].
- **Nueva plataforma:** montos como decimales exactos; la fórmula y la tasa viven en un solo servicio de
  `tax`; el comprobante de retención tiene numeración propia.

### 9.3 LIOF — ver §4.6. 

## 10. Cuentas por pagar

### 10.1 Qué es cada tabla [V]

| Concepto | Tabla | Nota |
|---|---|---|
| Proveedor | `PROVEDOR` | código C10; el prefijo `+` crea un "proveedor solo nombre" en `NOMBRES` (vacía en los datos) |
| Tipo de comprobante | `COMPROB` | CCF, NC, FACT, RC; `operacion` 1 = débito/aumenta la deuda, 2 = crédito |
| **Documento por pagar ("quedan")** | `QUEDAN` | una fila por documento del proveedor; el campo `quedan` es el **número de quedan** que agrupa documentos |
| **Pago aplicado a un documento** | `MOVQUE` | una fila por documento que paga un cheque/transferencia o una cancelación manual |
| Notas de crédito/débito | `NCREDEB` | aplicadas a un documento (`tipcomp2`+`comprob2`) |
| Líneas de la provisión | `PROVISIO` | cuentas y montos de cada documento antes de pasar al GL |

El "quedan" en El Salvador es el comprobante que se entrega al proveedor con la fecha de pago; aquí el
mismo número de quedan puede agrupar varias facturas de un proveedor.

### 10.2 Proveedor (`sbmpro01`)

Código obligatorio, único ("Código ya Existe"); número de registro de IVA único ("Registro ya Existe");
cuenta contable opcional pero, si se pone, debe existir y ser de detalle; `plazo` (días de crédito);
`grancon` (gran contribuyente); NIT/DUI/pasaporte; resolución y serie por omisión del proveedor; giro,
actividad económica, departamento y municipio (obligatorios, "no puede quedar en blanco"/"no Existe"); cuenta de
banco, nombre y banco de la cuenta del proveedor [V]. Eliminar: confirma, bitácora y **borra físicamente sin
revisar si tiene documentos** [V]. En los datos: 73 proveedores, 1 gran contribuyente [D].

### 10.3 Documento por pagar (`sbmfac01`)

- Llave natural: **proveedor + tipo de comprobante + número**; único ("Comprobante ya existe para este
  proveedor!"); no se puede cambiar el número si ya tiene pagos o ajustes ("El número no se puede modificar. Ya
  tiene movimientos aplicados!") [V]. En los datos hay 1 llave duplicada [D].
- **Fechas:** con `cfg_llave`, el documento debe caer en el mes de trabajo (hasta 2 meses atrás); "Año/Mes
  Incorrecto"; la recepción no puede ser anterior al documento ("Fecha de Recepción no puede ser anterior a la
  del comprobante").
- **Vencimiento** = recibido + `plazo` del proveedor, **corrido al viernes de esa semana** (si cae sábado,
  al viernes siguiente) [V]. No puede ser anterior a la recepción.
- **Quedan:** se escribe el número, `+` asigna el siguiente, `U` agrega al último quedan del proveedor; si el
  quedan es de otro proveedor "El quedan pertenece a otro proveedor"; si no existe pregunta "El quedan NO existe.
  Desea Crearlo" [V].
- Campos: afecta, exenta, IVA, retenido, percibido, renta, otro cargo, total, `cargo` (ajustes de débito),
  `abono` (pagos y créditos aplicados), saldo = total + cargo − abono; moneda; DTE (código de generación,
  número de control, sello; "Leer json" los llena); `provision`, `provisiona`, `tipopar`, `numdoc` (partida de la
  provisión); sucursal; `siiva` (pasar al libro de IVA); `compra`. Bitácora en alta, cambio y baja [V].
- Eliminar: confirma, bitácora, borra las líneas de provisión y el registro de renta y **borra físicamente** el
  documento (aunque tenga pagos aplicados — no hay revisión) [V]. **Nueva plataforma:** anular solo si no
  tiene pagos ni partida aplicada; si no, hay que revertir antes.
- **Nueva plataforma:** crear un documento **no** genera partida (como hoy); la partida nace al aplicar
  la provisión (§10.6).

### 10.4 Notas de crédito/débito (`sbmfac02`)

Se aplican a un documento existente del mismo proveedor (`tipcomp2`/`comprob2`) y ajustan sus saldos:
`operacion = 1` (débito) aumenta `cargo`; `operacion = 2` (crédito) aumenta `abono`; saldo = total + cargo − abono.
Un crédito no puede exceder el saldo: "El valor a descontar no puede ser mayor de X" [V]. Modificar o eliminar
revierte el ajuste primero. 8 notas en los datos (7 NC) [D].

### 10.5 Pagos aplicados (cheque/transferencia → documentos)

1. En `sbmdoc01`, al elegir **proveedor**, se listan los documentos con saldo ≠ 0 (o solo "No hay Quedan
   pendientes de pago..." si no hay). En `qwcque01` el usuario marca los documentos y el monto a pagar de cada uno
   (pago total por omisión, o parcial por monto o por %). "No puede abonar una cantidad mayor que el saldo..." [V].
2. **El monto del cheque es la suma de los pagos seleccionados** (`sum all pago to m.monto`) [V].
3. Al grabar, `QWCANQUE.PRG` modo 1: por cada pago > 0 → `QUEDAN.abono += pago`, `saldo = total + cargo − abono`,
  `pagos += pago`, `cancelado = número del documento bancario`, `tipo = tipo bancario`; `pagado = verdadero`
  si saldo 0; y agrega una fila a `MOVQUE` (`operacion = 2`, `fechach`, `ctabanco`, `numdoc`, `tipo`, `salfec`).
  Al modificar, antes ejecuta modo 2 (revierte). Modo 2: resta pagos, `pagado = falso` si queda saldo, borra `MOVQUE` [V].
4. **Cancelación manual** (`sbmfac03`): igual pero sin documento bancario (`MOVQUE.sistema = verdadero`);
   cambia `abono`, `saldo`, `pagos`, y `cancelado` con el número; modificar/eliminar revierte [V].
5. Cualquier tipo de documento bancario (no solo cheque) puede aplicar pagos a CxP si se elige proveedor [V].
6. Integridad en los datos: `saldo = total + cargo − abono` se cumple en los 204 documentos; `pagos` ≠ Σ de
   `MOVQUE.pago` en 10 documentos [D]; la causa (pagos manuales de versiones anteriores, 1 `MOVQUE` sin documento) es una deducción *(inferido)*.
   **Nueva plataforma:** `abono` y `saldo` **se calculan** de las aplicaciones y ajustes, no se guardan.

### 10.6 Provisión contable (CxP → GL)

- Por documento (`qwprovi1`, botón "Provisionar Proveedor"): líneas sugeridas [V]:
  - Compra (`operacion = 1`): **abono** a la cuenta del proveedor por el **total**; **cargo** a IVA crédito
    (`cfg_iva_cf`) por el IVA; el **IVA retenido** va a `cfg_iva_re` (abono, si la empresa es gran contribuyente),
    el **IVA percibido** a `cfg_iva_pe` (cargo si la empresa no es gran contribuyente); la **renta** retenida
    **abono** a `cfg_renta`. El gasto o inventario (cargos) los digita el usuario con cuenta y centro de costo.
  - Nota de crédito (`operacion = 2`): sentido contrario.
  - Las líneas se guardan en `PROVISIO` (llave proveedor + tipo + número) y **deben cuadrar**
    ("NO CUADRA POR X" bloquea Grabar); máximo `cfg_qlinea` líneas.
- Generar provisión (`qwgpro01`): se eligen documentos "pendientes de provisionar" en un rango de fechas,
  un **tipo de partida**, número y concepto; se crea **una sola partida** con las líneas de todos los
  documentos y se marca cada uno (`provisiona = verdadero`, `tipopar`, `numdoc`) [V]. La partida **no** queda con
  `generado`. "Documentos No provisionados" lista los pendientes.
- En los datos: 191 de 204 documentos están marcados como provisionados [D].
- **Nueva plataforma:** módulo `accounts-payable` publica esa partida al GL con `source = 'cxp'` (hay que
  agregarlo a `ENTRY_SOURCES`, hoy solo `manual, bancos, iva, cierre, importado`; ver pregunta 21) y
  `source_ref = id del lote de provisión`; opción de una partida por documento. Anular un documento ya
  provisionado requiere anular su partida.

### 10.7 Vencimientos y antigüedad

- `qwrque03` Documentos vencidos, `qwrque05` por vencer, `qwrque04` programación de pagos: filtran por `vence`
  y saldo ≠ 0 [I: la lógica está en los reportes].
- **Antigüedad** (`ccranti1`, `ccranti2`, `sbanti01.frx`) [V]: corte = fecha elegida; `días = corte − vence`;
  tramos: **por vencer (≤ 0)**, **1–30**, **31–60**, **61–90**, **91–120**, **≥ 121**. Solo documentos con
  `saldo > 0`. `ccranti2` filtra "más de N días vencidos". Opciones: todos los proveedores o rango, detallado
  o consolidado, por código o alfabético.
- **Antigüedad retroactiva** (`sbrsaldo`): reconstruye saldos a una fecha pasada con documentos (`fecha ≤ corte`),
  pagos (`MOVQUE.fechach ≤ corte`) y notas (`fecha ≤ corte`) [V].
- Reportes de cuenta: estado de cuenta (`sbrest01`), histórico por proveedor y por documento (`sbrhist1`,
  `sbrhisdo`), auxiliar (`sbrauxi`, con `LLENACXP.PRG`: documentos y pagos con el cheque que los pagó) [V].

## 11. Cierre de mes

- **Bancos no tiene cierre propio:** "Cierre de Mes" en Utilidades no tiene código activo [V].
- El cierre vive en CONTAC (`cgcmes01`/`cgames01`) y **recorre también `MOVIBAN`** para marcar `cerrado`
  [V]. Bancos solo lee esa marca (§4.2). En los datos ningún movimiento de Bancos está cerrado (0 de 2,691;
  27 meses de 2022-01 a 2024-03) [D].
- **Nueva plataforma:** el estado del período vive en `gl_periods`. `banking` y `accounts-payable` consultan
  el período del GL; un documento bancario con fecha en un período cerrado se rechaza.

## 12. Reportes y consultas

| Reporte | Contenido y regla |
|---|---|
| Listado de cuentas bancarias | Cuentas con banco, tipo, moneda |
| Saldos bancarios | Saldo por cuenta a una fecha |
| Libro auxiliar de bancos | Movimientos entre dos fechas con saldo anterior (`sbcdiant`) y saldo corrido |
| **Disponibilidad diaria** | Por cuenta y fecha: saldo anterior = `saldoi` + entradas − salidas hasta el día anterior; excluye cuentas con `dispo` falso; **resta los cheques y remesas postfechados con `fcobro` posterior a la fecha**; filtra por tipo de cuenta |
| Cheques emitidos | Por cuenta y rango; "Fecha inicial debe ser menor que la final" |
| Consolidado de movimientos | Todas las cuentas, rango de fechas |
| Movimientos diarios | Por tipo de transacción, rango de fechas |
| Cheques postfechados | `fcobro ≠ vacío`, no anulado, `fcobro ≥ fecha de consulta` |
| Conciliación | Ver §8 |
| Consulta de cheque | Búsqueda por parte del nombre o del número, tipo cheque, rango de fechas; exporta a Excel |
| Flujo de efectivo | Movimientos del rango con **cuenta contable de contrapartida** y su cuenta padre (`FLUJO`), para clasificar |

Todos se pueden previsualizar, imprimir o exportar a archivo de texto (se piden "Nombre de Archivo").

## 13. Usuarios, permisos y bitácora

- Permiso por pantalla en `PERFIL` (`usuario + programa`, 424 filas vivas de 67,192 registros: la tabla está
  llena de borrados) [D]; nivel de `USUARIOS.USRLVL`: solo el nivel 1 abre `acceso` (administración de usuarios).
  Las empresas permitidas salen de `USREMP`.
- Al elegir empresa el sistema advierte si ya hay otro usuario con el mismo nombre en esa empresa: "Hay otro
  Usuario Registrado con la misma Identificacion, Pueden generarse problemas, desea proceder..." [V].
- Bitácora (`BITACORA`): usuario, fecha, hora, programa, concepto. Registra alta/cambio/baja de cuentas
  bancarias, proveedores, documentos de CxP y cancelaciones manuales [V]. **No registra** emisión, modificación,
  anulación ni eliminación de documentos bancarios [V: no hay llamada en `sbmdoc01`].
  **Nueva plataforma:** bitácora (`audit`) en toda alta, cambio, anulación e impresión.

## 14. Mensajes de validación (citas de la interfaz)

Bancos: "Cuenta de Banco NO EXISTE!!!", "Debe seleccionar una cuenta corriente!!!", "Debe digitar el Numero de
la Transaccion", "Comprobante Ya Existe fue hecho en ! …", "Comprobante No Existe!", "La fecha debe ser mayor que …",
"La partida NO CUADRA por …", "Debe especificar el numero de partidas", "MES CERRADO. SOLAMENTE CONSULTA...",
"CHEQUE YA ESTA IMPRESO... NO PUEDE SER ELIMINADO..", "No hay Quedan pendientes de pago...", "Proveedor no Registrado",
"Fecha inicial debe ser menor que la final", "Cuenta de Banco NO EXISTE!!!", "Lo siento no tiene Acceso a esta opción".
CxP: "Comprobante ya existe para este proveedor!", "Proveedor no tiene quedan pendientes!", "Tipo de Comprobante NO
Existe!", "El quedan pertenece a otro proveedor", "Fecha de Vencimiento no puede ser anterior a la de recepción",
"El valor a descontar no puede ser mayor de …", "No puede abonar una cantidad mayor que el saldo...",
"# Retencion ya fue asignado a otro documento", "Código no puede quedar en blanco", "Codigo inicial tiene que ser menor
que el final", "Fecha de Corte no puede quedar en blanco".

## 15. Hallazgos, incoherencias y código muerto

1. **Integración a medias:** la marca `generado = 1` ya no se escribe; ver §5.3.
2. **Dos copias de las líneas** (`DETABANK`/`DETAPART`) divergen en el 8 % de las líneas (§1).
3. **Saldo de cuenta incremental y con varios caminos** (§6); "Reconstruir Saldos" desactivado.
4. **`tipo_ope` con dos significados** (§3.3).
5. **LIOF** condicionado al tipo que no corresponde al cheque (§4.6).
6. `conta()` (verificación de número de partida contra otro sistema) y `estrans` (transferencia entre cuentas
   propias, bandera `MOVIBAN.XFER`) **no están en el proyecto**: la transferencia entre cuentas no funciona hoy;
   `sbmtran` ("A cuenta", "tipo de transferencia") no está en el menú. Las "transferencias" de los datos son pagos
   a proveedores (tipo 6) [V][D].
7. Eliminaciones físicas sin revisar dependencias (cuentas bancarias, proveedores, documentos de CxP).
8. Tablas sin uso ni código: `REMESA`, `CONFIGUR`, `MOVBAN`, `MOVCONT`, `MOVCUEN`, `TIPODOC`, `CORREDOC`,
   `CUADRE`, `SALIDA`, `DETAQUE` (el nombre se usa pero la tabla está vacía), `CORREL` [V][D]. `CHEQUE` y los
   campos `PROYECTO/HACIENDA/CONTRATIS` pertenecen a un módulo de obras.
9. Tablas de trabajo en `fuente/` y en `CONTAC/dbf` (`PTEMP*`, `DTEMP*`, `PPROV*`, `DPROV*`, `ESTCXP`, `DISPONE`,
   `FLUJO`, `SALVE`, `KK`, `PP`, `PP2`, `CONCI*`, `NCREDEBV`, `MOVQUEV`): no se migran; algunas (`PP`, `PP2`, `KK`) parecen
   copias de seguridad de datos reales.
10. Archivos `ERROR.DBF`, `FLUJO1.DBF`, `MSGERR.DBF` en `fuente/` están corruptos (cabecera inválida).
