# cxc64 — Reglas de negocio

Extraídas de las pantallas `ccmmov01.scx` (factura), `ccmmov02.scx` (nota de débito), `ccmmov03.scx` (nota de
crédito), `ccabono.scx` + `CCABONO.SPR` (abono), `ccmliqve.scx` + `ccmliqv2.scx` + `ccmliqV2.SPR` (liquidación),
`ccmmov04.scx` (cargos por cheques), `ccmmov05.scx` (remesas), `ccmmov06.scx` (abonos internos), `ccmmov09.scx`
(cargos internos), `ccmpant1.scx` + `CCMPANT1.SPR` (anticipos), `ccaplinc.scx` + `ccpnc.scx` (aplicar NC),
`ccmueve.scx`, `ccdesap.scx`, `ccmmovqu.scx`, `cancela.scx`, `ccpost01.scx`, `cierre1.scx`, `inabre.scx`,
`ccmcli01.scx`, `ccmcli02.scx`, `ccmtmov1.scx`, `config2.scx`, `ccmiva.scx`, `estado.scx`, `ccranti2.scx`,
`ccrestc1.scx`, `ccrlimit.scx`, `ccraut1.scx`, `camcli01.scx`, `camdoc01.scx`, `camven01.scx`,
`ccpart.scx`, `ccpartde.scx`, `ccpartna.scx`, `ccpartab.scx`, `ccpartre.scx` (+ sus `.SPR`), `rventaybancosv2.scx`;
programas `CGADIPAR.PRG`, `selemp.PRG`, `access.PRG`, `nomoros.PRG`, `proteger.PRG`; menú `MENU.MPR`; reportes
`ccranti1.frx`, `ccrantc.frx`; de `INV64/FUENTE`: `INMFAC01.scx` (solo la parte que escribe `CCMOV01`) y de
`IVA64/FUENTE`: `IVATRANC.scx`, `IVATRANF.scx` (solo la lectura de `CCMOV01`). Las cifras salen de una lectura
de las tablas de `MCERP/cxc64/DBF`, `MCERP/CONTAC/dbf` (solo conteos; no se copió ningún dato).

Convenciones: **[V]** verificado en el código; **[D]** verificado en los datos; **[I]** inferido.
"Nueva plataforma:" marca dónde el sistema nuevo debe diferir a propósito.

## 1. Cómo está armado el sistema (contexto)

- **Tres carpetas de datos en una sesión** (`SET PATH` en `selemp.PRG`): las tablas de CxC, las del libro mayor
  (CONTAC) y las de inventario (INV64) se abren sin ruta [V]. CxC escribe directo en las tablas del GL (§10) y lee de
  inventario (`FACT`, `CORFACT`, `DEVOL`, `FORMPAGO`, `FELECTRO`).
- **Una sola tabla de movimientos (`CCMOV01`)** para todo: cada fila es un documento *o* una aplicación. Los tipos
  se distinguen por `FTMOV` (§2). El saldo de un documento se guarda en la propia fila del documento (`FABONO`,
  `FCARGO`) y se actualiza **de forma incremental** desde cada pantalla [V].
- **Nada es transaccional.** Cada pantalla toca varias filas una por una (la factura, el abono, el cliente, la fila
  de cheque postfechado); si el programa se interrumpe, quedan inconsistencias. `proteger.PRG` solo reintenta
  el bloqueo del registro ("Registro en uso por otro. Espere por favor") [V].
- **Borrado:** `DELETE` marca el registro y `SET DELETED ON` lo oculta (se elimina físicamente al empacar). En los datos:
  `CCMOV01` 786 de 118,442 registros marcados; `CCCLI01` 8 de 1,800; `DETACOB` 481; `DETADES` 10,065 [D].
- **Las llaves son índices, no restricciones:** la unicidad se valida con `SEEK` en cada pantalla (§3.3, §5).
- El **mes de trabajo** (`mesact`, `AAAAMM`) es el de la empresa (`MESACT.MEM`) y se usa para el cierre (§12).
- **Nueva plataforma:** documentos y aplicaciones en tablas separadas (`ar_documents`, `ar_applications`,
  `ar_receipts`); una transacción de base de datos por operación; llaves únicas reales; saldos calculados.

## 2. Tipos de movimiento (`CCTMOV`, pantalla `ccmtmov1`)

El código de 2 caracteres **debe empezar con A, C o P** ("El tipo de Movimiento debe empezar con A, C, P"); `A`
= acredita al cliente, `C` = carga al cliente, `P` = pago anticipado [V]. Los tipos reconocidos por el código y sus
conteos de movimientos en el disco [D]:

| Tipo | Nombre | Efecto | Movimientos |
|---|---|---|---|
| **C0** | Cargo por factura | documento: factura / CCF / exportación | 56,774 |
| **C4** | Nota de débito | aumenta el saldo de una factura (`FCARGO`) | 8 |
| **C3** | Cheque postfechado | partida de control de cheques en poder de la empresa; se cierra con la remesa (A4) | 615 |
| **C2** | Cargo cheque rechazado | documento que reabre la deuda por un cheque devuelto | 1 |
| **C6** | Cargos internos | cargo manual | 0 |
| **C5** / **CR** | Comprobante de retención | catalogados; **sin pantalla ni uso** | 0 |
| **A0** | Abono | recibo de cobro aplicado a una factura | 57,183 |
| **A1** | Nota de crédito por devolución | disminuye el saldo de una factura (o queda sin aplicar) | 2,233 |
| **A3** | Nota de crédito por descuento | ídem | 84 |
| **A6** | Nota de abono por devolución | ídem (numeración propia) | 2 |
| **A2** | (no catalogado) | el código lo acepta como nota de crédito; **sin movimientos** | 0 |
| **A4** | Remesa por cheque | depósito de un cheque postfechado/rechazado | 625 |
| **A5** | Abonos internos | abono sin efectivo (ajuste) | 128 |
| **A7** | Abono por retención | catalogado, sin uso | 0 |
| **A8** | Valor al cobro / deudores varios | catalogado, sin uso | 0 |
| **PA** | Pago anticipado | anticipo del cliente; **sin movimientos** | 0 |

Otras 3 filas con tipo vacío o nulo (basura). Cada tipo trae hasta tres **cuentas contables** (`CTA`, `CTA2`,
`CCTAE`, y un `CCTA` siempre vacío) que gobiernan la generación de partidas (§10); cada una se valida como cuenta
existente del catálogo (en la pantalla: "Cuenta No Existe!") [V].

**Nueva plataforma:** `ar_document_types` con código, nombre, `kind` (`invoice`, `debit_note`, `credit_note`, `receipt`,
`check_postdated`, `check_rejected`, `internal_charge`, `internal_credit`, `remittance`, `advance`), y una tabla
`ar_posting_accounts` (tipo + rol → cuenta del plan) en lugar de tres columnas anónimas.

## 3. Documentos que crean una cuenta por cobrar: la factura (C0)

### 3.1 Quién las crea [V]

1. **Inventario (`INMFAC01` crédito fiscal, `INMEXP01` exportación, factura de consumidor final)**, al grabar la factura de
   venta, hace `SEEK("C0"+número+tipo)`, agrega la fila si no existe y escribe: fecha, número (`FREF` = `FNFAC`), cliente
   (`FCTA` = código del proveedor en inventario), **total** (`FMON`), **IVA** (`FVALIVA`), **exento** (`FEXEN`), **gravado**
   (`FGRAV`), **retención** (`IVAPER`), tipo (`FTICOM`), vendedor (`FVEND`, `FVEND2`), **plazo** (`FPLAZO`), **vencimiento**
   (`FFPAGO` = fecha + plazo), transportista, % de comisión, flete, serie y resolución del documento, peso y la marca
   `BUTTER` [V]. Al facturar, inventario toma plazo, vendedor y transportista **de la ficha del cliente** y **rechaza a
   un cliente inactivo** ("Cliente Inactivo, no puede Facturar") [V]. No consulta límite de crédito ni "suspendido" [V:
   solo `inactivo`].
2. **La pantalla "Creación de Facturas/comprobantes" (`ccmmov01`)** captura a mano el mismo encabezado cuando el documento no
   pasa por inventario. En los datos, 38 facturas tienen el concepto "CARGO POR FACTURACION" que escribe esta pantalla
   (0.07 %); **el 99.9 % viene de inventario** [D].
3. 13,760 de 56,774 facturas traen serie y resolución (documentos tributarios electrónicos más recientes); las demás no [D].

