# IVA64 — Reglas de negocio

Extraídas de los formularios `ivacomp2.scx`, `ivaexcl.scx`, `ivamfis2.scx`, `ivamfac2.scx`, `ivarenta.scx`, `ivacierr.scx`, `abririva.scx`,
`ivatranc.scx`, `ivatranf.scx`, `ivatraco.scx`, `ivatrac2.scx`, `subiriva.scx`, `genarchi.scx`, `f930.scx`, `f930v2.scx`, `f910.scx`,
`f987.scx`, `f987v2.scx`, `f987v3.scx`, `ivarcoa.scx`, `ivarco01.scx`, `ivarcf01.scx`, `ivarfa01.scx`, `ivarrent.scx`, `ivaren.scx`,
`ivaren2.scx`, `config2.scx`, `ccmiva.scx`, `ivmcon01.scx`, `ivamcli1.scx`, `cambiar3.scx`, `cambiar4.scx`, `cambiare.scx`, `sbmemp01.scx`;
programas `access.prg`, `selemp.prg`, `pasa.prg`, `valibot.prg`, `proteger.prg`, `ultimo.prg`, `vertodo.prg`, `vercon.prg`; menú `IVAMENU.MPR`;
reportes `ivarco04.frx`, `ivarcf01.frx`, `ivarfa01.frx`, `qwreten.frx`, `f930.frx`; de BANCOC: `ivacomp2.scx` y `OFCOMPRA.PRG` (comparación).
Las cifras salen de una lectura de las tablas de `MCERP/IVA64/dbf` (solo conteos; no se copió ningún dato).

Convenciones: **[V]** verificado en el código; **[D]** verificado en los datos; **[I]** inferido.
"Nueva plataforma:" marca dónde el sistema nuevo debe diferir a propósito.
Sobre la ley: este documento **describe lo que hace el sistema**. Donde un porcentaje, umbral o código parece venir de la norma, se marca
con **(verificar)** para contrastarlo con la regulación vigente; nada de lo escrito aquí debe tomarse como cita legal.

## 1. Cómo está armado el sistema (contexto)

- IVA64 es una aplicación VFP aparte, con login propio (`access.prg` → `intro.spr`; hasta 3 intentos, contraseña con `valida.prg`),
  selección de empresa (`selemp.prg`) y formulario de menú (`ivamenu.scx` → `IVAMENU.MPR`) [V].
- **Una empresa por instalación de datos.** `EMPRESAS` (en `fuente`) lleva por empresa: ruta de datos (`CAMINO`), rutas de integración
  (`INTEGRA` = CxC, `INTEGRAP` = compras/Bancos-CxP, `RUTAINV` = inventario), `NIT`, `REGISTRO` (NRC), `GRANDE` (gran contribuyente), `MONEDA`,
  y las **series y resoluciones de autorización** de tres tipos de documento: consumidor final (`FASERIE`, `FARESOLU`), crédito fiscal
  (`CFSERIE`, `CFRESOLU`) y sujeto excluido (`EXSERIE`, `EXRESOLU`); además `FORMAEXCL` (nombre del formato de impresión de excluidos),
  `ACT_ECO`, `FDEP`, `FMUN`, `EMAIL` [V]. En la copia hay 1 empresa [D].
- `SET PATH` queda como `camino;camino2;camino3;camino4`, por eso el código abre tablas como `ccmov01`, `quedan`, `provedor`, `datamov` o
  `felectro` sin ruta: las encuentra en las carpetas de los otros módulos. **Si la ruta no existe en la máquina, esas pantallas fallan.**
  En la copia, `INTEGRAP` apunta a una carpeta (`\MC\CONTAC\DBF`) distinta de donde están hoy los datos (`MCERP\CONTAC\dbf`) [D].
- **Mes de trabajo** (`mesact`, `AAAAMM`): cada usuario guarda el suyo en `MESACT.<usuario>` (archivo `.MEM` en la carpeta de datos) [V]. Todas las
  pantallas de captura y los libros trabajan sobre `salfec = mesact`.
- **Dos fechas por documento:** `FFEC` (fecha del documento) y `SALFEC` (mes del libro en que se registró). Al grabar siempre se fuerza
  `salfec = mesact`. La fecha del documento **no puede ser posterior** al mes de trabajo ("Fecha no puede ser mayor que el mes de Trabajo"),
  pero **sí puede ser de un mes anterior** (el documento entra al libro del mes en que se digita) [V].
  Los libros de compras y de ventas filtran por `salfec`; los archivos de ventas para Hacienda filtran por `ffec` (ver §13).
- Eliminar en VFP es una marca de borrado (`DELETE`); el registro desaparece de los índices. Las tablas acumulan filas borradas
  (COMPRAS 591, IVAFIS 18,298, ivafac 247) [D]; la mayoría de IVAFIS son re-transferencias (ver §3).
- Cada alta, cambio o baja escribe una fila en `BITACORA` (usuario, fecha, hora, programa, concepto) con un texto; **no** guarda valores anteriores [V].
- **Nueva plataforma:** `empresa_id` en toda tabla, importes como cadenas decimales exactas, sin borrado físico (`is_active`/anulación), mes de
  trabajo y períodos en tabla, auditoría con valores antes/después en `core_audit_log`.

## 2. Configuración y tasas

### 2.1 Dónde vive cada parámetro [V]

| Parámetro | Archivo / pantalla | Alcance |
|---|---|---|
| Tasa de IVA (`ivax`) | `IVA.MEM` en `fuente`, pantalla "G- Iva" (`ccmiva`); se carga con `RESTORE FROM IVA` al entrar | **Global**: la misma para todas las empresas de la instalación. `ccmiva` ejecuta `SAVE TO iva` (guarda **todas** las variables de memoria en ese archivo) |
| Tasa de IVA retenido (`cfg_ivare`), IVA percibido (`cfg_ivape`), anticipo a cuenta (`cfg_ivaan`) | `IVACFG.MEM` en la carpeta de datos, pantalla "Configuración de Retenciones" (`config2`) | Por empresa. Valores iniciales 0.00 si no existen |
| `cfg_iva`, cuentas `cfg_iva_cf`, `cfg_iva_db`, `cfg_iva_re` | `IVACFG.MEM` | Existen en el archivo, pero **ningún programa de IVA64 las lee** (no hay contabilización); se guardan junto con las demás `cfg_iva*` |
| Gran contribuyente de la empresa (`grandex`) | `EMPRESAS.GRANDE` (casilla "Es gran Contribuyente") | Por empresa. Gobierna retención/percepción (§11) |
| Series y resoluciones | `EMPRESAS.*SERIE`, `EMPRESAS.*RESOLU` | Por empresa y por tipo de documento (§6–§9) |
| Firmas del libro | `FIRMAS.MEM` (arreglo `firmas`, dos líneas: nombre y cargo) | Por empresa; se edita en la pantalla de impresión del libro |
| Mes y año de trabajo | `MESACT.<usuario>` | Por usuario y empresa |
| Moneda del libro | `selemp.prg` copia `EMPRESAS.MONEDA` a `moneda2`; los libros imprimen "(VALORES EN COLONES)" si vale `1` y "DOLARES" en cualquier otro caso | Por empresa. En la copia vale 0, por lo que imprime dólares [D]. Los importes no se convierten |

### 2.2 Constantes escritas en el código (no son parámetros)

| Constante | Dónde | Efecto |
|---|---|---|
| `0.13` | F987 (v1, v2 y v3), "Archivos Hacienda IVA" no | El IVA de los archivos F987 se **recalcula** como `base × 0.13` en vez de leer el IVA guardado. Hay un `IVAX=13` comentado en `ivamfis2`, `cambiar3`, `cambiar4` y `cambiare`. **(verificar)** |
| `100` | `ivamfis2.fvgne` | Percepción de IVA en ventas solo si la base gravada es **mayor que 100** **(verificar)** |
| `200` | F987 "Consumidor Final < 200" y "> 200" | Umbral de importe sin IVA que separa dos archivos de consumidor final **(verificar)** |
| `0.10` | `ivarenta.montog` y `ivaexcl.gravaexcl` | Renta retenida = base × 10 % (editable en pantalla); en excluidos **sin redondeo** |
| `"13 % Retención"` | etiqueta fija de `ivacomp2` | Texto de pantalla; el cálculo usa `cfg_ivare` |

**Nueva plataforma:** todas estas constantes pasan a `tax_settings` por empresa con vigencia (fecha desde) y se versionan: tasa de IVA, tasa de retención,
de percepción y de anticipo, base mínima de percepción en ventas, base mínima de retención, umbral de consumidor final, tasa de renta
por tipo de ingreso. La tasa global (`IVA.MEM`) se vuelve por empresa.

## 3. Transferencias desde otros módulos

Las cuatro transferencias comparten el esquema [V]:
1. Pedir fecha inicial y final dentro del mes de trabajo ("Mes incorrecto, debe ser NN", "Año incorrecto, debe ser AAAA", "Fecha inicial debe ser menor que la final").
2. Si el mes está cerrado: "Mes cerrado, no puede ser transferido...".
3. Registrar en bitácora ("Transfirio las Ventas del … al …").
4. **Borrar** (marca de borrado) todos los renglones del mes con `TRANSF = .T.` (los capturados a mano, `TRANSF = .F.`, se conservan).
5. Insertar de nuevo los documentos del rango con `TRANSF = .T.`, `SALFEC = mesact`.
6. Si no hay documentos en el rango: "No Existen movimientos para esas fechas" (**después** de haber borrado el mes: la corrida vacía deja el mes sin transferidos).
Cada una depende de que `camino2` (CxC) o `camino3` (compras) no esté vacío; si no, "Opcion no disponible".

**Riesgo de duplicados:** nada impide que un documento esté a la vez transferido y capturado a mano (la transferencia solo borra lo transferido). Y las dos transferencias de compras (`ivatraco` desde CxP e `ivatrac2` desde Inventarios) **borran las filas transferidas del mismo mes, sean de la fuente que sean**: correr una después de la otra destruye lo que trajo la primera [V].
**Nueva plataforma:** la sincronización es idempotente por documento de origen (`source_module` + `source_ref`): inserta lo nuevo, actualiza lo cambiado, anula lo desaparecido, nunca borra capturas manuales, y es por fuente.

### 3.1 Ventas de crédito fiscal desde CxC (`ivatranc`) [V]

- Fuente: `CCMOV01` (movimientos de CxC) con `FTMOV ∈ {C0, C4, A1, A3}`, `FTICOM = "C"` (crédito fiscal) y fecha en el rango; cliente por `FCTA` en `CCCLI01`.
- Antes de transferir, **sincroniza clientes**: por cada cliente de `CCCLI01` con NRC (`FREGIVA`) crea o actualiza su fila en `CLIENTES` (nombre = razón social `FRES` o, si está vacía, `FNCLI`; NIT, DUI = `CEDULA`, teléfono, actividad económica).
- Cálculo por documento: `neto = fmon − fvaliva − fexen − ivaper` si la empresa es gran contribuyente (`grandex`); `neto = fmon − fvaliva − fexen + ivaper` si no.
- Se graba: `ftipo = ftmov`, `fcomp = fref`, `fvgiv = fvaliva`, `fviex = fexen`, `fvgne = neto`, `totalv = fmon` (gran contribuyente) o `fmon + ivaper` (otra empresa), `ivaper = e.ivaper` **solo** para gran contribuyente (para las demás la línea de `ivaper` está comentada: la retención/percepción **no se guarda**), `nserie`, `nresolu`, y los identificadores del DTE (`codgenera`, `ncontrol`, `sellor`) tomados de `FELECTRO` por `NFACT_ENV = fref + tipo` donde tipo = `fticom` (C0), `"N"` (A1/A3) o `"D"` (C4); si no hay DTE quedan vacíos.
- En los datos, 47,461 de 47,516 renglones traen `TRANSF` [D]; solo 2,977 traen identificadores de DTE [D].

### 3.2 Ventas de consumidor final desde CxC (`ivatranf`) [V]

- Fuente: `CCMOV01` con `FTMOV ∈ {C0, C4, A1, A3, A6}` y `FTICOM ∈ {F, E}` (F = factura consumidor final, E = exportación).
- **Agrupa por día**: documentos consecutivos del mismo tipo de movimiento, mismo `FTICOM` y misma fecha forman un renglón de `ivafac` con `fcomp1` = primer número y `fcomp2` = último. (Orden de lectura: `ftmov + fticom + FNFAC + fecha`; si dos días se intercalan en el número de factura, el rango se parte.)
- Para `FTICOM = "F"`: `neto += fmon − fexen + ivaper`; `exento += fexen`. Para exportaciones (`E`): `exportav += fmon`.
- Se graba: `fvgra = neto` (**venta gravada bruta, con IVA incluido**), `fvexen = exento`, `exporta = exportav`, `totalv = neto + exento + exportav`, `ftipo = tipo de movimiento`, serie y resolución del primer documento, identificadores de DTE del primero (`codgenera`, `ncontrol`) y del último (`codgeneraf`, `ncontrolf`).
- El IVA **no se guarda**: se calcula al imprimir el libro sobre el total del mes (§9).
- En los datos, 772 de 802 renglones son transferidos [D].

### 3.3 Compras desde Cuentas por Pagar (`ivatraco`) [V]

- Fuente: `QUEDAN` con `recibido` en el rango y `siiva = verdadero` ("Transferir al IVA" de CxP), y `NCREDEB` (notas) con `recibido` en el rango y `siiva`.
- Antes sincroniza proveedores: cada `PROVEDOR` con `REGISTRO` crea/actualiza `CONTRIBU` (NRC, nombre, NIT, dirección, DUI).
- Documento: `fcomp = comprob`, `ffec = fecha`, `intgr = afecta`, `intex = exenta`, `ivaint = iva`, `ivare`, `ivaper`, `ftipo = "C0"`, `compra`, `nretencion`, `npimp`, `nresolu`, `nserie`, `clasedoc`, `tipoope`, `clasific`, `sector`, `tipocosto`.
  `totalc = total + ivare + renta − otrocar` si la empresa es gran contribuyente; `total + renta − otrocar` si no (el total de CxP es **neto de retención**; aquí se vuelve a sumar para dejarlo bruto) [V]. El total en CxP es `afecta + exenta + iva − ivare + ivaper − renta + otrocar` (ver BANCOC §9.2); por eso este traslado resta `otrocar`.
- Si `ivare > 0`: crea un **segundo renglón** `ftipo = "C0"`, `fcomp = nretencion`, `retencion = verdadero`, `ivar = ivare` (el comprobante de retención como línea propia del libro).
- Notas: `ftipo = "A1"` si `operacion = 2` (nota de crédito) o `"C4"` si no (nota de débito); `totalc = total` de la nota.
- **No traslada** `impgr`/`impex`/`ivaimp` (importaciones), `cotrans`, `fovial`, `otrosi`, `ivaant` ni `codgenera/ncontrol/sellor`: esos datos se capturan a mano.
- En los datos **ningún** renglón de COMPRAS tiene `TRANSF`: aunque la bitácora registra 41 corridas de "Transferencias de Compras", las filas transferidas desaparecieron o se reemplazaron *(inferido: se capturó a mano o por CSV/JSON después)* [D].

### 3.4 Compras desde Inventarios (`ivatrac2`) [V]

- Fuente: `DATAMOV` (movimientos de inventario) con `fecha_mov` en el rango, `vtotal > 0` y `siiva`.
- `fcomp = nfact_env`, `ffec = fecha_mov`, `intgr = gravado`, `intex = exenta`, `ivaint = iva`, `totalc = vtotal`, `ftipo = "A1"` si `tipo_mov = "S"` (salida/devolución a proveedor) y `"C0"` si no, `compra = verdadero`, `ivaper`, `nserie`, `nresolu`, `npimp`, `clasedoc`, y los identificadores del DTE (`codgenera`, `ncontrol`, `sellor`) y la clasificación (`tipoope`, `clasific`, `sector`, `tipocosto`).
- Proveedor: por `provedor.registro` donde `provedor` es el código del movimiento.
- Borra las filas transferidas del mes antes de insertar (§3, riesgo).
- **Nota:** el menú condiciona esta opción a `camino3`, pero los datos vienen de `RUTAINV` (`camino4`); ambas rutas deben existir.

### 3.5 Ingresar al IVA desde Bancos / CONTAC [V]

`ivacomp2` también está compilado en BANCOC y la ruta `EMPRESAS.IVA`/`CAMINOIVA` de esas aplicaciones apunta a la carpeta de datos de IVA64. Desde "Ingresar al IVA" de una partida o de un documento bancario se abre la misma pantalla de compras (precargada) y se graba **directo en `COMPRAS` y `RETENER`** de IVA64. No hay llave que enlace el renglón con la partida (`COMPRAS` no tiene `TIPOPAR`/`NUMERO`) [V/D]. Ver §14.

## 4. Tipos de movimiento y signo