**Nueva plataforma:** la factura nace en `inventory` (ventas) y publica a `accounts-receivable` por API con el contrato
(`customer`, `type`, `number`, `date`, `terms_days`, `taxable`, `vat`, `exempt`, `vat_withheld`, `total`, `salesperson`,
`dte_*`, `source_ref`); la captura manual de `ccmmov01` queda para clientes sin inventario (pregunta 1).

### 3.2 Tipo de comprobante (`FTICOM`)

`C` = Comprobante de **Crédito Fiscal**, `F` = **Consumidor final**, `E` = **Exportación**. Mensaje: "F=Consumidor final,
C=Credito Fiscal, E=Exportación" [V]. En los datos: C 55,280; F 1,472; E 21; 1 vacío [D].

### 3.3 Numeración y unicidad

- Número de 10 caracteres rellenado con ceros a la izquierda ("No.de Doc. no puede quedar en blanco") [V].
- **Llave natural de la factura: `C0 + número + tipo (C/F/E)`**; "Documento ya fue ingresado" si existe [V]. En los datos no hay
  llaves repetidas entre las 56,774 facturas [D]. El número **no es único entre tipos**: el mismo número puede existir como
  `C` y como `F` [I].
- Hay series y resoluciones (`NSERIE` C13, `NRESOLU` C19) pero la unicidad **no las incluye** [V].
- **Nueva plataforma:** único `(empresa_id, type, number)` con serie y resolución como atributos; el número no se
  rellena con ceros al guardar (se normaliza en la importación).

### 3.4 Cálculo de impuestos de la factura (`ccmmov01`, `ccmmov02`, `ccmmov03`)

Tasa de IVA = variable `ivax` (`IVA.MEM`, pantalla `ccmiva` "Configurar la Tasa del IVA") [V]. Con `t = ivax/100`:

| Tipo | IVA | Total (`FMON`) |
|---|---|---|
| **C** crédito fiscal y **E** exportación (rama "else") | `ROUND(gravado × t, 2)` | `gravado + IVA + exento` |
| **F** consumidor final (el gravado **ya incluye** IVA) | `ROUND(gravado / (1+t) × t, 2)` | `gravado + exento` |

El usuario puede editar el IVA a mano en la factura (el campo se habilita solo si `gravado > 0`) [V]. En los datos, los 21 documentos tipo E tienen IVA = 0 (18 con gravado > 0), es decir, la exportación se registra con IVA en cero [D].

**Retención de IVA por cliente gran contribuyente (`IVAPER`)** [V]:

- Variables de configuración: `cfg_ivaper` (% de retención, pantalla "Porcentaje de Retención") y `cfg_mper` ("Monto para
  Retener": el gravado mínimo) y `EMPRESAS.GRANDE` (la propia empresa es gran contribuyente) [V].
- **Si la empresa NO es gran contribuyente** (`!grandex`) y el cliente sí (`CCCLI01.GRANCLI`) y, en crédito fiscal,
  `gravado ≥ cfg_mper`: `IVAPER = ROUND(gravado × cfg_ivaper/100, 2)` y **`FMON = gravado + IVA + exento − IVAPER`** (el cliente retiene
  y paga menos). Para consumidor final (F) el total también se reduce por `IVAPER`, pero el campo se captura a mano.
- Si la empresa **sí** es gran contribuyente, el monto no se descuenta del total: `IVAPER` se interpreta como IVA
  **percibido** que ya viene dentro del total (§10.2).
- **Nombre engañoso:** la pantalla lo rotula "Retención" pero la columna se llama `IVAPER` ("percibido"); en CxP (BANCOC) los
  nombres son `IVARE`/`IVAPER` con otro sentido (retenido por la empresa / percibido). Una sola tasa para todo, sin escalones.
- En los datos: 20,917 facturas tienen `IVAPER ≠ 0` (37 %); 20,743 pertenecen a clientes marcados gran contribuyente y 174 no
  [D]. La empresa de los datos **no** es gran contribuyente (`EMPRESAS.GRANDE` = falso) [D]. Verificación: `FMON = gravado + IVA +
  exento − IVAPER` (tipo C) o `gravado + exento − IVAPER` (tipo F) se cumple en 56,732 de 56,774 facturas; difieren 42
  (tolerancia 0.02) [D].
- **Nueva plataforma:** un solo servicio de impuestos (`tax`) calcula IVA y retención con `decimal.js`; la **tasa de retención
  y el mínimo** son configuración de `tax_settings`; la columna se llama `vat_withheld_by_customer` y se documenta el signo.

### 3.5 Fechas, plazo y vencimiento

- `FPLAZO` (días de crédito) viene de la ficha del cliente; **0 = contado**. `FFPAGO = FFEC + FPLAZO` (días naturales; **no** se corre
  a viernes como en CxP) [V]. En los datos: plazo 30 días en 44,870 facturas, contado (0) en 11,807 [D].
- La fecha no puede estar en un **mes cerrado** de cartera (§12). No hay regla de fecha respecto al mes de trabajo [V].
- `FCANCELA` = fecha en que el saldo llegó a cero (se mantiene en cada pantalla; ver §6.1). 56,056 de 56,774 facturas lo tienen [D].

### 3.6 Modificar, eliminar, anular

- **Modificar:** exige `permim` y mes no cerrado; ajusta el contador del cliente `FCARM` [V].
- **Eliminar:** exige `permi`; "Primero elimine los cargos y abonos" si `FCARGO ≠ 0` o `FABONO ≠ 0`; mes no cerrado; deja bitácora
  ("Elimino la Factura …"); `DELETE` de la fila [V].
- **Anular** (en inventario): "No puede anular, elimine primero los abonos" si `FABONO > 0`; solo en el mes de trabajo y no cerrado; exige
  nivel de usuario 1 o `permia`; deja la fila con **`FCTA` = "ANULADA"** y montos en cero (2,384 facturas así en los datos: 4.2 %) [V][D].
  Las notas de crédito anuladas desde CxP quedan con `FCTA` = "ANULADO" (45 filas) [V][D].
- **Nueva plataforma:** anular = `status = 'voided'` con motivo, el cliente **se conserva**, el número se retiene y
  se rechaza si tiene aplicaciones; nunca se sobrescribe el código de cliente con un texto.

## 4. Notas de débito (C4) y de crédito (A1, A3, A6)

### 4.1 Nota de débito (`ccmmov02`)

- Se aplica a una **factura existente** (`C0 + FNFAC + tipo`): "Documento no existe". El cliente y el vendedor salen de la factura.
- Mismo cálculo de IVA que la factura (§3.4) pero **sin retención**. Número único `C4 + número` ("Documento ya fue registrado").
- Al grabar: `FCARGO` de la factura `+= monto` y, si `FMON + FCARGO − FABONO ≤ 0`, `FCANCELA = fecha`, si no se limpia;
  `FCARM` del cliente `+= monto` [V]. Eliminar/anular revierte los dos.
- En los datos hay solo 8 notas de débito (1 con retención) [D].

### 4.2 Nota de crédito (`ccmmov03`)

- Tipos permitidos: **A1** (devolución), **A3** (descuento), **A6** (nota de abono por devolución), A2: "Tipo de movimiento puede ser A1 o
  A3 o A6". Debe existir en `CCTMOV`.
- **Numeración sugerida:** al agregar, el sistema propone el último número de A1/A3 + 1 (A1 y A3 **comparten** secuencia) y el último de
  A6 + 1 (secuencia propia) [V]. Llave: `tipo + número + tipo comprobante + documento aplicado`.
- Se aplica a una factura existente (`FNFAC`) o queda **sin aplicar** (`FNFAC` vacío): "Documento no existe" si se escribe y no está. Al
  elegirla se avisa el saldo de la factura. Permiso `permiag` para crear.
- **Validación:** "Abono sobrepasa el saldo en X" si el monto de la nota supera el saldo de la factura (`FMON + FCARGO − (FABONO − montox)`).
- IVA igual que la factura. **Inconsistencia [V]:** en consumidor final con cliente gran contribuyente la nota **suma** `IVAPER` al total (`+`) mientras la
  factura lo resta; en crédito fiscal, ambas restan.
- Al grabar: `FABONO` de la factura `+= monto`; `FCANCELA` igual que arriba; `FABOM` del cliente `+= monto`; ofrece imprimir la nota
  (`inrnc02` o el formato de la empresa en `EMPRESAS.FORMANC`) [V].
- **Eliminar:** solo usuario de nivel 1 (`usrlvl = 1`) y `permi`; mes no cerrado; revierte `FABONO` y `FABOM`; `DELETE` de la fila.
  **Anular:** exige `permia`; revierte igual y **deja la fila con `FCTA` = "ANULADO"**, monto 0, concepto "ANULADA" [V].
- En los datos: 2,233 A1, 84 A3, 2 A6; **252 notas de crédito están sin aplicar** (`FNFAC` vacío; 250 A1 + 2 A3) [D].

### 4.3 Notas de crédito sin aplicar y su aplicación

- Una NC sin aplicar es un **saldo a favor** del cliente: aparece en los estados de cuenta y en la antigüedad como partida negativa
  (`cobro = fmon × −1` para A1/A3/A6, `ccranti1.frx`) cuando `FMON + FCARGO − FABONO > 0` y `FNFAC` vacío [V].
- **Aplicar Notas de Crédito (`ccaplinc` → `ccpnc`)** "parte" la NC entre varias facturas: se captura documento destino y monto; no se
  puede aplicar más que el saldo disponible de la NC ("Monto mayor al disponible para Aplicar") ni más que el pendiente de la factura
  ("Monto mayor al pendiente de cobrar"). La factura destino debe ser del **mismo cliente**, o de clientes de la **misma casa matriz**
  si el cliente tiene matriz ("Verifique el Cliente" / "No pertenecen a la misma Matriz"). Al aplicar: `FABONO` de cada factura `+= monto`, se **agrega una
  fila de NC nueva por cada factura** (a nombre del cliente de la factura, con el IVA recalculado sobre el monto aplicado) y **se
  borra la NC original** [V].
- **Mover NC (`ccmueve`)**: cambia el documento al que se aplica (suma al nuevo, resta al viejo). **Liberar NC (`ccdesap`)**: la desaplica
  (`FNFAC` vacío). Ambas dejan bitácora ("Movio Nota de Credito…") [V].
- En el disco existen `APLINUE` y `aplicanc` con 4,644 registros marcados como borrados: son la tabla de trabajo de esta pantalla [D].
- **Nueva plataforma:** `ar_applications(credit_document_id → debit_document_id, amount)`; una NC puede tener varias aplicaciones **sin crear ni
  borrar documentos**; "liberar" = anular la aplicación. El IVA no se recalcula por aplicación (el IVA es de la nota).

## 5. Clientes (`ccmcli01`, `ccmcli02`, `estado`)

### 5.1 Campos y validaciones [V]

- **Código** de 10 caracteres (`FCTA`), obligatorio y único: "Cliente ya existe, verifique". Crear exige `permiag`. Cualquier campo de
  cliente en una pantalla de documento acepta `*` para buscar por nombre (`vercli`, `verclin`).
- Datos de contacto y legales: razón social (`FNCLI` 70), nombre comercial (`NCOMERCIAL`), dirección (90), dirección de entrega,
  teléfonos, correo, **registro de IVA** (`FREGIVA`), **NIT** (`FNIT`), DUI (`CEDULA`), pasaporte, otro documento, actividad
  económica (código del catálogo del MH, `ACT_ECO`), país del MH (`COD_PAIS`), departamento (`FDEP`), municipio (`FMUN`),
  distrito (`COD_MUNICI`), forma de pago del MH (`FORMPAGO`), tipo de persona natural/jurídica.
- **Departamento y municipio obligatorios y existentes** ("Departamento no puede quedar en blanco", "Departamento no Existe",
  "Municipio no puede quedar en blanco", "Municipio no Existe"). **Tipo de negocio obligatorio** y existente ("Tipo de negocio no puede
  quedar en blanco", "Tipo de Negocio no existe"). **Casa matriz** opcional y existente ("Código de proveedor no Existe.."). Visitador
  opcional. **Cuenta contable** opcional pero, si se escribe, debe existir en el catálogo y ser de detalle ("Cuenta no Existe",
  "Cuenta no es de Detalle").
- **Crédito:** `FLIMCRE` (límite), `FPLAZ` (plazo en días), `DESCUENTO` (% fijo), `FTIPC` (clasificación A/B/C…, texto libre de 3), día
  de cobro (`FDCOB`: lunes a viernes) y semanas de visita (`FSEM1..4`, "Esta semana puede ser 0 ó n"), `NPRECIO` (lista de precios), referencias
  comerciales (3, con teléfono, tiempo, forma de pago y "cheque rechazado"), autorizó y observaciones.
- **Casillas:** *Cliente exento* (`FEXENTO`), *Gran contribuyente* (`GRANCLI`, gobierna la retención §3.4), *Inactivo*, *Cliente de contado*
  (`CCONTADO`), *Suspendido*. También `P90` (§8.4) y `LIBERAR`/`BLOQUEDADO` (sin uso).
- **Eliminar:** exige `permi`; "Cliente no puede eliminarse, tiene movimiento" si existe cualquier fila en `CCMOV01`; deja bitácora [V].
  *(A diferencia de BANCOC, aquí sí hay verificación de dependencias.)*
- Alta, cambio y baja dejan bitácora ("Agrego/Modifico/Elimino el Cliente …") [V].

### 5.2 Qué se usa de verdad (datos) [D]

1,792 clientes vigentes de 1,800 registros (8 marcados), 2 códigos repetidos entre los vigentes. 663 inactivos, 5 suspendidos, 528 "de contado",
252 gran contribuyente, 6 exentos, 425 con `P90`. 680 tienen límite de crédito > 0 y 771 plazo > 0. 1,781 tienen vendedor y 1,789 cuenta
contable; **1,786 de 1,789 comparten la misma cuenta contable de control** (una sola cuenta de clientes en el mayor, no una subcuenta por
cliente). 235 tienen casa matriz (18 matrices vivas). 1,562 tienen NIT y 1,464 registro de IVA. Los campos `FSALACT`, `FSANT`, `FSALANT` valen
cero en todos; `FCARM` y `FABOM` (contadores incrementales) tienen valor en 489 y 620 clientes pero **no son confiables** (§7.3).

### 5.3 Límite de crédito y saldo disponible

- **No hay validación de límite de crédito en ninguna pantalla de documento** [V]. Solo se **informa**: la ficha muestra el saldo por tramos (30, 60, 90,
  120, 150) y el *saldo disponible* (límite − saldo) en `estado`, y el reporte "Límites de Crédito y Saldos" (`ccrlimit`) lista cliente, plazo,
  límite y saldo sumando `FMON + FCARGO − FABONO` de sus documentos [V]. La casilla *Suspendido* tampoco bloquea: solo *Inactivo* (en inventario).
- **Nueva plataforma:** el límite es una **advertencia o bloqueo configurable** (pregunta 5); el saldo se calcula, nunca se captura.

### 5.4 Casa matriz

Agrupa clientes de una cadena (`CCCLI01.MATRIZ` → `MATRIZ.CODIGO`, 18 matrices vivas). Sirve para: aplicar una nota de crédito a facturas de otro cliente de
la misma matriz (§4.3) y para el "Estado de Cuenta por Casa Matriz" (`ccrestsu`) [V].

### 5.5 Cambios masivos

- **Cambiar código a un cliente (`camcli01`)**: el código nuevo no puede existir ("Codigo Ya Existe"); reemplaza el código en **todas** las filas de
  `CCMOV01`, `DEVOL`, `CORDEV` y `FACT` [V] y, según los `USE` de la pantalla, también en `CORFACT`, `DETADES` y `DETACOB` [I].
- **Mover documento de un cliente a otro (`camdoc01`)**: reasigna los documentos (en las mismas tablas) a un cliente existente [V].
- **Cambiar cartera de un vendedor a otro (`camven01`)**: cambia el vendedor de los documentos con saldo (`C0`/`C2`/`C3`), de un cliente o de todos [V].
- Ninguna pide confirmación de permiso ni deja bitácora específica en el código leído [I: no se vio llamada a `bitacora` en estos tres].
- **Nueva plataforma:** el código es un atributo; el `id` es estable y no hay que recorrer tablas. Mover documento/cartera: permiso de
  supervisar, bitácora, y solo si el período no está cerrado.

## 6. Abonos: cómo se cobra

### 6.1 El abono (A0) y su aplicación a un documento

Un abono es **una fila `A0` por documento pagado**: `FREF` = número de nota de abono/recibo, `FNFAC` + `FTICOM` = factura que paga, `MOV2` = tipo del
documento pagado (`C0`, `C2` o `C3`), `FMON` = monto, `FTIPO` = forma de pago, `FLIQUI` = liquidación a la que pertenece, `FVEND2` = quién cobró [V].

- **Dónde se captura:** casi siempre dentro de una **liquidación** (`ccmliqve`/`ccmliq02` → detalle `ccmliqV2`/`ccmliq03`): 57,158 de 57,183 abonos
  tienen `FLIQUI` de una liquidación existente (§9). La pantalla suelta `ccabono` produce el mismo registro sin liquidación (en los datos, 25 filas) [V][D].
- **Validaciones** (las mismas en `ccabono` y `ccmliqV2`) [V]:
  - Tipo de documento a pagar: "Tipo de Documento puede ser (C0, C2, C3)" (debe empezar con `C`); "Documento no existe".
  - "Documento ya fue registrado" si ya existe el mismo abono para esa liquidación/documento.
  - **Fecha del abono no menor que la de la factura**: "FECHA DE ABONO NO PUEDE SER MENOR QUE LA DE FACTURA" (en la liquidación).
  - "Debe digitar el valor del abono"; **"Abono sobrepasa el saldo en X"** si el abono excede el saldo (permite el abono anterior al editar). No se permite sobrepagar.
  - **Un número de nota de abono no puede aplicarse a otro cliente**: "Error N/ABONO ya fue aplicada a otro cliente" salvo que la configuración
    `cfg_repetir` ("Repetir Recibo de Caja a Diferente Cliente") esté activa [V]. En los datos, 799 números de abono se repiten en más de un cliente [D].
  - Mes cerrado: "!!Mes Cerrado!!, No Puede Modificar". Crear exige `permiag`, modificar `permim`, eliminar `permi`.
- **Forma de pago (`FTIPO`)**: `EF` efectivo (borra banco y cheque), `CH` cheque, `DE` depósito (el monto se fija al saldo del documento): "Tipo de pago puede ser DE,
  EF, CH". En los datos: EF 47,540; CH 9,626; DE 14 [D]. Casilla *Es transferencia* (`TRANSFER`): 22,410 abonos (39 %) [D]. `CONTADO` = abono creado
  al cancelar ventas de contado (§6.4) [V].
- **Cheque (`CH`)**: obliga banco existente ("Bancos no puede quedar en blanco", "Banco no existe, Verifique") y número de cheque ("No.de cheque no puede quedar en blanco").
- **Efecto al grabar** (`grabar` en `CCABONO.SPR` / `ccmliqV2.SPR`) [V]: inserta la fila `A0`; `FABONO` del documento `+= monto`; si `FMON + FCARGO − FABONO ≤ 0` →
  `FCANCELA = fecha del abono`, si no `FCANCELA` se limpia; si el abono tardó **más de 90 días** respecto a la factura, el cliente queda con `P90 = verdadero`;
  si hay cheque postfechado (§6.2) se actualiza la fila `C3`; al guardar una liquidación se copia la cuenta bancaria (`CTABANCO`) a la fila (solo 18 filas la traen [D]).
- **Modificar** = eliminar el abono anterior (revierte `FABONO`, `FCANCELA`, la fila `C3`) y grabar el nuevo. **Eliminar** hace lo mismo y borra la fila `A0` [V].
- **Nueva plataforma:** `ar_receipts` (encabezado: fecha, cliente, forma de pago, cheque, banco, liquidación) + `ar_applications` (recibo → documento, monto). El número de
  recibo es único por empresa; los 799 duplicados históricos se importan con `legacy_number` no único (ver data-model §4).

### 6.2 Cheques postfechados (C3) y remesas (A4)

- Un abono con **cheque y fecha de cobro** (`FCOBRO`) mayor que la fecha de liquidación ("Fecha de cobro tiene que ser mayor que la de liquidación") es un cheque
  postfechado: exige "Debe especificar en poder de quien queda en cheque", y el sistema **crea o acumula una fila `C3`** (una por cheque + banco + cliente; si el mismo cheque paga varias facturas,
  suma el monto) con `FREF` = número de cheque, `FCOBRO` y `FCONCEPTO` = en poder de quien. "Cheque Existe con diferente fecha de Cobro" si el mismo cheque ya existe con otra fecha [V].
- La fila `C3` es una **partida de control de cheques en cartera**: la factura ya quedó rebajada por el abono; el cheque pendiente queda abierto en `C3` hasta que se **remesa**.
- **Remesa por cheque (`ccmmov05`, tipo A4)**: se elige banco + número de cheque + cliente; el sistema busca la fila `C2` o `C3` ("No existe cargo con ese documento"), propone su
  saldo, y al grabar `FABONO` del cheque `+= monto` (si se salda, `FCANCELA`) y `FABOM` del cliente `+= monto`. "Abono sobrepasa el saldo en X", "Valor tiene que ser mayor de cero" [V].
  *No* se registra en qué cuenta bancaria se depositó (la fila `A4` no tiene `CTABANCO` en los datos: 0 de 625 [D]).
- **Cargos por cheques (`ccmmov04`)**: alta manual de `C2` (rechazado) o `C3` (postfechado) con banco, cheque, fecha de cobro y vendedor ("Tipo de movimiento puede ser C2 o C3"); aumenta `FCARM`.
  No reabre por sí mismo la factura pagada con el cheque; la deuda se registra como un cargo `C2` aparte [V][I].
- En los datos: 615 filas `C3` (todas saldadas), 625 remesas `A4` (622 sobre `C3`, 2 sobre `C2`), 1 cheque rechazado [D].
- **Nueva plataforma:** el cheque recibido es un instrumento con estados (`received`, `postdated`, `deposited`, `rejected`); la remesa (depósito) genera un documento en `banking`
  (cuenta, monto, fecha) y se liga al conjunto de cheques; el rechazo reabre la deuda original (nuevo cargo ligado a la factura) en lugar de un cargo suelto.

### 6.3 Abonos internos (A5) y cargos internos (C6)

- **Abonos internos (`ccmmov06`)**: abono sin efectivo aplicado a un documento (ajuste, retención, castigo). Tipos permitidos: cualquiera salvo A0, A1, A3, A4, A6, PA y los `C`
  ("Tipo de Movimiento no Existe" si no está en el catálogo); "Documento no existe", "Abono sobrepasa el saldo"; `FABONO` del documento `+= monto`, `FABOM` del cliente `+=`.
  128 filas, todas A5 [D]. Al aplicar queda como abono más en la antigüedad (reduce el saldo) y **no** entra a la partida de abonos (§10).
- **Cargos internos (`ccmmov09`)**: alta manual de `C6`; "No puede Eliminar Tiene Abonos". 0 filas [D].

### 6.4 Cancelar ventas de contado (`cancela`)

Para un rango de fechas lista las facturas con `FPLAZO = 0` y saldo mayor que cero y, con la casilla de cada una, **genera un abono `A0` por el saldo completo**: forma `EF`,
`CONTADO = verdadero`, número de abono = tipo de comprobante (1 carácter) + 2 primeros + 7 últimos caracteres del documento, cliente y vendedor de la factura, `MOV2 = C0`, y `FABONO += saldo`.
No toca `FCANCELA`, `FLIQUI` ni el cliente [V]. 791 abonos con `CONTADO` en los datos [D]. **Nueva plataforma:** una venta de contado genera su recibo en el mismo acto
(o por proceso de cierre de caja), con forma de pago y caja.

### 6.5 Pagos anticipados (`PA`)

`ccmpant1` registra un anticipo del cliente (forma de pago DE/EF/CH con banco, cheque y fecha postfechada igual que el abono); no se aplica a ningún documento y
**no hay pantalla para aplicarlo**; el reporte "Pagos Anticipados Distribuidores" lo lista. **0 registros** [V][D]. **Nueva plataforma:** anticipo como recibo sin
aplicaciones que luego se aplica a facturas (saldo a favor); ver pregunta 18.

### 6.6 Descuentos por pronto pago, intereses, mora

**No existen.** `FDESCU`, `PDESC`, `FLETE`, `SEGURO` y `DEVUELTO` son columnas heredadas: valen cero en todos los movimientos (`DEVUELTO` tiene valor solo en 14 abonos) [D]. No se
calculan intereses ni recargos por mora ni descuentos por pronto pago en el código leído [V]. `CLIENTE.DESCUENTO` es un % fijo para la lista de precios de inventario, no para el cobro.

## 7. Saldo del documento y saldo del cliente

### 7.1 Saldo de un documento [V][D]

`saldo = FMON + FCARGO − FABONO`, calculado en cada pantalla y reporte. `FCARGO` = suma de notas de débito aplicadas (`C4`); `FABONO` = suma de **todas las filas `A*` aplicadas al
documento** (A0, A1, A3, A6, A5…), identificadas por `(MOV2 o C0, FNFAC, FTICOM, FCTA)`. Un documento está **abierto** si `saldo > 0` (en el reporte de límites y la antigüedad), y cuenta como
abierto **cualquier documento cuyo tipo empiece con `C` salvo `C4`** (facturas, cheques postfechados/rechazados, cargos internos) **más las notas de crédito sin aplicar**
(`FTMOV` = A1/A3/A6 con `FNFAC` vacío, y `FMON + FCARGO − FABONO > 0`) [V: `estado.scx`, `ccranti2.scx`].

**Verificación en los datos:** para las 56,774 facturas, `FABONO` almacenado es **igual** a la suma de las filas `A*` que la apuntan (0 diferencias) y `FCARGO` igual a la suma de las
`C4` (0 diferencias) [D]. 715 facturas están abiertas (saldo > 0), 8 tienen saldo negativo (sobrepago) y 3,000 tienen monto cero (2,384 anuladas + 616 de otro origen) [D].
El hallazgo reconcilia con `ccpost01` (§7.2).

### 7.2 "Posteo de Abonos" (`ccpost01`)

Utilidad que **reconstruye** `FABONO` y `FCARGO` de cada documento recorriendo `CCMOV01` en orden `cliente + documento + tipo comprobante + (C antes que A)`: suma `FMON` de las `A*` y de las
`C4`, fija `FCANCELA` = fecha de la última aplicación si el saldo llega a cero (si no, la limpia); recalcula las estadísticas del cliente `DIASP` (suma de días de pago de facturas
cerradas) y `VECESP` (número de facturas cerradas), y `P90`. Es el equivalente de "Reconstruir Saldos" de CONTAC/BANCOC y confirma que el saldo **es derivado** [V].
**Nueva plataforma:** no existe; el saldo es una consulta. `DIASP/VECESP` (días promedio de pago) se calculan en el reporte de comportamiento de pago.

### 7.3 Saldo del cliente [V][D]

No se guarda confiablemente. `CCCLI01.FSALACT/FSANT/FSALANT` valen cero en todos los clientes; `FCARM`/`FABOM` son contadores incrementales que solo algunas pantallas actualizan (factura, nota de
débito/crédito, cargo por cheque, remesa, abono interno), **no** el abono `A0` ni inventario, y no cuadran con el saldo [I por la lectura del código; no se recalculó]. El saldo de un cliente es siempre
`Σ (FMON + FCARGO − FABONO)` de sus documentos abiertos menos sus notas de crédito sin aplicar. **Nueva plataforma:** sin columnas de saldo en `ar_customers`.

## 8. Antigüedad, estados de cuenta, vencimientos

### 8.1 Antigüedad de saldos (`ccranti2` + `ccranti1.frx` / `ccrantc.frx`)

- Parámetros: todos los vendedores o un rango; opciones de salida "Detallado Documento", "Consolidado Vendedor", "Cliente Detallando Documentos", "Consolidado Clientes", "Cheques Post
  Fechados", "Cheques Rechazados", "Crédito Fiscal y Consumidor Final"; **fecha de corte** ("Fecha de Corte no puede quedar en blanco"); opción de **saldos retroactivos**: copia los movimientos con
  `FFEC ≤ corte`, pone `FABONO = FCARGO = 0` y recalcula con las aplicaciones de esa fecha ("RECONSTRUYENDO SALDOS, ESPERE...") [V].
- Partidas incluidas: `saldo > 0` en documentos `C*` (no `C4`) y notas de crédito sin aplicar (A1/A3/A6); el monto de la NC se muestra **negativo** (`cobro = fmon × −1`) [V].
- **Tramos (por `ccranti1.frx`)**: `dias = corte − fecha del documento (FFEC)`: **0–30**, **31–60**, **61–90**, **91–120**, **≥ 121**. La variante `ccrantc.frx` agrega **121–150**, **151–180**, **≥ 181** y el
  porcentaje de cada tramo sobre el total. La antigüedad "por días vencidos" (`ccanti`) usa `VENCE` = fecha del documento para `C0` o fecha de cobro para los demás, y `VENCE2` = vencimiento (+ plazo)
  *(la base exacta de cada informe es inferida de las variables del reporte)* [V/I].
- **Nueva plataforma:** un motor con tramos configurables (por defecto 0–30, 31–60, 61–90, 91–120, 121–150, 151–180, ≥ 181), base *fecha del documento* o *fecha de vencimiento*, agrupación por
  cliente/vendedor/negocio/matriz y saldos a una fecha pasada calculados desde las aplicaciones con fecha (sin tabla temporal).

### 8.2 Estado de cuenta (`ccrestc1`, `ccrestsu`)

Por cliente o rango de clientes (y vendedor), con fecha de corte y saldos retroactivos opcionales; por casa matriz en `ccrestsu`. Lista los documentos abiertos con cargos, abonos y saldo
[V]. En la pantalla `estado` ("Movimiento del Crédito") el usuario ve los tramos de saldo (30/60/90/120/150), el total, el *saldo disponible* y puede abrir la lista de productos de la factura
(de inventario) y una devolución de producto [V].

### 8.3 Vencimientos y programación de cobros

"Reporte de Vencimientos" (`ccvence`) y "Programación de Cobros" (`pcobros`) filtran por `FFPAGO` (= fecha + plazo) y saldo > 0. La **ruta automática de cobro (`ccraut1`)** arma la lista de documentos
(tipo `C` salvo `C3`/`C4`, con saldo, del vendedor) cuyo cliente tiene marcada la semana (`FSEM1..4`) y cuyo vencimiento `FFEC + FPLAZO ≤ corte`; la guarda en `COBRO`/`DETACOB` con un número de ruta
`vendedor + ddmm` [V].

### 8.4 Comportamiento de pago (`P90`, `DIASP`, `VECESP`)

`P90` = el cliente alguna vez pagó una factura con más de 90 días; `DIASP/VECESP` = acumulados para promedio de días de pago. 425 clientes tienen `P90` [D]. Se actualizan en el abono y en `ccpost01` [V].

## 9. Cobranza operativa: despachos, rutas y liquidaciones

- **Despacho (`simov1V2`)**: encabezado `DESPACHO` (número, fecha, transportista, vehículo, hasta 3 ayudantes, total) + `DETADES` (documentos que lleva el repartidor, hasta 12 por pantalla). Se puede
  incluir un pedido ("R"). Es **logística**; no genera movimiento contable [V].
- **Liquidación de transportista (`ccmliq02`/`ccmliq03`)**: debe corresponder a un despacho ("Despacho no puede quedar en blanco", "No coincide en transp. de despacho con el de liquidación"); captura los
  abonos de lo que el repartidor cobró contra los documentos de su despacho ("Documento no existe en despacho"); misma validación que el abono [V].
- **Ruta de cobro de vendedores (`ccmcob1v2`)**: número de ruta, vendedor y documentos a cobrar (`COBRO`, `DETACOB`); "Despacho ya fue liquidado, no puede eliminar" [V]. No es contable.
- **Liquidación de vendedores (`ccmliqve`)**: encabezado `LIQUIDA`: **número de liquidación de 9 caracteres = 2 del vendedor + día + mes + último dígito del año + correlativo de 2 cifras** (único: "Liquidacion
  ya existe"), vendedor/transportista, fecha, **remesa** (monto depositado) y **cuenta bancaria** del depósito (`CTABANCO`, validada contra el catálogo de Bancos: "Cuenta de Banco NO EXISTE!!!"); advierte
  "REVICE LA FECHA DE LIQUIDACION, AÑO DIFERENTE" si el año no es el actual. **No se puede eliminar** una liquidación con abonos ("Elimine primero los movimientos") [V].
  Los campos `EFECTIVO`, `CHDIA`, `CHPOS`, `DEV` existen pero valen cero en los 11,031 registros; solo `REMESA` se usa (4,579 liquidaciones) y la cuenta bancaria solo está en 10 [D].
- **Nueva plataforma:** la liquidación es un **cierre de caja de cobranza** (`ar_collection_batches`): reúne los recibos de un cobrador y una fecha, exige que el efectivo + cheques coincida con la
  remesa depositada y genera el depósito en `banking`. Rutas y despachos quedan fuera (pregunta 4).

## 10. Integración con el libro mayor (cómo CxC postea en CONTAC)

### 10.1 Mecanismo [V]

Cinco procesos **por lotes**, lanzados a mano por el usuario (menú Utilidades → Generación de Partida): ventas (`ccpart`), devoluciones (`ccpartde`), notas de abono (`ccpartna`),
abonos de clientes (`ccpartab`) y remesas (`ccpartre`). Cada uno pide: **rango de fechas Del/Al**, **tipo de partida** (lista de `TIPOPAR`), **número** (propone `mayor número del tipo en el mes + 1`, con ceros hasta 6 dígitos) y
**concepto general** (se propone "VENTAS DEL dd/mm/aaaa AL dd/mm/aaaa", "REBAJAS Y DEVOLUCIONES DEL …", "DEVOLUCIONES DE MERCADERIA DEL …", "ABONOS DE CLIENTES DEL …", "REMESAS POR CHEQUES POSTFECHADOS …"). Lee
`CCMOV01` en el rango por **fecha del documento**, construye un encabezado y líneas en tablas temporales por usuario (`PPROV<usuario>`/`DPROV<usuario>`) y las pasa a **`CGADIPAR.PRG`** (el mismo posteador de Bancos), que
**añade el encabezado a `PARTIDAS` y las líneas a `DETAPART`** y suma los cargos/abonos a `SALDOS` y `SALDOCC` subiendo por la cadena de cuentas padre, con la naturaleza deudora (tipos 1, 4, 6) o acreedora (los demás) [V].
- **Una partida resumen por rango, no una por documento.** Líneas de ventas: una por cliente (a su cuenta) + una por cuenta de ingresos + las de IVA.
- **Mes cerrado en contabilidad:** si el mes del rango está cerrado en `PARTIDAS.CERRADO` → "MES CERRADO EN CONTABILIDAD..." (se revisa el mes de la fecha inicial y de la final) [V].
- **Si ya existe una partida con ese tipo y número:** pregunta "Partida ya existe; Desea Eliminarla" y la borra (encabezado y líneas) **sin revertir los saldos de `SALDOS`**; luego `CGADIPAR` suma los nuevos (doble conteo en la
  tabla de saldos del legado) [V].
- **No hay marca en `CCMOV01` de que un movimiento ya fue contabilizado.** La repetición o el traslape de rangos genera partidas duplicadas, y los días sin generar nunca se detectan [V]. El vínculo entre la partida y los
  documentos es **solo el texto del concepto** y el rango de fechas.
- **Marca de origen `PARTIDAS.GENERADO`:** `CGADIPAR` recibe `sistema = 0` (las pantallas lo llaman con 4 parámetros) → las partidas de ventas quedan con `generado = 0`, es decir **editables y borrables desde CONTAC**
  [V]. En el libro de CONTAC del disco hay 880 partidas con estos conceptos (308 "VENTAS DEL…" todas con `generado = 0`; 572 "ABONOS DE CLIENTES…" con `0`, `1`, `9` o vacío), de 2022-02 a 2024-03, tipos de partida 01, 03, 06 y 07
  (3,670 líneas, 4.2 líneas por partida) [D]. **Aviso:** los textos de las líneas históricas (por ejemplo "IVA VENTAS CONSUMIDOR…", "SALIDAS POR VENTAS…", "DEVOLUCIONES DE VENTAS" dentro de una partida "VENTAS DEL…") **no coinciden** con los que escribe el código actual ("IVA VENTAS C.FINAL…", etc.): esas partidas las generó otra versión del programa, que además juntaba ventas y devoluciones [D][I].
- **Centro de costo:** las líneas llevan el centro de `cfg_centro` y luego se sobrescribe con el valor fijo `"100"` en el mismo `REPLACE` (el código tiene ambos) [V].
- **No hay una sola partida por transacción ni integración en tiempo real.** En CxC el campo `cfg_conta` ("Contabilidad") existe en `config2`, pero ninguna pantalla de movimiento lo consulta [V].

### 10.2 Qué se debita y se acredita

(Las cuentas de cada tipo salen de `CCTMOV`: `CTA`, `CTA2`, `CCTAE`; las del IVA y otros de la configuración `config2`; la del cliente de `CCCLI01.CTA`.)

| Proceso | Débito | Crédito |
|---|---|---|
| **Ventas** (`ccpart`) — facturas `C0` y notas de débito `C4` con monto > 0 | **Cuenta del cliente** (`CCCLI01.CTA`) por el total de sus documentos del rango ("CREDITOS DEL…"). IVA retenido por el cliente (`cfg_iva_re`) por `Σ IVAPER` si la empresa **no** es gran contribuyente | **Ventas de crédito fiscal** (`C0.CTA`) por `FMON − IVA ± IVAPER − flete` (tipo C); **ventas a consumidor final** (`C0.CTA2`) por `FMON − IVA − flete + IVAPER` (tipo F); **ventas de exportación** (`C0.CCTAE`) por `FMON − IVA − flete` (tipo E); **flete** (`cfg_flete`); **IVA consumidor final** (`cfg_iva_cfi`) y **IVA crédito fiscal** (`cfg_iva_ccf`) por la suma del IVA; **IVA percibido** (`cfg_iva_per`) por `Σ IVAPER` si la empresa **es** gran contribuyente; **notas de débito**: `C4.CTA` (consumidor final, "N/DEBITO") y `C4.CTA2` (otros ingresos) |
| **Devoluciones** (`ccpartde`) — notas `A1` y `A3` | **IVA** (`cfg_iva_cfi`/`cfg_iva_ccf`) por el IVA de las notas; **devoluciones** (`A1.CTA`) y **descuentos** (`A3.CTA`) por `FMON − exento − IVA` | **Cuenta del cliente** por el total de las notas |
| **Notas de abono** (`ccpartna`) — notas `A6` y `A2` | **IVA** a `cfg_iva_cno` ("gastos no deducibles", según la etiqueta de `config2`), **devoluciones** (`A6.CTA`/`A2.CTA`) y, aparte, el exento (`totexe`) | **Cuenta del cliente** por el total |
| **Abonos de clientes** (`ccpartab`) — abonos `A0` | **Caja/bancos** (`A0.CTA`) por los abonos **sin** fecha de cobro; **cheques postfechados** (`C3.CTA`, "CARGOS POR CHEQUES POSTFECHADO") por los que traen fecha de cobro | **Cuenta del cliente** por los abonos aplicados a `C0`; **cheques rechazados** (`C2.CTA`) por los aplicados a `C2`; **cheques postfechados** (`C3.CTA`) por los aplicados a `C3` |
| **Remesas** (`ccpartre`) — remesas `A4` | **Caja/bancos** (`A0.CTA`) | **Cheques postfechados** (`C3.CTA`) por las remesas de cheques `C3`; **cheques rechazados** (`C2.CTA`) por las de `C2` |

Notas [V salvo indicación]:
- **IVA retenido/percibido:** si la empresa **no** es gran contribuyente, `IVAPER` se *debita* a `cfg_iva_re` (anticipo de IVA retenido por el cliente); si la empresa **es** gran contribuyente, se *acredita* a `cfg_iva_per`
  (percibido). La resta/suma de `IVAPER` en la venta es lo que balancea la partida.
- **Posible descuadre [I]:** las partidas de devoluciones no consideran `IVAPER` ni el exento (solo `ccpartna` postea el exento); una nota con exento o retención deja la partida desbalanceada. `CGADIPAR` **no valida
  que la partida cuadre** (no hay ningún chequeo de cargos = abonos) [V].
- **Abonos internos (A5) y cancelaciones de contado** entran a la partida de abonos solo por el filtro `ftmov="A0"`: los `A5` **nunca se contabilizan** [V].
- La **cuenta del cliente** es la misma para casi todos los clientes (§5.2); no hay auxiliar por cliente en el mayor, el auxiliar es la cartera.
- Las cuentas configuradas en `CCTMOV`/`config2`/`CCCLI01.CTA` **no coinciden** con el catálogo del libro de CONTAC del disco en su mayoría (la copia del mayor llega hasta 2024-03, la cartera hasta 2026-10); no se puede
  verificar la integridad cuenta por cuenta (pregunta 13) [D].

### 10.3 Tabla de reglas de posteo para la nueva plataforma

- **Una partida por documento o por lote**, a elección de la empresa (`posting_mode = per_document | batch`); por defecto **lote diario**, como hoy, pero con el vínculo explícito: cada partida se crea con `source = 'cxc'`
  y `source_ref = id del lote o del documento`, y cada documento guarda `gl_entry_id` y `posted_at`. Cada documento solo puede estar en **un** lote contabilizado.
- Las líneas generadas son **editables antes de aplicar**; el GL rechaza editar o anular una partida con `source = 'cxc'` desde su pantalla ("Anule el documento desde Cuentas por Cobrar"); anular un lote revierte el vínculo
  de sus documentos (no se borra nada).
- Hay que agregar `cxc` a `GL_ENTRY_SOURCES` (hoy `manual, bancos, iva, cierre, importado`; pregunta 12), igual que la propuesta `cxp` de BANCOC.
- Para el **historial**: el importador marca como `source = 'cxc'` las partidas del libro de CONTAC cuyo concepto coincide con los textos de §10.1 y cuyas fechas caen en el rango (no hay otro vínculo; pregunta 14).
- La cuenta de clientes de cada tipo de documento se toma de `ar_posting_accounts`; las cuentas de IVA, flete y retención de `tax_settings`/`ar_settings`.

## 11. Integración con Bancos, IVA e inventario

### 11.1 Bancos

- **No hay integración de movimientos con `MOVIBAN`.** CxC no crea cheques ni remesas en Bancos y Bancos no sabe de los cobros. Solo se cruzan por: (a) la cuenta bancaria que el usuario teclea en la liquidación (`LIQUIDA.CTABANCO`, 10 filas
  de 11,031) o en el abono (`CCMOV01.CTABANCO`, 18 de 57,183); (b) el catálogo de **bancos de clientes** (`BANCOS`, 26) propio de CxC (código de 2 caracteres, igual que el de Bancos, pero tabla distinta); y (c) los reportes "Ventas y
  Bancos" y "Ventas e Ingresos", que comparan por día las ventas, los abonos y la **suma de abonos por banco** de la cuenta bancaria (`CTABANCO.CODBAN` = '01'…'05', solo 5 bancos en columnas) [V].
- El depósito real de lo cobrado (remesa) se hace en Bancos con su propia captura y partida **sin vínculo** con la liquidación (el campo `REMESA` de la liquidación es un monto informativo) [V][I].
- **Nueva plataforma:** la liquidación genera (o se vincula a) un documento de depósito de `banking` (cuenta, fecha, monto) y los cheques postfechados se depositan con una remesa de `banking`; la conciliación de cartera con bancos
  se hace por ese vínculo (`bank_document_id` en el lote de cobranza). Así el reporte "Ventas y Bancos" se hace por consulta, no por comparación manual.

### 11.2 Libro de IVA de ventas

`IVATRANC` ("Transferir Ventas de Crédito Fiscal") y `IVATRANF` ("Transferir Ventas de Consumidor Final") **leen `CCMOV01` por rango de fechas** y copian a `IVAFIS` del módulo IVA [V]:
- crédito fiscal: `C0`, `C4`, `A1`, `A3` con `FTICOM = 'C'`;
- consumidor final y exportación: `C0`, `C4`, `A1`, `A3`, `A6` con `FTICOM = 'F'` o `'E'`.
Copian fecha, número, IVA (`fvgiv`), exento (`fviex`), gravado neto, total, retención (`IVAPER`), serie, resolución y el código de generación / número de control / sello del DTE (de `FELECTRO` de inventario). El cliente
(nombre, registro de IVA) sale de `CCCLI01`. Es una **transferencia a petición** (borra y regenera el mes del libro). Las notas `A6` no pasan al libro de crédito fiscal [V].
**Nueva plataforma:** `tax` consume los documentos de AR por API de lectura (`ar_documents` con `vat`, `exempt`, `type`) sin copiar tablas; el libro se arma al cierre del período.

### 11.3 Inventario

- Inventario → CxC: la factura (`C0`) se escribe desde inventario (§3.1). Las notas de crédito por devolución con producto salen de inventario (`INMDEVOL` escribe `CCMOV01`) [V parcial: se confirmó que la pantalla
  referencia `CCMOV01`; la mecánica exacta de escritura queda para el spec de inventario].
- CxC → inventario: la pantalla `estado` consulta `FACT` (productos vendidos al cliente) y `DEVOL`; los cambios de código de cliente tocan `FACT`, `DEVOL`, `CORFACT`, `CORDEV` (§5.5).
- **Nueva plataforma:** AR no lee tablas de inventario; consume eventos/API (factura emitida, nota emitida, factura anulada). Un cambio de código no recorre tablas ajenas.

## 12. Cierre de mes y bloqueos

- **Cierre propio de cartera:** "Cerrar Mes" (`cierre1`) pide una **clave** (`pasg.spr`; la clave está guardada en `SEGUIR.MEM`, no se documenta) y agrega una fila a `CIERREC` (`FECHA = AAAAMM`, `CERRADO = verdadero`). Si el mes ya está
  cerrado: "Este mes ya fue cerrado!". Mensaje de confirmación: "Este Proceso Cerrara los movimientos del Mes … Seguro de Continuar" [V]. **No modifica ninguna fila de `CCMOV01`**; el cierre es una bandera
  externa.
- **Qué bloquea:** toda pantalla de movimiento (factura, notas, abonos, cargos, remesas, anticipos, liquidación, cancelar contado…) busca el mes de la fecha del documento en `CIERREC` y, si lo encuentra, dice
  "!!Mes Cerrado!!, No Puede Modificar" (o "...No Puede Eliminar") [V]. **No bloquea** los cambios que no tienen fecha propia: aplicar/mover/liberar NC, asignar quedan, cambiar vendedor/código/cartera, ni el
  posteo de abonos.
- **Abrir mes cerrado (`inabre`):** **no pide clave**; borra la fila de `CIERREC` ("Mes no ha sido cerrado" si no existe) y no deja bitácora [V]. Cualquiera con permiso de la opción puede reabrir.
- En los datos: 152 meses cerrados de agosto 2005 a **abril 2024**; los 32,231 movimientos posteriores están en meses abiertos [D].
- **Independiente del cierre contable:** el cierre del GL (`PARTIDAS.CERRADO`) solo se consulta al generar partidas (§10). Los dos cierres no se sincronizan.
- **Nueva plataforma:** el estado del período vive en `gl_periods`; AR agrega, si se quiere, un *cierre de cartera* por período (`ar_periods`) con permiso `supervise` y bitácora, o simplemente hereda el del GL
  (pregunta 15). Reabrir exige permiso y motivo.

## 13. Comisiones y presupuestos (resumen)

- Cada fila de `CCMOV01` guarda `PORCOMI` (% de comisión del vendedor al momento del cobro); `COMI.MEM` y la pantalla `cxccomi` fijan porcentajes por tipo de cobro (**ventas de contado, cobros en efectivo, cheques al día,
  cheque postfechado, cheque rechazado**); `calcomi1/calcomi2/calcomib`, `ccpagoco` calculan por vendedor y período el total de comisión con **deducciones tipo planilla (ISSS, AFP, renta)** usando las tablas `RENTA` (4 tramos) y las
  variables de `CXCCFG.MEM`/`DESCU.MEM`; una de sus opciones pide una clave fija escrita en el código (no se documenta). Tablas de trabajo `COMI2`, `COMVENT`, `COMISION` [V].
- **Presupuestos** (`ccmpvend`, `ccmpclie`, `ccpcobro`, `ccpcobrc`, `capeicli`, `ccmvicli`, `kpivenvi`): meta mensual de venta y de cobro por vendedor, por cliente y por visitador; `PVENDE` (118 filas), `PCLIENTE` (7,122), KPI.
- **Nueva plataforma:** fuera del primer corte de `accounts-receivable` (preguntas 7 y 8); los datos se pueden importar a un módulo `commissions` futuro.

## 14. Reportes y consultas (resumen)

Todos abren con vista previa (`FoxyPreviewer`), imprimen o exportan a archivo de texto (se pide "Nombre de Archivo"). Reglas comunes: filtro por vendedor o rango ("Código inicial tiene que ser menor que el final"); fecha de corte
obligatoria; filtro por cliente/matriz/tipo de negocio. Los reportes de cartera usan siempre `FMON + FCARGO − FABONO` de las filas de `CCMOV01` (§7.1). "Corte de caja" (`ccrcaja1`), "Cheques post-fechados" (`ccrchep2/3`) y el
histórico del cheque trabajan sobre `C3`/`A0` con `FBANCO` y `FNUCHE`. "Cobros para lavado de dinero" (`ccrmovla`, `ccrablab`) lista abonos en efectivo mayores a un monto (control de prevención; reglas exactas por revisar).

## 15. Usuarios, permisos y bitácora

- Permiso por pantalla en `PERFIL` (usuario + clave de programa; 220 filas vivas de 980 [D]) con **cinco banderas**: abrir (`permiso`), agregar (`permiag`), modificar (`permim`), eliminar (`permi`), anular (`permia`). Los reportes solo usan `permiso`.
  Nivel de usuario `USUARIOS.USRLVL` = 1 Supervisor: algunas acciones lo exigen aunque el perfil lo permita (eliminar nota de crédito, anular factura en inventario). Empresas permitidas en `USREMP`.
- **Bitácora (`BITACORA`, 23,455 filas vivas)**: usuario, fecha, hora, programa y concepto (hasta 190 caracteres). A diferencia de BANCOC, CxC **sí** deja bitácora en el alta, cambio, eliminación y anulación de clientes, facturas, notas de
  débito/crédito, abonos, cargos por cheques, remesas, anticipos, quedan, aplicar/mover NC [V]. **No** la deja `ccpost01`, `inabre`, `cierre1`, los tres cambios masivos ni la generación de partidas [I].
- **Nueva plataforma:** bitácora (`audit`) en todo; permisos `capture`, `reports`, `supervise` del manifiesto; `supervise` para anular un documento con recibo, reabrir un período, generar o anular lotes contables, mover documentos
  entre clientes y cambiar la cartera.

## 16. Mensajes de validación (citas de la interfaz)

Documentos: "No.de Doc. no puede quedar en blanco", "Documento ya fue ingresado", "Documento ya fue registrado", "Documento no existe", "Fecha no puede quedar en blanco", "F=Consumidor final, C=Credito Fiscal, E=Exportación",
"Cliente no puede quedar en blanco", "Cliente no existe", "Vendedor no puede quedar en blanco", "Vendedor no existe", "Tipo de movimiento puede ser A1 o A3 o A6", "Tipo de movimiento puede ser C2 o C3",
"Primero elimine los cargos y abonos", "No puede Eliminar Tiene Abonos", "!!Mes Cerrado!!, No Puede Modificar", "!!Mes Cerrado!!, No Puede Eliminar".
Abonos: "Abono sobrepasa el saldo en …", "Debe digitar el valor del abono", "Tipo de pago puede ser DE, EF, CH", "Tipo de Documento puede ser (C0, C2, C3)", "FECHA DE ABONO NO PUEDE SER MENOR QUE LA DE FACTURA",
"Error N/ABONO ya fue aplicada a otro cliente", "Fecha de cobro tiene que ser mayor que la de liquidación", "Cheque Existe con diferente fecha de Cobro …", "Debe especificar en poder de quien queda en cheque",
"No.de cheque no puede quedar en blanco", "Bancos no puede quedar en blanco", "Banco no existe, Verifique".
Notas de crédito: "Monto mayor al disponible para Aplicar", "Monto mayor al pendiente de cobrar", "Verifique el Cliente", "No pertenecen a la misma Matriz", "Debe liberar primero la Nota de Credito".
Clientes: "Cliente ya existe, verifique", "Cliente no puede eliminarse, tiene movimiento", "Departamento no Existe", "Municipio no Existe", "Tipo de Negocio no existe", "Cuenta no Existe", "Cuenta no es de Detalle".
Liquidación: "Liquidacion ya existe", "Elimine primero los movimientos", "Despacho no puede quedar en blanco", "No coincide en transp. de despacho con el de liquidación", "Cuenta de Banco NO EXISTE!!!".
Contabilidad / cierre: "MES CERRADO EN CONTABILIDAD...", "Partida ya existe; Desea Eliminarla", "NO HAY MOVIMIENTOS PARA ESA FECHA", "Fecha inicial debe ser menor que la final", "Este mes ya fue cerrado!", "Clave Incorrecta",
"Mes no ha sido cerrado". Permisos: "Lo siento no tiene acceso", "No tiene permiso para Crear !!!", "No tiene permisos para Modificar", "No puede Eliminar, NO TIENE PERMISOS", "No tiene permiso para anular !!!".

## 17. Diferencias con cuentas por pagar (BANCOC) y qué compartir

| Tema | CxC (cxc64) | CxP (BANCOC) |
|---|---|---|
| Tablas | Una (`CCMOV01`): documentos y aplicaciones juntos | Documentos (`QUEDAN`), aplicaciones (`MOVQUE`), notas (`NCREDEB`), provisión (`PROVISIO`) separados |
| Saldo | `FMON + FCARGO − FABONO` en el documento (incremental; el abono incluye NC y recibos) | `total + cargo − abono` igual, más `pagos` |
| Quién paga | El cliente: recibo/abono con forma de pago, banco y cheque del cliente; **cheques postfechados en cartera** | La empresa: cheque/transferencia propios de Bancos |
| Contabilidad | **Lotes manuales** por rango de fechas, 5 tipos de partida, sin vínculo por documento | Un documento de Bancos = una partida inmediata; provisión por lote manual |
| IVA | Débito fiscal: IVA de la venta; retención **que hace el cliente** (se descuenta del total) | Crédito fiscal; retención/percepción que hace la empresa |
| Vencimiento | `fecha + plazo` | `recibido + plazo`, corrido al viernes |
| Antigüedad | Por fecha del documento (tramos 0–30…≥121 y variantes) | Por días vencidos (tramos ≤0, 1–30…≥121) |
| Cierre | Propio (`CIERREC`, con clave) | No tiene; hereda el del GL |
| Bitácora | Sí | Parcial |
| Anular | Fila con código de cliente reemplazado | Estado `anulado` |

**Compartir en la nueva plataforma:** el servicio de impuestos (`tax`), el contrato de posteo al GL (`source`, `source_ref`, `gl_entry_id`), la tabla de aplicaciones (`*_applications`), el motor de antigüedad con tramos configurables, el
catálogo de bancos de `banking` y la bitácora. **No compartir:** instrumentos de pago (cheques recibidos vs cheques emitidos).

## 18. Hallazgos, incoherencias y código muerto

1. **El saldo del cliente guardado no sirve** (`FSALACT` = 0 en todos; `FCARM`/`FABOM` incompletos); la verdad está en los documentos (§7).
2. **Números de abono repetidos** entre clientes y liquidaciones (799 y 189 casos) y un mismo número aplicado a hasta 544 filas; no se puede usar `FREF` como llave de recibo (§6.1).
3. **Anular reescribe el código de cliente** con "ANULADA"/"ANULADO" (2,384 + 45 filas) y los reportes tienen que excluirlas por el nombre; no hay forma de saber qué cliente era (§3.6).
4. **Contabilización sin vínculo ni control de duplicados**, partidas editables desde CONTAC, deshacer sin revertir `SALDOS` (§10.1).
5. **Partidas de devoluciones pueden quedar descuadradas** (IVA retenido, exento) y el posteador no valida (§10.2).
6. **El límite de crédito, "suspendido" y "contado" no se aplican** al facturar; solo "inactivo" bloquea, y solo en inventario (§5.3).
7. **Reabrir un mes no pide clave** y no deja rastro; cerrar sí (§12).
8. **Retención de IVA:** una sola tasa, columna con nombre `IVAPER` que significa "retenido por el cliente"; la nota de crédito la trata con signo distinto a la factura en consumidor final (§3.4, §4.2).
9. **Código y tablas muertas:** `ccmcli05`, `ccmcob1`, `simov1`, `PA`, `C5`, `CR`, `A7`, `A8`, `C6`, `AUTOMA`, `COMISION`, `DETA`, `CIERRE`, `PVEND`, `TEMPOLIQ`, y los campos `FDESCU`, `PDESC`, `FLETE`, `SEGURO`, `FDEVOL`, `ANULADA`, `LIBERAR`,
   `BLOQUEDADO`, `EFECTIVO/CHDIA/CHPOS/DEV` de `LIQUIDA`. `PCLIENT` (precios por cliente y modelo, 1,017 filas) es de inventario.
10. **Copias de `CCMOV01` en `FUENTE`** (`CAL` 6,790, `LORENA` 2,032, `REVISA` 2,743, `VALIDA` 175, `WILDA` 2,031, `TABLAX` 6, `MOVIMI` 862, `SALDO` 24, `anti2` 904, `cobroco2` 575): tablas de trabajo o respaldos con datos reales; no se migran
    (pregunta 21).
11. **Tablas de trabajo por usuario** (`PPROV<nn>`/`DPROV<nn>`, 16 usuarios) del posteador de partidas: no se migran.
12. **Datos de planilla mezclados** (`CXCCFG.MEM`, `CONFIG.MEM`, `DESCU.MEM`, tablas `RENTA`, `COMI2`) para las comisiones; se descartan del primer corte.
13. **`EMPRESAS`** de CxC lleva `FORMANC`/`FORMAND` (formato de impresión de nota de crédito y débito) vacíos en este cliente y `GRANDE` (la empresa es gran contribuyente) en falso.