El catálogo `CCTMOV` (18 filas; es el mismo de CxC) define el código de 2 caracteres del `ftipo` [V]. Los usados en los libros:

| Código | Nombre en el catálogo | Uso en IVA64 |
|---|---|---|
| `C0` | Cargo por factura | Documento normal de compra o venta (crédito fiscal, factura, factura de exportación) |
| `A1` | Nota de crédito por devolución | Nota de crédito (resta) |
| `A3` | Nota de crédito por descuento | Nota de crédito (resta) |
| `A6` | Nota de abono devolución | Nota de crédito de consumidor final |
| `C4` | Nota de débito | Nota de débito (suma) |
| `C5`, `CR` | Compr. de retención / Comprobante de retención | Comprobante de retención en ventas (IVAFIS tiene 11 y 33) |
| `CA`, `C6` | `C6` es "Cargos internos"; `CA` no existe en el catálogo | Solo se mencionan en los archivos F987/COA; sin filas en los datos |

- **Regla de signo:** todo código que empiece con `A` se imprime y se suma **en negativo** en los libros y en los archivos (`IIF(LEFT(ftipo,1)="A", x*-1, x)`) [V]. Los importes se guardan siempre positivos.
- Los totales de los libros separan "ventas/compras", "notas de débito" y "notas de crédito" por prefijo.
- Distribución en los datos [D]: COMPRAS `C0` 19,441 · `A1` 46 · `A3` 7. IVAFIS `C0` 45,823 · `A1` 1,566 · `A3` 78 · `CR` 33 · `C5` 11 · `C4` 2 · vacío 3. ivafac `C0` 796 · `A1` 4 · `A6` 1 · `CR` 1.
- Un tipo puede llevar cuenta contable en el catálogo (`CTA`, `CTA2`, `CCTAE`) pero IVA64 nunca la usa.
- **Nueva plataforma:** `tax_document_types` propio de `tax` (código, nombre, signo, libro al que pertenece, código de anexo), no compartido con CxC.

## 5. Contribuyentes (proveedores) y clientes

- `CONTRIBU` (proveedores/contribuyentes, 610) y `CLIENTES` (1,158) son los maestros fiscales; la llave es el **NRC/registro** (`FREGI`, hasta 14 caracteres con guion) [V]. Ambas se mantienen desde IVA64 y se **sincronizan en un solo sentido** desde `PROVEDOR` (CxP) y `CCCLI01` (CxC) por `pasa.prg` o al transferir (crea o actualiza; nunca borra) [V].
- Campos: nombre, NIT, dirección, departamento y municipio (validados contra `CCDEP01`/`CCMUN01`: "Departamento no puede quedar en blanco", "Departamento no Existe", "Municipio no Existe"), actividad, tipo (`TIPOC`, combo "Nacional, Extranjero"; en los datos valen 1 (604 filas) y 0 (6): el significado de cada número queda por confirmar), **gran contribuyente** (`GRANCON` en proveedores, `GRANCLI` en clientes), DUI, actividad económica, y en proveedores `NRESOLU`/`NSERIE` (resolución y serie del proveedor, que se copian al documento de compra) [V].
- Alta duplicada: "Contribuyente ya Existe !!!". Alta "al vuelo" desde un documento: "Proveedor no registrado, desea Adicionarlo en este Momento" / "Cliente no registrado…", que abre la pantalla de maestro [V].
- **Datos:** 166 compras apuntan a un NRC que no existe en `CONTRIBU` y 27 ventas a uno que no existe en `CLIENTES`; 2,395 renglones de IVAFIS tienen el NRC vacío [D]. Sin NRC el archivo de Hacienda cae al DUI o queda vacío (§13).
- Corrección de NRC: "Cambiar el No. de Registro de un Cliente / Proveedor" reemplaza el NRC en **todos** los documentos (`REPLACE ALL fregi, fnom`) tras avisar "VERIFIQUE NO SE HA INGRESADO DOCUMENTOS CON ESE REGISTRO"; "Cambiar el NIT en Renta" hace lo mismo en `RENTAT`. No revisan mes cerrado [V].
- **Nueva plataforma:** un `tax_taxpayers` con `kind` (`supplier`/`customer`/`both`), enlace opcional a `ap_suppliers`/`ar_customers`, NRC único por empresa, y el cambio de NRC es una operación auditada que crea una nueva versión sin tocar documentos cerrados.

## 6. Registro de compras (`ivacomp2`)

### 6.1 Estructura del renglón [V]

| Campo | Qué es |
|---|---|
| `fcomp` | Número del documento (hasta 10); `ftipo` tipo de movimiento (`C0` por defecto) |
| `fregi`, `fnom` | NRC y nombre del proveedor (por `SEEK` en `CONTRIBU`) |
| `ffec` | Fecha del documento; `salfec` mes del libro |
| `intex` / `intgr` / `ivaint` | Compras **internas** exentas / gravadas / IVA |
| `impex` / `impgr` / `ivaimp` | **Importaciones** exentas / gravadas / IVA |
| `interexen`, `intergrav`, `impgravs` | Internaciones exentas/gravadas e importaciones de servicios (para el anexo 3; **vacíos en todos los datos**) |
| `ivaper` | IVA percibido (lo cobra un proveedor gran contribuyente) |
| `ivare` | IVA retenido (lo retiene la empresa si es gran contribuyente) ; `ivarete` campo adicional **sin uso** (0 filas) ; `ivar` monto del renglón de retención |
| `ivaant` | Anticipo a cuenta de IVA |
| `cotrans`, `fovial`, `otrosi` | Contribuciones especiales (Cotrans, Fovial) y otros impuestos del documento |
| `gravaexcl`, `ivaexcl`, `renexcl`, `excl` | Datos de **sujeto excluido** (§7) |
| `totalc` | Total de la compra |
| `retencion` | Casilla "Es retención a Terceros" ; `compra` casilla "Es Compra" (§6.5) |
| `nretencion` | Número del comprobante de retención emitido por la empresa |
| `nresolu`, `nserie`, `npimp` | Resolución y serie del documento del proveedor; correlativo interno ("No.Correlativo Interno") |
| `clasedoc` | Tipo de documento: 1 Impreso por Imprenta · 2 Formulario Único · 3 Otros · 4 Documento Tributario Electrónico |
| `codgenera`, `ncontrol`, `sellor` | Código de generación, número de control y sello de recepción del DTE |
| `tipoope`, `clasific`, `sector`, `tipocosto` | Clasificación de la declaración (combos, §6.4) |
| `transf`, `cerrado`, `anulada`, `sucursal`, `concepto` | Origen/estado (§3, §15); `anulada` y `sucursal` **no se usan** (0 filas) |

### 6.2 Cálculos al capturar [V]

- **Total** (se recalcula en cada campo): `totalc = impex + impgr + ivaimp + intex + intgr + ivaint + ivaper + cotrans + fovial + otrosi`.
  Es decir: suma exentas, gravadas e IVA, **suma el IVA percibido** y los otros impuestos; **no** suma `ivare` (la retención es informativa, el total queda bruto), `ivaant` ni `gravaexcl`. En los datos 63 de 19,494 compras no cumplen la fórmula [D].
- **IVA interno:** al digitar la compra gravada interna, `ivaint = ROUND(intgr × ivax / 100, 2)` (editable después). **IVA de importación:** al digitar `impgr`, `ivaimp = ROUND(impgr × ivax / 100, 2)`. En los datos 151 compras tienen `ivaint` distinto de ese cálculo con la tasa de 13 % [D]; son editados a mano o de otras fuentes.
- **Exclusión mutua interno/importación:** la compra interna (`intex`, `intgr`) solo se puede digitar si `impex = 0` y `impgr = 0`, y a la inversa. Es decir, **un documento es interno o de importación, no ambos** [V].
- **IVA retenido (1 %):** si la empresa es gran contribuyente (`grandex`), el proveedor **no** lo es, y se digitó número de comprobante de retención: `ivare = ROUND(intgr × cfg_ivare / 100, 2)`. El campo "No.Comp.de Retencion" solo se habilita en ese caso (`m.grandex AND !contribu.grancon`) y el botón "Imp. Retención" solo para `grandex` [V].
- **IVA percibido:** si la empresa **no** es gran contribuyente y el proveedor sí lo es: `ivaper = ROUND(intgr × cfg_ivare / 100, 2)`. **Se usa la tasa de retención (`cfg_ivare`), no la de percepción (`cfg_ivape`)**, igual que en Bancos (hallazgo ya registrado en BANCOC §9.2) [V]. No hay base mínima.
- **Fecha:** obligatoria; no mayor que el mes de trabajo.
- **No.Comp.de Retencion:** se normaliza a 10 dígitos con ceros (`TRANS(VAL(x),"@L 9999999999")`) y debe ser único en toda la tabla ("# Retencion ya fue asignado a otro documento") [V].
- **Resolución y serie:** al elegir el proveedor se precargan las del maestro (`contribu.nresolu`, `contribu.nserie`) y se pueden editar [V].

### 6.3 Altas, cambios, bajas [V]

- **Llave de unicidad:** `fcomp + fregi + ftipo` (índice `fcomp`): al digitar tipo y comprobante con proveedor existente, "Comprobante ya fue ingresado" y carga el existente. En los datos hay **167 llaves repetidas** entre filas vivas [D].
- Agregar con `nretencion`: además del renglón del documento, inserta en el mismo `COMPRAS` un renglón de **retención** (`fcomp = nretencion`, `retencion = .T.`, `ivare`, mismo proveedor, `transf = .F.`) [V].
- Modificar: si el mes está cerrado, "Mes cerrado, no puede modificarse...". Eliminar: confirmación "Seguro de Eliminar"; borra el documento **y** su renglón de retención (busca por `nretencion`) y deja bitácora.
- Pantalla de consulta: Anterior/Siguiente ("Es el primer código!" / "Es el último codigo!"), "Buscar" (`vercomp`), "Ver Todo" (`verivaco`), "Imp. Retención" (reporte `qwreten.frx`: "DOCUMENTO No. CCF … DE FECHA …", base, IVA, monto retenido y la cantidad en letras con `enletra.prg`; "No tiene Comprobante de Retencion" si está vacío).
- Bitácora: "Agrego/Modifico/Elimino La Compra No. {tipo} {número} Del Cliente {NRC} {nombre}" (programa "Compras a Contribuyentes").

### 6.4 Clasificación para la declaración [V]

Combos de `ivacomp2` e `ivaexcl` (el valor guardado es el índice, numérico):
- **Tipo de Operación** (`tipoope`): Gravada · No gravada · Excluido o no Contribuye Renta.
- **Clasificación** (`clasific`): Costo · Gasto.
- **Sector** (`sector`): Industria · Comercio · Agropecuaria · Servicio/Profesiones/Artes y Oficios.
- **Tipo de Costo/Gasto** (`tipocosto`): Gastos de Venta sin Donación · Gastos Administrativos sin Donación · Gastos Financieros sin Donación · Costo de Artículos Producidos/Comprados Importaciones/Internaciones · Costo de Artículos Producidos/Comprados Internos · Costos Indirectos de Fabricación · Mano de Obra.
Se usan desde la era del DTE: solo 966–959 de 19,494 compras las traen [D]. El índice 0 existe en los datos (417–425 filas) además del vacío: **el "0" no es lo mismo que sin dato** (*inferido*: valor por defecto del combo, a revisar con el negocio). Los códigos que se exportan al anexo 3 son estos números tal cual **(verificar contra el instructivo vigente)**.

### 6.5 "Es Compra" frente a gasto [V]

Casilla `compra` (solo se habilita para `ftipo = "C0"`). El libro impreso etiqueta el comprobante con prefijo **`C`** (compra), **`G`** (gasto: `compra = .F.`) o **`R`** (renglón de retención), y separa los parciales: "PARCIAL DE COMPRA DEL MES", "PARCIAL DE GASTOS DEL MES", "PARCIAL DE NOTAS DE CREDITO DEL MES" (§12). Solo 180 de 19,494 están marcadas como compra [D]: el resto sale como gasto.

### 6.6 Lectura de un DTE (botón "Leer json") [V]

- Pide un archivo con `GETFILE("JSON")` y lo lee como **texto** (`FILETOSTR`); **no hay parser JSON**: busca cadenas con `AT(...)` y recorta longitudes fijas. Cualquier cambio de formato (espacios, orden de campos, longitud de campos) rompe la lectura.
- Solo acepta `tipoDte = "03"` (comprobante de crédito fiscal); con otro tipo **regresa sin mensaje**.
- Toma: `numeroControl` → `ncontrol` y los últimos 10 caracteres como `fcomp`; `codigoGeneracion` → `codgenera`; `selloRecibido` → `sellor`; `fecEmi` → `ffec`; `nrc` → `fregi` (si no trae guion, inserta uno antes del último dígito y rellena a 14); `totalGravada` → `intgr`; `totalExenta` → `intex`; `ivaPerci1` → `ivaper`; IVA = `ROUND(intgr × ivax / 100, 2)` (**recalculado, no leído del JSON**); `totalc = intgr + intex + ivaint + ivaper`.
- Fija `ftipo = "C0"`, `clasedoc = 4` (DTE), abre en modo agregar. El proveedor se busca en `CONTRIBU`; si no existe, el nombre queda vacío (no lo crea).
- No valida que el DTE sea del mes, ni duplicados contra `codgenera`, ni que la suma cuadre con el JSON.
- **Nueva plataforma:** parser JSON real; validar `tipoDte` (aceptar 03, 05, 06, 14, 11 según el libro), unicidad por código de generación, tomar IVA del documento y reportar diferencias contra el cálculo; crear el proveedor pendiente de aprobar.

## 7. Compras a sujetos excluidos (`ivaexcl`)

- Mismo `COMPRAS` con `excl = verdadero` (30 filas en los datos [D]); el libro de compras principal **los filtra** (`SET FILTER TO SALFEC=MESACT AND !EXCL`) y el libro impreso los muestra en la columna "COMP. EXCL." [V].
- Campos: `fcomp` (No. de recibo), `fregi`, `fnom`, `ffec`, `ftipo`, `gravaexcl` ("Compra Excluida"), `renexcl` ("Renta"), `ivaexcl` ("IVA"), `concepto`, `anulado` (casilla "Anulado"), serie y resolución (de `EMPRESAS.EXSERIE/EXRESOLU`), código de generación y número de control, y la clasificación (§6.4) [V].
- Al digitar la compra excluida: `renexcl = gravaexcl × 0.10` (**sin ROUND**, editable) [V]. `ivaexcl` se digita a mano (el cálculo con `ivax` está comentado).
- Unicidad: solo por número de comprobante (`SEEK(fcomp)`; índice `fcomp2`), a diferencia del libro principal [V].
- Al grabar fuerza `excl = .T.`, `salfec = mesact`.
- El anexo de excluidos exporta `gravaexcl` y `ivaexcl`; **no** exporta `renexcl` (renta retenida) (§13.5). **(verificar)**
- Bitácora: programa "Compras a Excluidos".

## 8. Ventas a contribuyentes — crédito fiscal (`ivamfis2`)

### 8.1 Estructura [V]
`IVAFIS`: `fcomp` (10, se rellena con ceros a la izquierda), `ftipo`, `fregi`/`fnom`, `ffec`, `salfec`, `fexpo` (exportaciones), `fviex` (ventas exentas), `fvgne` (venta gravada **neta**), `fvgiv` (IVA, débito fiscal), `ivaper` (IVA percibido), `ivare` (IVA retenido por el cliente), `ivaant` (anticipo a cuenta), `totalv`, `nserie`, `nresolu`, `codgenera`, `ncontrol`, `sellor`, `transf`, `cerrado`; `fvgne` y `fvgiv` son los dos campos que el libro y el anexo imprimen.

### 8.2 Cálculos [V]
- **IVA:** al digitar `fvgne > 0`, `fvgiv = ROUND(fvgne × ivax / 100, 2)` (editable).
- **IVA percibido:** si la empresa es gran contribuyente, el cliente **no** lo es (`clientes.grancli`) y `fvgne > 100`: `ivaper = ROUND(fvgne × cfg_ivape / 100, 2)`. Aquí sí se usa la tasa de percepción.
- **Total:** `totalv = fexpo + fviex + fvgne + fvgiv + ivaper`. **No** suma `ivare` ni `ivaant` (el valor guardado excluye la retención del cliente) [V]. En los datos el total cumple la fórmula en las 47,516 filas [D] (porque la mayoría vienen de la transferencia).
- Defecto del movimiento: `ftipo = "C0"`; para `C0` nuevo precarga `nresolu`/`nserie` desde `EMPRESAS.CFRESOLU/CFSERIE`.
- Unicidad: `fcomp + ftipo` salvo `ftipo = "C5"` (comprobantes de retención, que pueden repetirse por cliente), y después `fcomp + ftipo + fregi`. Ya existe → "Comprobante ya fue ingresado" y lo carga. En los datos: 4 llaves repetidas [D].
- Modificar/Eliminar/Agregar revisan mes cerrado ("Mes cerrado, no puede modificarse..."). **Eliminar pide confirmación antes de revisar si el mes está cerrado.**
- Bitácora: programa "Ventas de Credito Fiscal".
- "Leer json": igual que §6.6 con campos del receptor (segunda aparición de `nrc`, `nombre`, etc.): `totalGravada` → `fvgne`, `totalExenta` → `fviex`, `ivaPerci1` → `ivaper`, `fvgiv` recalculado con `ivax`; `m.sucursal = "1"`, `m.fpago = 2`, `clasedoc = 4`.

## 9. Ventas a consumidor final (`ivamfac2`) — resumen diario

- Cada renglón de `ivafac` es un **rango de documentos de un día**: `fcomp1` (del), `fcomp2` (al), `ffec`, `ftipo`; importes `fvexen` (exentas), `vexensuje` (exentas no sujetas a proporcionalidad), `vnsujeta` (no sujetas), `fvgra` (**ventas brutas gravadas**), `exporta` (exportaciones fuera del área), `vexpdentro`, `vexpservi`, `vzonaf`, `vtercer`, `totalv`, más serie/resolución y los dos extremos del DTE (`codgenera`/`ncontrol` del primero y `codgeneraf`/`ncontrolf` del último) [V].
- **Total en pantalla:** `totalv = fvexen + vexensuje + vnsujeta + fvgra + exporta + vexpdentro + expservi + vzonaf + vtercer`, **pero al grabar** se recalcula como `fvexen + fvgra + exporta + vexpdentro + expservi + vzonaf` (sin `vexensuje`, `vnsujeta`, `vtercer`) [V]. Los dos cálculos difieren cuando hay importes en esas tres columnas; en los datos están vacías (0 filas) [D]. Además el nombre `expservi` no existe en la tabla (la columna es `vexpservi`).
- Unicidad: `fcomp1 + fcomp2` ("Comprobantes ya fueron ingresado"). Cada `fcomp` se rellena con ceros a 10 dígitos. En los datos 1 renglón tiene `fcomp1 > fcomp2` y en 499 de 802 `fcomp1 = fcomp2` [D].
- Al agregar precarga serie/resolución desde `EMPRESAS.FASERIE/FARESOLU`.
- **El IVA no se captura ni se guarda**: el libro lo calcula sobre el **total mensual** de ventas gravadas brutas:
  `IVA del mes = TOTGRA − ROUND(TOTGRA / (1 + ivax/100), 2)` y `venta neta = ROUND(TOTGRA / (1 + ivax/100), 2)`, con exentas y exportaciones aparte ("CALCULO DEL DEBITO FISCAL") [V, `ivarfa01.frx`]. Es decir, **el redondeo ocurre una sola vez sobre el total del mes**, no por documento. Esto es lo que el cliente espera ver; el cálculo por documento (que hace el sistema nuevo si se guarda por factura) puede diferir en centavos. **(verificar si es lo requerido por el instructivo)**
- El libro agrupa por tipo de movimiento: ventas (`C0`), notas de débito (`C4`) y devoluciones/notas de crédito (`A*`, en negativo).
- Bitácora: "Ventas de Consumidor Final"; el mes cerrado se verifica con el índice `salfec` de **IVAFIS** (alias `cierre`), no de `ivafac` (§15).

## 10. Retenciones de renta (`ivarenta`, `RENTAT`)

- Registro de **renta retenida a un tercero** (el comprobante lo emite la empresa): `fcomp` (10, correlativo), `nit` (NIT del retenido, validado contra `CONTRIBU` por `FNIT`; si no existe se ofrece darlo de alta como proveedor), `fnom`, `ffec`, `montog` (base gravada), `renta`, `codigoi` (código de ingreso, 2 caracteres), `salfec`; `afp` e `isss` existen pero no se capturan [V].
- Al digitar `montog > 0`: `renta = ROUND(montog × 0.10, 2)` (editable) [V].
- **Correlativo:** al agregar, `fcomp = CORREN.corre + 1` con ceros; al grabar guarda el mayor en `CORREN`. **`CORREN.DBF` no existe en la copia de datos** ni en ningún módulo [D]: la pantalla fallaría al abrir (`USE CORREN`) *(inferido: la tabla se perdió; o este módulo no se usa)*. `RENTAT` tiene 3 registros [D].
- Unicidad: `fcomp + NIT` ("Comprobante ya fue ingresado"). El mes cerrado se consulta en `COMPRAS` (no hay `cerrado` en `RENTAT`) [V]. La eliminación deja bitácora ("Renta Retenida").
- También llega desde Bancos/CxP ("Ingresar Renta", `ivarenta` de BANCOC) escribiendo en esta misma tabla; en CxP la renta del documento se registra al grabar (ver BANCOC §9.2).
- Reportes: "Retención de Renta" (`ivarrent`, mes o rango), "Renta Acumulada" (`ivaren`, suma por NIT y código), "Renta por Año" (`ivaren2`), y el archivo anual F910 (§13.7).
- `RENTA.DBF` (misma estructura, 0 filas) es una versión anterior.
- **Nueva plataforma:** correlativo en tabla propia con rango y reinicio configurable; la tasa depende del código de ingreso (tabla `tax_income_codes`).

## 11. Retención, percepción y anticipo de IVA — resumen

Todo depende de **dos banderas**: gran contribuyente de la empresa (`grandex`) y del tercero (`grancon`/`grancli`).

| Situación | Dónde se captura | Cálculo | Campo |
|---|---|---|---|
| Empresa gran contribuyente **compra** a un no gran contribuyente y emite comprobante de retención | Compras | `ROUND(intgr × cfg_ivare / 100, 2)` | `ivare` (informativo, no entra en `totalc`) + renglón `R` con `ivar` |
| Empresa **no** gran contribuyente compra a un gran contribuyente (le **perciben**) | Compras | `ROUND(intgr × cfg_ivare / 100, 2)` (**sic**: tasa de retención) | `ivaper` (entra en `totalc`) |
| Empresa gran contribuyente **vende** a un no gran contribuyente (percibe) con base > 100 | Ventas CCF | `ROUND(fvgne × cfg_ivape / 100, 2)` | `ivaper` (entra en `totalv`) |
| Cliente gran contribuyente **retiene** a la empresa | Ventas CCF | digitado | `ivare` (no entra en `totalv`) |
| Anticipo a cuenta | Compras y ventas CCF | digitado; la tasa `cfg_ivaan` solo se usa para derivar la base en el F930 | `ivaant` |

- En CCF la columna del libro se rotula **"PERCIBIDO"** si la empresa es gran contribuyente y **"RETENIDO"** si no; en el libro de compras es **"RETENIDO"** (gran contribuyente) o **"PERCIBIDO"** (el resto) [V]. Es decir, la **misma columna** guarda conceptos distintos según el régimen de la empresa, y el libro puede mostrar `ivare` o `ivaper` indistintamente: en CCF `IIF(ivaper=0, ivare, ivaper)` [V].
- En compras, el libro imprime `ivare` para `grandex` solo si el renglón es de retención (`retencion`), y `ivaper` en los demás casos [V].
- **Nueva plataforma:** columnas separadas (`vat_withheld_by_us`, `vat_withheld_to_us`, `vat_perceived_by_us`, `vat_perceived_to_us`, `vat_advance`) con una sola fórmula en un servicio de `tax`; la lógica de "quién retiene a quién" se decide con la clasificación de ambas partes **(verificar contra la norma vigente: umbrales y tasas)**.

## 12. Libros impresos (diseño legal)

Los tres libros se imprimen desde una pantalla con: Todo el Mes / Por Fechas (con fechas), **Firmas y Cargos** (dos líneas guardadas en `FIRMAS.MEM`), casilla "Imprimir Encabezado", casilla "Imprimir Fecha y No. de Página", nombre de archivo (si se llena, el reporte sale a texto y se muestra en una ventana; si no, vista previa/impresora) y "Generar a Excel" [V].
El encabezado imprime nombre de la empresa, "REGISTRO No.", "NIT.", "MES:" y la leyenda de valores en dólares o colones (§2.1) [V].

### 12.1 Libro de compras (`ivarco04.frx`)
- Origen: `COMPRAS` donde `salfec = mesact` (más `ffec` dentro del rango si "Por Fechas"), orden por `ffec`. Antes de imprimir: las filas con `ivar > 0` y tipo no `A*` pasan `ivar` a negativo [V].
- **Columnas:** CORR. · EMIS. (fecha, dd/mm) · NUM. · COMPROB. (prefijo `C`/`G`/`R` + número) · IDENTF. EXCL. (NRC del excluido) · REGISTRO (NRC) · NOMBRE DEL PROVEEDOR · COMPRAS EXENTAS (**Internas**, **Importaciones**) · COMPRAS GRAVADAS (**Internas**, **Importaciones**) · IVA (**crédito fiscal interno**, **importaciones**) · RETENIDO / PERCIBIDO · anticipo a cuenta · TOTAL COMPRAS · COMP. EXCL.
- **Pie:** TOTALES de la página y generales; PARCIAL DE COMPRA, PARCIAL DE GASTOS y PARCIAL DE NOTAS DE CRÉDITO del mes; las notas de débito (`C4`) cuentan como compra/gasto en positivo en los parciales; firma y cargo de `FIRMAS.MEM`.
- La exportación a Excel agrega las filas "TOTAL COMPRAS", "TOTAL GASTOS", "TOTAL NOTAS DE CREDITO", "TOTAL NOTAS DE DEBITO" y "TOTAL" con las mismas columnas (Corr, Fecha, Comprob, Registro, Proveedor, internas/importaciones exentas, gravadas, IVA interno e importaciones, retenido/percibido, "retención" `ivarete`, total, IVA excluido).
- El rótulo de la columna IVA cambia a "CTA.IVA" si la empresa **no** es gran contribuyente y a "IVA" si lo es (`m.grandex`).
- Dos formatos de salida: papel (`ivarco04`) y texto (`ivadco03`), y variantes por rango de meses (`ivadco05`) y por proveedor (`ivarco03`).

### 12.2 Libro de ventas a contribuyentes (`ivarcf01.frx`)
- Título "LIBRO DE VENTAS A CONTRIBUYENTES FISCALES", subencabezados "VENTAS INTERNAS A CONTRIBUYENTES" / "DETALLE DEL LIBRO".
- **Columnas:** CORR. · EMIS. (fecha) · NUM. · No. DE COMPROB. · REGISTRO No. · NOMBRE DEL CLIENTE · VENTAS EXENTAS (`fviex`) · VENTAS GRAVADAS (`fvgne`) · DÉBITO FISCAL (`fvgiv`) · IVA RETENIDO / PERCIBIDO (según régimen) · ANTIC. A CTA. (`ivaant`) · TOTAL VENTA (`totalv`). Los `A*` salen negativos.
- **Totales:** VENTAS A CONTRIBUYENTES (`C0`), NOTAS DE DÉBITO (`C4`), NOTAS DE CRÉDITO (`A*`) y T O T A L E S. Hay también un bloque "CONSUMIDORES FINALES" que muestra el cálculo del IVA de consumidor final con la misma fórmula del §9 sobre `GRA − GRA/(1+ivax/100)` [V].
- Variantes: por cliente (`ivarcf03`), anual por meses (`ivarcf02`), texto (`ivadcf01`, `ivadcf02`). Existe también una columna de EXPORTACIONES (`fexpo`) que no se usa (0 filas).

### 12.3 Libro de ventas a consumidor final (`ivarfa01.frx`)
- Título "LIBRO DE VENTAS A CONSUMIDOR FINAL". Una fila **por día**: DIA · DEL No. · AL No. · VENTAS EXENTAS · VENTAS GRAVADAS (brutas) · EXPORTACIONES · TOTAL VENTAS DEL DÍA; con la misma lógica de signo y subtotales de ventas / devoluciones (`A*`) / notas de débito (`C4`).
- Pie "CALCULO DEL DEBITO FISCAL": TOTAL VENTA GRAVADA, VENTAS NETAS GRAVADAS (`ROUND(TOTGRA/IVA,2)`), % DÉBITO FISCAL (`TOTGRA − ROUND(TOTGRA/IVA,2)`), exentas y exportaciones.

**Nueva plataforma:** el libro es un reporte de solo lectura sobre los documentos (PDF y Excel), con la numeración de folios opcional (pregunta 25), totales por tipo y las mismas fórmulas; la verificación de paridad exige que cuadre al centavo con el impreso del sistema anterior.

## 13. Archivos para Hacienda (`genarchi`, F930, F910, F987, COA)

Todos se generan en la carpeta indicada ("Directorio de Copia", `getdir()`), con nombre por defecto `CCOA` (o `f930`, `f910`), y el sistema anterior **no valida** que el período esté cerrado ni que los libros cuadren. En todos, el NIT/NRC se exporta **sin guiones**; si el tercero no tiene NIT ni DUI, se usa el NRC en lugar del NIT [V].
Los formatos legales deben confirmarse contra el instructivo vigente de Hacienda **(verificar)**; lo que sigue es lo que el sistema escribe.

### 13.1 "Archivos Hacienda IVA" (`genarchi`) — Excel (.XLS)
La pantalla ofrece "Archivo Texto / Archivo Excel" pero **todas las rutas escriben `.XLS`** (`COPY ... TYPE XLS`); las líneas CSV están comentadas. Siete botones:

### 13.2 Anexo "Compras Locales" (anexo `3`)
Filtro: `COMPRAS` con `salfec = mesact` (**ignora el rango de fechas**) y `(impgr > 0 OR intgr + intex > 0)`, unida a `CONTRIBU`. Antes: `intex += fovial + cotrans + otrosi` (los otros impuestos se suman a "exentas internas") [V].
**Tipo de documento:** `C0` con `intgr > 0` → `03`; `C0` con `impgr > 0` → `12`; `A1`/`A3` → `05`; `C4` → `06` **(verificar `12`)**.
**Columnas, en orden:** FECHA (dd/mm/aaaa) · CLASE DE DOCUMENTO (`clasedoc`) · TIPO DE DOCUMENTO · NÚMERO DE DOCUMENTO (el código de generación del DTE; si no hay, el número) · NIT · NOMBRE · COMPRAS EXENTAS INTERNAS · INTERNACIONES EXENTAS (`interexen`) · IMPORTACIONES EXENTAS (`impex`) · COMPRAS GRAVADAS INTERNAS · INTERNACIONES GRAVADAS (`intergrav`) · IMPORTACIONES GRAVADAS (`impgr`) · IMPORTACIONES DE SERVICIOS (`impgravs`) · IVA (**`ivaint + ivaimp`**) · TOTAL (`totalc`) · DUI (sin guiones) · TIPO DE OPERACIÓN · CLASIFICACIÓN · SECTOR · TIPO DE COSTO/GASTO · NÚMERO DE ANEXO (`3` fijo). Orden por fecha.
**Notas:** los renglones de retención y los de excluidos quedan fuera (no tienen `intgr/intex/impgr`); los importes de notas de crédito salen **positivos** (no se aplica el signo `A*`) — a diferencia del libro impreso **(verificar)**.

### 13.3 Anexo "Crédito Fiscal" (anexo `1`)
Filtro: `IVAFIS` con `ffec` en el rango y `fvgiv + fviex <> 0`, unida a `CLIENTES`, orden por NIT y luego fecha/número. Tipo de documento: `C0` → `03`, `A1`/`A3` → `05`, `C4` → `06`; **clase** `1` (impreso) o `4` (DTE: si `ncontrol` no está vacío) [V].
Si el **primer** renglón del archivo (ordenado por NIT) trae sello (`sellor`), todo el archivo usa el formato DTE; si no, el formato con resolución y serie. **Un mes mixto (antes y después del DTE) sale con un solo formato** [V].
- **Formato DTE (columnas):** FECHA · CLASE · TIPO DOC · NÚMERO DE CONTROL · SELLO DE RECEPCIÓN · CÓDIGO DE GENERACIÓN · NÚMERO INTERNO (últimos 8 de `fcomp`) · NIT · NOMBRE · EXENTAS (`fviex`) · NO SUJETAS (0) · GRAVADAS (`fvgne`) · DÉBITO FISCAL (`fvgiv`) · VENTAS A TERCEROS (0) · DÉBITO A TERCEROS (0) · TOTAL (`totalv`) · DUI · TIPO OPERACIÓN (`1` fijo) · TIPO INGRESO (`3` fijo) · ANEXO (`1` fijo) · NRC.
- **Formato anterior:** FECHA · CLASE · TIPO DOC · RESOLUCIÓN · SERIE · NÚMERO DE DOCUMENTO (últimos 8) · NÚMERO DE CONTROL INTERNO · NIT · NOMBRE · EXENTAS · NO SUJETAS · GRAVADAS · DÉBITO · TERCEROS · TOTAL · DUI · TIPO OPERACIÓN · TIPO INGRESO · ANEXO.

### 13.4 Anexo "Consumidor Final" (anexo `2`)
Filtro: `ivafac` con `totalv > 0`, `ffec` en el rango y `ftipo ∈ {C0, A6}` (**las notas `A1`/`A3` de consumidor final no se exportan**) [V].
Tipo de documento: `C0` sin exportaciones → `01`; `C0` con exportaciones (`exporta + vexpdentro + expservi + vzonaf > 0`) → `11`; `A1`/`A3`/`A6` → `05`. Clase `1`, o `4` si hay `ncontrol`; para `4` la resolución, serie y números de control salen **"N/A"** [V].
**Columnas:** FECHA · CLASE · TIPO DOC · RESOLUCIÓN · SERIE · NÚMERO DE CONTROL (del / `ncontrol`) · NÚMERO DE CONTROL (al / `ncontrolf`) · CÓDIGO DE GENERACIÓN (del) · CÓDIGO DE GENERACIÓN (al) · MÁQUINA REGISTRADORA (vacía) · VENTAS EXENTAS (`fvexen`) · EXENTAS NO SUJETAS A PROPORCIONALIDAD (`vexensuje`) · NO SUJETAS (`vnsujeta`) · GRAVADAS (`fvgra`) · EXPORTACIONES DENTRO DEL ÁREA (`vexpdentro`) · EXPORTACIONES FUERA DEL ÁREA (`exporta`) · EXPORTACIONES DE SERVICIO (`vexpservi`) · ZONAS FRANCAS (`vzonaf`) · VENTAS A TERCERO (`vtercer`) · TOTAL (`totalv`) · TIPO OPERACIÓN `1` · TIPO INGRESO `3` · ANEXO `2`.
Si no hay `ncontrol`, el número "del"/"al" se llena con el documento inicial/final.

### 13.5 Anexo "Compras a Excluidos" (anexo `5`)
Filtro: `COMPRAS` con `salfec = mesact` y `excl`. **Columnas:** TIPO (`2` fijo) · DUI · NOMBRE · FECHA · SERIE · NÚMERO DE DOCUMENTO · MONTO (`gravaexcl`) · **IVA** (`ivaexcl`) · TIPO OPERACIÓN · CLASIFICACIÓN · SECTOR · TIPO COSTO/GASTO · ANEXO (`5`). La renta retenida (`renexcl`) no se exporta **(verificar)** [V].

### 13.6 "Retención de IVA 1 %" (anexo `7`) y "Percepción de IVA 1 %" (anexos `8` y `9`)
- **Retención** (solo si la empresa **no** es gran contribuyente): ventas CCF con `ivare > 0`; `base = ivare × 100 / cfg_ivare`. Columnas: NIT · FECHA · TIPO `07` · SERIE · NÚMERO · MONTO SUJETO · IVA RETENIDO · DUI · ANEXO `7`. Para una empresa gran contribuyente el botón no produce nada (la rama está vacía) [V].
- **Percepción:** si la empresa es gran contribuyente → ventas CCF con `ivaper > 0` (anexo `9`, tipo `03`); si no → compras con `ivaper > 0` (anexo `8`, tipo `03`). Mismas columnas que arriba, más código de generación, número de control y sello en el caso de ventas.
- "Todo el mes" (`salfec = mesact`) o "Por fechas" (`ffec` entre fechas).

### 13.7 Exportaciones
Lee **directo de CxC** (`CCMOV01` con `FTICOM = "E"` y `FMON > 0`), no de `ivafac` [V]: ver pregunta 24.

### 13.8 F930 (`f930`, `f930v2`) — percepciones, retenciones y anticipos a cuenta
Opciones: **Percepciones / Retenciones / Anticipo a cuenta**; "Proceder" imprime el informe ("INFORME DE IVA PERCIBIDO", "INFORME DE ANTICIPO A IVA PERCIBIDO", "INFORME DE IVA RETENIDO", "INFORME DE ANTICIPO A IVA RETENIDO", "INFORME DE ANTICIPO A CUENTA") y "Generar Archivo" escribe el archivo. La fuente depende del régimen:

| Opción | Gran contribuyente (empresa) | Otra empresa |
|---|---|---|
| Percepciones | ventas CCF con `ivaper > 0` (monto = `fvgne`) | compras con `ivaper > 0` (monto = `intgr`) |
| Retenciones | compras con `nretencion` (IVA = `ivare`, monto = `intgr`) | ventas CCF con `ivare > 0` (monto = `ivare × 100 / cfg_ivare`) |
| Anticipo a cuenta | compras con `ivaant > 0` (monto = `ivaant × 100 / cfg_ivaan`) | igual |

- Códigos fijos de cabecera (**calificación / modalidad / documento**): percepción gran contribuyente `1/1/1`, percepción otra `2/1/1`, retención gran contribuyente `1/3/3` (número = `nretencion`), retención otra `2/3/3`, anticipo `2/2/2` **(verificar significado)**.
- **F930 v1** — texto de ancho fijo (SDF): `nombre` C40 · `nit` C14 · `calix` C1 · `modx` C1 · `docux` C1 · `numdoc` C16 · `montos` C15 (**en centavos, relleno de ceros**) · `ingresos` C12 (centavos) · `periodo` C6 (`MMAAAA`).
- **F930 v2** — Excel: `nit` · `nombre` · `calix` · `modx` · `docux` · `fecha` · `serie` · `numdoc` · `montos` (decimal) · `ingresos` (decimal) · `periodo`.

### 13.9 F910 (`f910`) — renta retenida anual (Excel)
Fuente: `RENTAT` con `ffec` en el rango, agrupado por NIT y código de ingreso. Columnas: NOMBRE C40 · NIT C14 · CÓDIGO DE INGRESO · MONTO SUJETO anual · bonificaciones · IMPUESTO RETENIDO anual · aguinaldo exento · aguinaldo gravado · ISSS · AFP · IPSFA · CEFAFA · BM · **monto gravado por mes (12 columnas)** · **renta retenida por mes (12)** · 12 columnas de aguinaldo (siempre 0) · año. ISSS, AFP, IPSFA, CEFAFA, bonificaciones y aguinaldos se escriben como **0**: la pantalla no los captura aunque `RENTAT` tiene `afp`/`isss` [V]. Un error conocido: la columna de bonificaciones se rellena con el valor de CEFAFA.

### 13.10 F987 v1/v2/v3 y COA — formatos anteriores
- **COA** (`ivarcoa`, "COA de Compras / de Crédito Fiscal / de Importaciones"): texto de ancho fijo (`.DAT`) o Excel; registro `ncr` C14 (NRC sin último guion) · `periodo` C2 · `fecha` C8 (`AAAAMMDD`) · `tdocum` C1 · `ndocu` C25 · `iva` C11 (centavos con ceros). Tipo de documento: compras `C0` normal `1`, retención `4`, nota `2`/`A1`/`A3`; ventas `C0` → `1`, `A1/A3` → `2`, `C4` → `3`, `C5` → `4`. El IVA sale **tal como está guardado**.
- **F987 v1** (texto SDF `.TXT`/`.DAT`/`.XLS`): `periodo` C2 · `tipodoc` C1 · `ncr` C14 · `fecha` C8 · `tdocum` C1 · `ndocu` C20 · `mopc` C11 (monto de la operación, centavos) · `iva` C11 (**recalculado: base × 0.13**, centavos) · `ann` C4. Variantes: Compras Locales, Crédito Fiscal, Importaciones, "Consumidor Final < 200" y "> 200".
  Consumidor final menor o igual a 200 (sin IVA) se resume **por día**: `fecha` C8 · `regis` C8 (cantidad de documentos) · `mopc` · `iva` · `ann`; mayor de 200 va **por cliente**.
- **F987 v2** (Excel, dos archivos: "e" resumen por NIT y "d" detalle) y **v3** (Excel; el resumen por NIT está comentado y solo sale el archivo de detalle): resumen por NIT `concepto` C1 (`1` compras, `4` ventas) · `tipodoc` C1 · `nit` C14 · `nombre` · `montoop` · `ivaop`; detalle con periodo, NIT, nombre, fecha, clase de documento, tipo, serie, número preimpreso, control, monto e IVA. IVA = **base × 0.13**.
- **Estado:** las versiones se acumularon (v1 sigue en el menú); no hay forma de saber cuál es la vigente **(verificar)** (preguntas 20–21).

### 13.11 "Subir Libros de IVA" (carga CSV, `subiriva`) [V]
Tres cargas desde un `.csv` (se elige el archivo con `GETFILE`) sin encabezado:
- **Compras:** `tipodoc, annmes, fecha, comprob, nombre, registro, ninterno, nresolucion, nserie, nretencion, gravadaint, ivaint, ivare, exentaint, exeimp, gravadaimp, ivaimp, totalcom` (18 columnas). Si el mes `annmes` ya tiene filas en `COMPRAS`: "Ya existen datos para ese mes, no puede subirlo". Fecha en formato `dd/mm/aaaa`.
- **Ventas crédito fiscal:** `tipodoc, fecha, comprob, nombre, registro, gravada, iva, ivaper, exenta, totalven, ivare`; el mes se toma de la **primera fila**; si ya hay filas del mes, "Ya existen datos para ese mes, no puede subirlo".
- **Ventas consumidor final:** `tipodoc, fecha, documentoi, documentof, gravado, exento, exportaciones, totalven`; asigna `fcomp2 = documentoi` (**error: debería ser `documentof`**) [V]. Esto explica los 499 renglones con `fcomp1 = fcomp2` en los datos *(inferido)*.
- No valida que el tercero exista, que el total cuadre, el mes cerrado ni los duplicados; no marca `transf`. Para ventas el mes de **todas** las filas es el de la primera.

## 14. Conexión con Contabilidad, Bancos/CxP, CxC e Inventario

| Con | Dirección | Cómo |
|---|---|---|
| Contabilidad (CONTAC) | Ninguna desde IVA64 | **IVA64 nunca escribe en el libro mayor** ni lee cuentas; `cfg_iva_cf/db/re` existen en `IVACFG.MEM` pero ningún programa las usa [V]. La partida de la compra la crea Bancos/CxP/el usuario; "Ingresar al IVA" se habilita en `cgmpar01` cuando una línea usa la cuenta de IVA crédito fiscal (ver CONTAC §4) |
| Bancos / CxP | Entra | (a) "Ingresar al IVA" desde un documento bancario o partida abre `ivacomp2`; (b) CxP marca "Transferir al IVA" (`QUEDAN.SIIVA`) y IVA64 trae los documentos por `ivatraco`; (c) "Ingresar Renta" escribe en `RENTAT`. El renglón de `COMPRAS` **no guarda** la llave del documento ni de la partida |
| CxC / facturación | Entra | `ivatranc` e `ivatranf` leen `CCMOV01`/`CCCLI01` (cxc64) y los identificadores del DTE de `FELECTRO` (INV64) |
| Inventarios | Entra | `ivatrac2` lee `DATAMOV` (compras con IVA) |
| Planilla | — | La renta de planilla no pasa por aquí: el F910 de este módulo no captura ISSS/AFP/aguinaldo |

**Nueva plataforma:** los documentos de otros módulos llegan por **evento/API** con `source_module` y `source_ref`; el renglón de `tax` conserva `gl_entry_id` cuando existe. `tax` no contabiliza por defecto; si el negocio quiere el asiento de liquidación del IVA (débito − crédito − retenciones), se publica al GL con `source = 'iva'` (ya existe en `GL_ENTRY_SOURCES`) y `source_ref` = id del período liquidado (pregunta 5).

## 15. Cierre mensual

- **Cierre** (`ivacierr`): pide mes y año ("Esta opción cierra los movimientos del Mes Seleccionado, y fija los saldos. Ya no Podrá hacer modificaciones"), anota la bitácora ("Cerro el mes de {mes} del {año}") y marca `cerrado = .T.` en **todos** los renglones de `salfec` = ese mes en `COMPRAS`, `ivafac` e `IVAFIS`, **solo si el primer renglón del mes no estaba ya cerrado** [V].
- **Abrir mes cerrado** (`abririva`): lo contrario, solo si el primero estaba cerrado; bitácora "Abrio el Mes de …" [V].
- **Qué bloquea:** agregar, modificar, eliminar y transferir **de ese libro** (se consulta el índice `salfec` del propio libro con `SEEK mesact`; si el primer renglón del mes está `cerrado`, no deja). Excepciones: las ventas de consumidor final consultan la tabla `IVAFIS`; `RENTAT` consulta `COMPRAS`; los cambios de NRC/NIT, la carga CSV y la eliminación de un renglón de ventas no revisan [V].
- Un mes **sin renglones** no se puede cerrar (no hay nada que marcar); si luego se cargan filas a ese mes (por ejemplo con la carga CSV, que no revisa el cierre), quedan abiertas.
- En los datos **ningún renglón está cerrado** (0 en las tres tablas) [D]: el cierre mensual no se usa en esta copia.
- **Nueva plataforma:** `tax_periods` por empresa y período con estado `open`/`closed`/`filed` (presentado), usuario y fecha; toda escritura exige período abierto (de este libro, sin excepciones); se puede cerrar un mes vacío; las correcciones de un mes presentado se registran como un ajuste en el siguiente período abierto (pregunta 26).

## 16. Permisos, validaciones y mensajes

- Cada opción del menú revisa permiso en `PERFIL` (usuario + clave de programa): "Lo siento no tiene Acceso a esta opción". Niveles de `USUARIOS` (`USRLVL`, `USRTYPE`): `usrtype = 2` oculta "Ventas Crédito Fiscal"; `usrlvl = 3` oculta los tres libros; `usrlvl` ∈ 1–3 ve "Reindexar"; solo `usrlvl = 1` ve "Usuarios" [V].
- **Nueva plataforma:** roles de la plataforma (Supervisor / Digitador / Consulta) con permisos `capture`, `reports`, `supervise`; la lista de reportes de libros va con `reports`; cerrar/abrir mes y configuración con `supervise`.
- Mensajes de validación (se citan tal cual): "No.de Doc. no puede quedar en blanco" · "Debe especificar el nombre del proveedor/cliente" · "Debe Especificar la fecha" · "Fecha no puede ser mayor que el mes de Trabajo" · "Tipo de Movimiento no Existe" · "Comprobante ya fue ingresado" · "Comprobantes ya fueron ingresado" · "# Retencion ya fue asignado a otro documento" · "Proveedor no registrado, desea Adicionarlo en este Momento" · "Cliente no registrado, desea Adicionarlo en este Momento" · "Seguro de Eliminar" · "Mes cerrado, no puede modificarse..." · "Mes cerrado, no puede ser transferido..." · "No se han registrado compras/ventas para ese periodo" · "No Existen movimientos para esas fechas" · "Fecha no puede quedar en blanco" · "Mes incorrecto, debe ser NN" · "Año incorrecto, debe ser AAAA" · "Fecha inicial debe ser menor que la final" · "Ya existen datos para ese mes, no puede subirlo" · "Contribuyente ya Existe !!!" · "Es el primer código!" · "Es el último codigo!" · "VERIFIQUE NO SE HA INGRESADO DOCUMENTOS CON ESE REGISTRO" · "No tiene Comprobante de Retencion" · "Opcion no disponible".
- Concurrencia: `proteger.prg` espera con un indicador "Registro en uso por otro / Espere por favor" hasta tomar el candado del registro [V]. **Nueva plataforma:** transacción SQLite y control optimista por versión.

## 17. Hallazgos del sistema anterior que no deben reproducirse

1. Tasa de IVA global en un `.MEM` (`SAVE TO iva` guarda todo el entorno) y constantes escritas (13 %, 10 %, 100, 200).
2. Percepción en compras con la tasa de retención; mismas columnas con significados que dependen del régimen.
3. Total de la pantalla de consumidor final distinto del que se graba (`vexensuje`, `vnsujeta`, `vtercer`); campo `expservi` inexistente.
4. Transferencias destructivas por mes, no idempotentes, y que se pisan entre sí; sin llave al documento origen.
5. "Subir CSV" de consumidor final con `fcomp2 = documentoi`.
6. Cierre mensual por la primera fila, con excepciones, nunca usado en la copia; mes vacío no cerrable.
7. Anexo 3 y excluidos ignoran el rango de fechas; anexo 1 mezcla formatos en meses de transición; el anexo 2 omite `A1`/`A3`.
8. Lectura de DTE por búsqueda de texto, sin parser; solo tipo `03`; falla silenciosa.
9. Correlativo de renta en una tabla (`CORREN`) que no existe en la copia.
10. Tablas con claves duplicadas (167 en compras, 4 en ventas), clientes y proveedores faltantes (27 y 166) y 2,395 ventas sin NRC.
11. Rutas de integración absolutas que ya no coinciden con la carpeta real.
12. `ivaren` llama a un reporte (`ivarend.frx`) que no está en el proyecto; `ivarcoa` sin fila en `PERFIL`.
