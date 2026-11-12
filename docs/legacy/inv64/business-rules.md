# INV64 — Reglas de negocio extraídas del código

Fuentes principales (carpeta `MCERP/INV64/FUENTE`, salvo indicación):
`access.PRG`, `selemp.PRG`, `MENUIN.MPR`; facturación: `inmfac01.scx/.SPR`, `inmfac03`, `inmexp01`, `inmexp02`,
`inmdevol`, `inmdevo2`, `ccmmov02`, `ivaexcl`, `ivaexcl2`, `inmpedi`, `inmped`, `inmped2`, `infacecf`, `danulado`,
`incrodia`, `incuadre`, `cambianu`, `correla`, `inmserie`, `inrecdoc`, `verdte`; inventario: `inmmov01…06` (+ sus `.spr`),
`inmart1`, `inmbod1`, `inmtmov1`, `config1…3`, `cambia`, `fisico01…04`, `infisico`, `cierre1`, `posteo`, `posmov.prg`,
`creames.prg`, `inabre`, `retaceo.prg`, `entraped.prg`, `kardex2`, `sival01/02`, `inprovi`; contabilidad: `ccpart`,
`ccpartve`, `ccpartco`, `cgadipar.prg`, `inrnocta`. Datos: `MCERP/INV64/DBF` (más `CCMOV01`/`CCCLI01` de cxc64 y
`PARTIDAS`/`DETAPART`/`QUEDAN` de CONTAC).

Convención: **[V]** verificado en código o datos · **[I]** inferido. Los mensajes de pantalla se citan en español.
**Nueva plataforma:** marca dónde conviene diferir del sistema anterior. Lo tributario (tasas, umbrales, códigos de
DTE) se describe como lo hace el código; **debe contrastarse con la norma vigente antes de implementarse**.

---

## 1. Contexto técnico

1.1 **Arranque.** `access.PRG` carga configuración, abre `EMPRESAS`, valida que el número de empresas no haya sido
alterado ("Violación a la Integridad del sistema…"), lee `USUARIOS` (nivel `USRLVL`, `PERMI*`) y llama a `selemp`, que
filtra las empresas por `USREMP` y arma el `SET PATH` con las 7 rutas de `EMPRESAS` [V]. Solo hay una empresa en disco.

1.2 **Configuración por empresa** vive en `EMPRESAS` (IVA `TIVA` = 13, `GRANDE`, `PERCIBIR`, `DESCUENTOT`, `CVINETA`,
`DBLOCCXC`, modo de operación del DTE `MODOOP`, nombres de formatos de impresión, giro, actividad económica,
departamento/municipio, correo, logo) y en archivos `.MEM` en la carpeta de datos [V]:
`BASE.MEM` (variables `cfg_*`: decimales, líneas por documento, % de IVA como factor `cfg_iva`, % de percepción
`cfg_perci`, monto mínimo gravado para percibir `cfg_grava`, `cfg_exisbo` validar existencias, `cfg_hayser`
(permitir repetir producto), `cfg_conta`, `cfg_prove`, `cfg_prefi1`/`cfg_prefij`, nombres de **cuentas contables**
de IVA y de centro de costo), `MESACT.MEM` (mes de trabajo, también por usuario), `CLAVE.MEM` (clave de cierre),
`FIRMAS.MEM`, `IVACFG.MEM`, `BANCOCFG.MEM`. **Los valores de cuentas, rutas y datos fiscales no se copian aquí.**
Nota: `cfg_iva` se recalcula en pantalla como `1 + TIVA/100`; el valor de `BASE.MEM` es solo un respaldo.
*Nueva plataforma:* toda esta configuración pasa a tablas por `empresa_id` (`sal_settings`, `inv_settings`).

1.3 **Mes de trabajo.** Todas las pantallas de captura exigen que la fecha del documento caiga en el mes de trabajo
(`MESACT`): "Año Incorrecto. Debe ser AAAA" / "Mes Incorrecto. Debe ser MM", y que ese mes **no esté en `CIERRE`**:
"!!Mes Cerrado!!, No Puede hacer Movimientos" [V]. Para tocar un documento de otro mes hay que cambiar el mes de
trabajo; si el mes está cerrado, reabrirlo (§16.4).

1.4 **Borrado.** `SET DELETED ON` + `DELETE` de FoxPro (borrado lógico) y luego `PACK` externo. Los conteos en disco
(pocos borrados) indican que se empaca [V]. *Nueva plataforma:* anulación, nunca borrado físico.

1.5 **Concurrencia.** El número de documento y los acumulados se leen y escriben sin transacción ni bloqueo
(`SEEK`+`REPLACE` en varias tablas) [V]. Un fallo a medio guardado deja encabezado, líneas, kárdex y saldos
inconsistentes. *Nueva plataforma:* una transacción por documento.

---

## 2. Tipos de documento, series y numeración

2.1 **Tabla `CORRE`** (una fila por tipo de documento): `TIPOFAC`, `DOCUMENTO`, `CORRE` (último número), `NSERIE`,
`NRESOLU`, `TIPDOC` (código DTE), `VERSION` (versión del esquema DTE) [V]. En disco hay seis tipos:

| `TIPOFAC` | Documento | `TIPDOC` DTE | Pantalla | Dónde se guarda |
|---|---|---|---|---|
| `C` | Comprobante de crédito fiscal | 03 | `inmfac01` | `CORFACT`/`FACT` |
| `F` | Factura consumidor final | 01 | `inmfac03` | `CORFACT`/`FACT` |
| `E` | Factura de exportación | 11 | `inmexp01` | `CORFACT`/`FACT` |
| `N` | Nota de crédito | 05 | `inmdevol` | `CORDEV`/`DEVOL` |
| `D` | Nota de débito | 06 | `ccmmov02` | `CCMOV01` (sin líneas) |
| `S` | Sujeto excluido | 14 | `ivaexcl(2)` | `COMPRAS`/`DEXCLU` (IVA64) |

No hay tipo `R` (remisión) aunque `inmpedi` intenta usarlo: el DTE de remisión no funciona [V]. **No hay tipo de
"cotización" ni "pedido" fiscal**: el pedido (`REMISION`, 0 filas) no consume correlativo fiscal.

2.2 **Cómo se numera** (todo es texto de 10 caracteres rellenado con ceros a la izquierda) [V]:
- CCF (`inmfac01`): si `cfg_prefi1` está apagado, propone **último `CORFACT` + 1**; si está encendido usa `CORRE.CORRE + 1`
  (el contador `CORRE` solo lo usan CCF, `inmenv01` y `inmfac04`).
- Consumidor final: lo digita el usuario; si ya existe al grabar, toma el último + 1.
- Exportación: último de la tabla + 1 al entrar al campo.
- Nota de crédito: propone el último número de nota de crédito en `CCMOV01` + 1; verifica "Comprobante ya Existe..." y
  "Ese documento ya existe".
- Sujeto excluido: último de `COMPRAS` + 1.
- La **serie** (`NSERIE`) y la **resolución** (`NRESOLU`) se copian de `CORRE` al documento y a la fila de `CCMOV01`
  (`nserie`, `nresolu`). `inmserie` ("Actualizar Series de Documentos") y `correla` solo editan `CORRE`.

2.3 **Riesgos:** dos terminales pueden proponer el mismo número (no hay bloqueo); un usuario puede digitar cualquier
número; no hay verificación de huecos. 1,442 llaves duplicadas en `DATAMOV` en disco [V, ver §19].
*Nueva plataforma:* `sal_series` (empresa, tipo de documento, serie, punto de venta, resolución/rango, próximo
número) con asignación atómica del correlativo al **emitir**; el número no se digita. Si el negocio exige conservar
el número digitado (migración, contingencia), permitirlo con permiso y con unicidad por `(empresa, tipo, serie, número)`.
El correlativo del DTE (número de control, §11) es otro dato: no mezclarlo.

---

## 3. Documentos de venta con producto: precios, IVA, percepción y totales

(Aplica a `inmfac01`, `inmfac03`, `inmexp01`, `inmdevol`, `inmdevo2` salvo donde se indique.)

3.1 **Cabecera de factura.** Cliente (de `CCCLI01`, cxc64), vendedor, visitador (`codvi`), transporte, forma de pago
MH (`formpago`, catálogo de Hacienda con 14 filas), contado o crédito, plazo, % comisión, flete, pedido asociado,
orden de compra del cliente (`norden`), observaciones [V]. Al elegir cliente:
- el plazo, el vendedor, el transporte y la forma de pago se toman **de la ficha del cliente**;
- "Cliente Inactivo, no puede Facturar" bloquea al agregar (solo *inactivo*; *suspendido*, límite de crédito y *contado* no se aplican) [V];
- en CCF, "No es Contribuyente, tiene que ser Factura" si el cliente no tiene registro de IVA (`fregiva`) [V];
- **control de crédito:** si el cliente tiene saldo vencido (30–150 días) y no está marcado `LIBERAR`: muestra "Tiene Saldo Vencido por … Desea Facturarle" y pide una clave (`clave.spr`, acepta la clave de cualquier usuario); si `DBLOCCXC > 0` y el cliente pagó a más de 90 días (`P90`) pide también clave [V]. Es una advertencia con clave, no un bloqueo duro.
*Nueva plataforma:* `credit_policy` configurable (bloqueo duro, advertencia o aprobación con permiso y bitácora).

3.2 **Precio de la línea.** Lista de precio según `CCCLI01.NPRECIO` (1 = `PRECIO_VTA`, 2 = `PRECIO_CRE`, 3 = `PRECIO_OTR`,
4–9 = `PRECIO4…9`; otro valor → `PRECIO_VTA`) [V en el `.spr` viejo]; el usuario puede sobrescribir el precio. La tabla
`MOVPRO` guarda el **último precio por cliente y producto** (se actualiza al grabar si la fecha es mayor o igual) [V].
Existe `PCLIENT` (precios por cliente) pero no se usa en estas pantallas [I].

3.3 **Cantidad, bonificación y descuento.**
- `cantidad vendida` (`compra`) + `unidades bonificadas` (`bonifica1`) = cantidad que sale del inventario;
  la bonificación **no cobra** pero se registra `PREBONI = bonifica1 × precio`; en el DTE la bonificación se declara como descuento (ver §11.4) [V].
- Subtotal de línea = `ROUND(cantidad vendida × precio, 2)` [V].
- Descuento **porcentual por línea** (`%`), aplicado como `subtotal − ROUND(subtotal × % / 100, 3)` (redondeo a 3 decimales; luego el resultado se guarda con la precisión de la columna `N13.5`) [V]. `EMPRESAS.DESCUENTOT = .T.` (en esta copia) activa la variante "nueva versión" del DTE en que el descuento se declara a nivel de documento [V §11.4].
- Línea de **servicio** (`ARTICULO.ESSERV`): no mueve inventario ni valida existencia [V].
- Exento por línea: si `ARTICULO.EXENTO` **o** el cliente es exento (`CCCLI01.FEXENTO`) la línea va a `exento`, sin IVA [V].
- No se puede repetir un producto en la factura ("Articulo ya Existen en factura") salvo que `cfg_hayser` esté activo [V].
- Existencia: si `cantidad + bonificación > BODEGAn` muestra "No hay suficiente existencia bodegaN=…"; **bloquea solo si `cfg_exisbo`**, que está apagado → solo advertencia [V]. Con un pedido: "CANTIDAD SOBRE PASA EL PEDIDO" recorta [V].

3.4 **IVA por tipo de documento** (con `cfg_iva = 1 + tasa/100`):

| Documento | Cómo se guarda la línea | IVA de la línea |
|---|---|---|
| CCF (`C`) | `gravado` = total de línea **sin** IVA | `iva = ROUND(gravado × cfg_iva, 2) − gravado` (suma al total) [V en `LostFocus` de `inmfac01.scx` y en datos: 28,691 de 29,415 líneas 2025+] |
| Consumidor final (`F`) | `gravado` = total de línea **con** IVA incluido | `iva = gravado − ROUND(gravado / cfg_iva, 2)` (extraído) [V; datos: 256 de 263] |
| Exportación (`E`) | `gravado` = total, tasa 0 | `iva = 0` [V] |
| Nota de crédito `C` | como CCF (exclusivo) | `iva = ROUND(subtotal × cfg_iva,2) − subtotal` [V] |
| Nota de crédito `F` | como consumidor final | extraído [V] |

(El `.spr` viejo de `inmfac01` tiene una variante con IVA incluido en CCF que **no está viva**; los datos confirman el cálculo exclusivo.)

3.5 **Totales del documento** [V]:
- `exentot = Σ exento` de las líneas.
- CCF: `gravadot = Σ gravado + flete`; `ivat = ROUND(gravadot × cfg_iva, 2) − gravadot` (**IVA recalculado sobre la base total, no suma de IVA de líneas**; puede diferir en centavos de `Σ iva`). `totalt = exentot + gravadot + ivat ± percepción`.
- Consumidor final: `gravadot = Σ gravado + flete`; `ivat = gravadot − ROUND(gravadot / cfg_iva, 2)`; `totalt = exentot + gravadot` (el IVA va dentro).
- Exportación: `gravadot = Σ gravado + flete + seguro`; `totalt = exentot + gravadot`.
- Nota de crédito: `ivat` **siempre exclusivo** aunque el documento original sea `F`: una nota de crédito sobre factura consumidor final suma IVA otra vez *(inferido como error del sistema anterior; solo 8 filas)*.
- Peso total = Σ (cantidad + bonificación) × `ARTICULO.PESO`.
- Todos los redondeos son a 2 decimales con `ROUND` de FoxPro (mitad hacia afuera).
*Nueva plataforma:* guardar por línea base, IVA y total como decimales exactos; **un solo método de redondeo explícito** (decidir con el negocio entre redondeo por línea o sobre la base: hoy es sobre la base en el encabezado y por línea en el detalle, y pueden diferir en centavos). Las dos formas (IVA incluido y exclusivo) se modelan con un flag `price_includes_tax` por tipo de documento.

3.6 **Percepción / retención de IVA (1 %).** Variables: `cfg_perci` (porcentaje), `cfg_grava` (monto mínimo gravado), `EMPRESAS.GRANDE`
(la empresa es gran contribuyente), `EMPRESAS.PERCIBIR`, `CCCLI01.GRANCLI` (cliente gran contribuyente) [V]:
- Empresa `GRANDE` y `PERCIBIR` y cliente **no** gran contribuyente y `gravado ≥ cfg_grava`: **percepción** = `ROUND(gravado × cfg_perci/100, 2)`, **se suma** al total.
- Empresa **no** `GRANDE` y cliente `GRANCLI` y `gravado ≥ cfg_grava`: **retención** del mismo monto, **se resta** del total.
- En el DTE la cifra viaja como `ivarete1` (ver §11), y en `CCMOV01.ivaper` para el libro de IVA (ver iva64 business-rules, traslado desde CxC). En esta copia: empresa no `GRANDE`, `PERCIBIR = .T.`.
- En notas de crédito la retención se calcula solo si el cliente es `GRANCLI`, el usuario marca "Calcular Retención" y la empresa no es `GRANDE`.
- El sistema vincula el nombre de la variable "percepción" y "retención" indistintamente (cxc64 ya lo señaló). **Pregunta abierta**: ¿es el mismo %? (open-questions).

3.7 **Condiciones de pago.** `tipo_pago = 1` es **crédito** y `2` contado en la pantalla (el combo muestra "Crédito"/"Contado");
el DTE traduce crédito → condición 2 y contado → 1 [V]. El vencimiento es `fecha + plazo`. Las facturas de contado
**también** crean fila `C0` en `CCMOV01`: la cobranza al contado se resuelve luego en cxc64 ("Cancelar Ventas de Contado") [V].

3.8 **Captura.** La rejilla permite hasta `cfg_lineas` líneas (200 en `BASE.MEM`, pero la pantalla CCF mantiene 42 en
memoria y la rejilla de factura consumidor final 12 visibles); el detalle se arma en un cursor `DETALLE` y se
persiste al grabar. Cada línea toma del `ARTICULO`: grupo, subgrupo, `COSTO_PROM` (el costo de la venta, ver §13), peso,
lote y vencimiento (`VENCE2`). Teclas de ayuda: `*` en un campo abre el buscador de cliente/producto/vendedor [V].
*Nueva plataforma:* captura por rejilla con teclado, igual flujo; líneas ilimitadas; costo calculado en el servidor al emitir.

---

## 4. Exportación

4.1 Campos propios: recinto fiscal (`RECINTOFI`, catálogo de 4), régimen (`REGIMEN`, 56), incoterm (`CODINCOTER`, 16), tipo de ítem
(`TIPOITEMEX`: Bienes/Servicios/Ambos = 1/2/3), flete, seguro, país (`PAISV`), número de declaración (se actualiza
después con `inmexp02`, que solo hace `REPLACE numenvi` en `CORFACT` sin validar mes ni DTE) [V].
4.2 Sin IVA (tasa 0); `gravadot` incluye flete y seguro; se advierte "Costo mas alto que precio de venta". Validaciones: "Recinto Existe.." y "Incoterms NO Existe.." (sic) [V].
4.3 Si el ítem es servicio puro (`TIPOITEMEX = 2`) el DTE manda recinto, régimen e incoterm en `null` [V].
4.4 Se guarda `CCMOV01` con `fticom = 'E'` y la bitácora registra "Agregó Exportación No…" [V].

---

## 5. Notas de crédito, de abono y de débito

5.1 **Nota de crédito (`inmdevol`).** Encabezado `CORDEV` (`tipo_mov E`, concepto `ED`, `NCREDITO`, `TIPDOC '05'`,
`APLICAR`, `APLICADOA`, `TIPOFAC` del documento original, `RETENER`, `TNC`, `EXISTEDTE`), líneas `DEVOL`, kárdex y `DATAMOV` [V].
- **Motivo (`TNC`):** Devolución, Vencimiento o Avería (1/2/3). Es solo descriptivo: no cambia ninguna lógica contable [V]; hay 184 notas con `TNC = 0` (históricas).
- "**Aplicar a C X Cobrar**" + número del documento original (`APLICADOA`) + `TIPOFAC` (C o F): "Debe Especificar el Tipo de Documento, C o F"; "Documento no existe para ese cliente, verifique" [V]. **Las líneas no se validan contra el original** (no hay límite por producto/cantidad/precio; el control está comentado) [V]. *Nueva plataforma:* validar contra el documento original (producto, cantidad pendiente de devolver, precio) y permitir notas sin referencia (descuentos) con permiso.
- **Reingreso a inventario:** entrada concepto `ED` a `ARTICULO.COSTO_PROM` **del momento de la nota**, no al costo de la venta original; no recalcula el promedio [V]. *Nueva plataforma:* reingresar al costo de la venta original (trazable por línea) — decisión de negocio (open-questions).
- **Cartera se escribe al IMPRIMIR, no al Grabar** [V]: valida "!!Mes Cerrado en Cuentas por Cobrar !!, No Puede Modificar", borra la fila `A1` anterior (y revierte su abono en la `C0`), calcula `totge` (CCF: gravado + exento + IVA ± retención; F: sin retención), y si se aplica a un documento comprueba el saldo ("Abono sobrepasa el Saldo-Saldo Disponible") y suma a `C0.fabono`; inserta `CCMOV01` `A1` con referencia a `APLICADOA`, `fticom`, monto, IVA, exento, gravado, retención, serie y resolución. Una nota grabada y no impresa **no existe en cartera** [V]. *Nueva plataforma:* el efecto en CxC ocurre al **emitir** (un solo evento), no al imprimir.
- DTE 05 (§11.5).

5.2 **Nota de abono (`inmdevo2`).** Mismo esqueleto, fila `A6` en lugar de `A1`, sin DTE; 2 filas `A6` en disco: prácticamente sin uso [V].

5.3 **Nota de débito (`ccmmov02`, pantalla "Nota de Débito" del menú).** Documento de cartera puro, sin líneas ni kárdex: fila `C4` en `CCMOV01`;
referencia obligatoria a un `C0` existente ("Documento no existe"); IVA incluido (F) o exclusivo (CCF); suma a `fcargo` del original; permite DTE 06 solo si la fecha es **hoy** ("No puede facturar con fecha distinta a la del …") [V]. 8 filas en disco.

---

## 6. Sujeto excluido (compras a sujetos excluidos)

6.1 **No es un documento de venta ni de inventario:** `ivaexcl` (cabecera: DUI, recibo, fecha, tipo, renta) y `ivaexcl2` (con líneas) escriben en `COMPRAS` (el libro de compras de IVA64, `EXCL = .T.`, 30 filas) y `DEXCLU` (26 líneas) [V]. La retención es **10 % fijo** (`m.renexcl = gravaexcl × 0.10`, IVA 0); pago neto = base − retención. Validaciones: "No.de Doc. no puede quedar en blanco", "Debe Especificar la fecha", "Fecha no puede ser mayor que el mes de Trabajo", "Comprobante ya fue ingresado" [V].
6.2 Se emite como DTE 14; modificar/eliminar se bloquea una vez generado el DTE ("No puede Modificar el DTE ya fue generado") [V].
*Nueva plataforma:* pertenece a `tax`/`accounts-payable` (documento de compra), con el DTE 14 gestionado por el módulo de facturación electrónica; el 10 % pasa a parámetro con vigencia.

---

## 7. Pedidos, prefacturas y remisiones

7.1 `inmpedi` (pedido → `REMISION`/`DETAREMI`) tiene estados: cerrado, autorizado, facturado, anulado. La factura solo acepta pedidos autorizados ("Pedido no ha sido autorizado") del tipo correcto ("Debe ser Crédito Fiscal"/"Debe ser Consumidor Final"). No mueve inventario ni cartera. **0 filas en disco**: no se usa en este cliente [V].
7.2 `inmped2` (prefactura → `PED`/`DETAPE`) sí mueve inventario; `infacecf/infacemp/infacem2` consolidan prefacturas en facturas (20 grupos por número) y escriben kárdex concepto `EE`; 0 filas: sin uso [V].
7.3 `inremi01` (consignaciones), `inmfenv` (remisiones), `inmenv01` (egresos): 0 filas. `ENVIO` (11): datos de envío (bultos, transporte) [V].
*Nueva plataforma:* modelar cotización/pedido/entrega solo si el negocio lo usa; no migrar tablas vacías.

---

## 8. Qué se escribe al grabar (resumen)

| Pantalla | Tablas escritas (en el mismo guardado) |
|---|---|
| CCF, F, E | `CORFACT` (encabezado, `USUARIO`, serie, resolución, `TIPDOC`), `FACT` (una fila por línea, con `COSTO_PROM`/`COSTO_PRE` y `PORVENTA`), `MOVIMIEN` (una fila por línea no servicio: `S`/`SV`, `PROVEEDOR` en blanco), `DATAMOV` (encabezado de movimiento), **`CCMOV01`** `C0` (cxc64), `MOVPRO`, `BODMES`, `MESES`, `SALDOLO`/`VENCE2` (si hay lote), `ARTICULO` (`BODEGAn`, `EXIST_ACT`), `DETAREMI`/`REMISION` (si hay pedido), `CCCLI01` (última venta y 3 últimas compras, solo si la línea es del grupo 1) |
| Nota de crédito | `CORDEV`, `DEVOL`, `MOVIMIEN` (`E`/`ED`), `DATAMOV`, `BODMES`, `MESES`, `SALDOLO`/`VENCE2`, `ARTICULO`; **al imprimir** `CCMOV01` `A1` y `C0.fabono` |
| Nota de débito | `CCMOV01` `C4`, `C0.fcargo`, `CCCLI01` |
| Sujeto excluido | `COMPRAS`, `DEXCLU`, `BITACORA` |
| Entrada/salida/transferencia/compra | `DATAMOV`, `MOVIMIEN`, `BODMES`, `MESES`, `SALDOLO`, `VENCE2`, `ARTICULO`, `DPEDI.RECIBIDO` (orden de compra), `QUEDAN` (si provisiona) |

8.1 **Fila de cartera `C0`** (clave `C0` + número + tipo) [V]: `ftmov = 'C0'`, `ffec` = fecha, `fref`/`fnfac` = número, `fcta` = cliente,
`fmon` = total (con percepción/retención), `fvaliva` = IVA, `fexen` = exento, `fgrav` = gravado, `fticom` = tipo (C/F/E),
`fvend`, `fplazo`, `ffpago = fecha + plazo`, `transporte`, `porcomi`, `ivaper`, `flete`, `peso`, `nserie`, `nresolu`, `usuario`,
`butter` (marca de grupo 1). Se crea o **se sobrescribe** (por clave) en cada guardado y en el botón *Imprimir*/*Ticket*
(otro lugar que reescribe `C0` con el total vigente) [V]. `INCUADRE` también **crea** una `C0` faltante desde `CORFACT` [V].
8.2 Para cxc64 esto significa que la fuente de verdad de la factura es `CORFACT` (inventario) y `CCMOV01` es su copia
de cartera: el spec de CxC recibe la factura por API/evento (ver cxc64 business-rules §3).
*Nueva plataforma:* `sal_documents` es la fuente; al emitir publica un evento `sales.document_issued` que crea el cargo en `accounts-receivable` (con `source_ref`) en la misma transacción; nada reescribe el cargo después.

---

## 9. Modificar, eliminar, anular

9.1 **Modificar** (CCF, F, E, nota de crédito): se implementa como `borrar` (revierte stock, saldos mensuales y lotes y borra las líneas) + `grabar` (inserta de nuevo). Condiciones [V]:
mes abierto y igual al mes de trabajo ("Documento no es del mes Seleccionado!, No Puede MODIFICAR"; "!!Mes Cerrado!!, No Puede MODIFICAR"), permiso `permim` o `usrlvl = 1` ("No tiene Permiso de MODIFICAR"), y **que no exista DTE generado** (CCF: "No puede modificar, documento electronico ya fue generado"; E y nota de crédito: "No puede modificar DTE ya fue generado"). **La factura consumidor final no comprueba el DTE al modificar** (solo el botón de enviar rechaza: "Documento ya fue transmitido no puede modificarlo"): se puede alterar localmente un documento ya transmitido [V].
9.2 **Eliminar:** supervisor o `permi` ("Unicamente el Supervisor puede Eliminar" en F; "No tiene permisos para Eliminar"), mes abierto y vigente, **no impreso** ("Comprobante no puede Eliminarse, ya fue impreso"), **sin abonos** ("No puede eliminar este documento, tiene abonos") y sin DTE generado ("No puede eliminar, DTE ya fue generado"). Revierte el kárdex, borra `CCMOV01` `C0` y las filas de `CVINETA`. Un bloque adicional revierte filas `E`/`EE` de la numeración de prefacturas [V].
9.3 **Anular** (botón *Anular*): permiso `permia`/supervisor, mes abierto y vigente, **sin abonos** ("No puede anular, elimine primero los abonos" / "Factura no puede anularla, elimine primero los abonos"), confirmación "Seguro de Anular Este Documento". Efecto: revierte el kárdex y borra las líneas (`FACT`, `MOVIMIEN`, `DATAMOV` del documento), pone `ANULADA = .T.` y **deja a cero** la fila `C0` de cartera (la conserva con monto 0); en `CORFACT`, CCF deja `exentot/gravadot/ivat/totalt/ivaper/flete` en 0 (el sistema conserva solo el encabezado). **Las líneas de un documento anulado desaparecen** [V; datos: 0 líneas para los encabezados anulados de notas de crédito]. 
9.4 **Anulación fiscal (invalidación):** primero se anula el documento; después "Anular F.Electro" registra la solicitud en `FANULAR` (§11.6). No hay unión automática: anular localmente no invalida en Hacienda, y se puede invalidar sin haber anulado localmente solo si no se pasa por la primera comprobación ("Debe de anular primero el Documento").
9.5 *Nueva plataforma:* **no se borran líneas**; un documento emitido es inmutable (no se modifica: se anula con documento de anulación/nota de crédito y se reemite); la anulación revierte stock con movimientos inversos (`reversal_of`), conserva totales originales y vincula el evento DTE de invalidación al documento. La "modificación" solo existe en borrador.

---

## 10. Relación con los libros de IVA y cartera

10.1 Los libros de ventas de IVA64 **se llenan desde `CCMOV01`** (traslado desde CxC) y toman los identificadores del DTE de `FELECTRO` por `nfact_env + tipo` (`fticom` para C0, `N` para A1/A3, `D` para C4); si no hay DTE quedan vacíos (ver iva64 business-rules, traslado de ventas). Por eso `CORFACT` → `CCMOV01` debe cuadrar: `INCUADRE` es la verificación manual.
10.2 La compra de IVA64 puede llenarse con "Transferir desde Inventarios" desde `DATAMOV` con `siiva`. **Hallazgo:** el `DATAMOV` en disco (57,621 filas, 34 columnas) **no tiene** las columnas `SIIVA`, `NCONTROL`, `CODGENERA`, `SELLOR`, `CLASEDOC`, `TIPOOPE`, `CLASIFIC`, `SECTOR`, `TIPOCOSTO`, `OBSERVA`, `AREA` que `inmmov01/03` manejan en memoria y que `GATHER MEMVAR` descarta si el campo no existe [V]. Las pantallas de compra solo pueden guardar esos datos fiscales si la tabla viva tiene esas columnas: **la copia de datos es de una versión anterior al código** *(inferido)*. Ver §19.
10.3 Las exportaciones y las notas de crédito/débito se informan al libro de ventas con su tipo; ver iva64.

---

## 11. Facturación electrónica (DTE)

> Todo lo siguiente es lo que hace **el código de INV64**. El esquema oficial del DTE, los catálogos, el firmado, la
> transmisión y el contingente **no están en este código** y deben contrastarse con la normativa y la documentación
> técnica vigente (el `DBF` trae un PDF "Catálogos - Facturación Electrónica" del cliente, no leído en este spec).

11.1 **Arquitectura real (verificada).** El sistema no genera el JSON, no firma y no transmite. Hay tres pasos [V]:
1. **Preparación (INV64):** el botón **"Enviar F.Electro"** de cada pantalla de factura escribe en `FELECTRO` una fila **por línea del documento**, con todos los datos del emisor, receptor, totales y apéndices repetidos en cada fila, y con `NCONTROL`, `CODGENERAC`, `SELLORE`, `NUMVALIDAC` en blanco. Si ya existía una preparación sin número de control, la **borra y la rehace** (permite corregir antes de transmitir); si ya tiene número de control, bloquea ("Documento ya fue transmitido no puede modificarlo"). Se exige número de documento ("Correlativo esta en blanco no puede enviarlo").
2. **Proceso externo (no está en el código fuente):** lee las filas con `PROCESADO = .F.`, construye el JSON, lo firma, lo transmite y escribe de vuelta `NCONTROL`, `CODGENERAC`, `SELLORE` (sello de recepción), `PROCESADO = .T.` y `FALLO` (1 si falló). Ningún programa de INV64 escribe esos campos *(verificado por búsqueda en todo el código)*. Se **infiere** que es un programa separado que corre sobre la misma carpeta de datos; el código lo confirma solo por el lado de lectura: la pantalla muestra `NCONTROL`/`CODGENERAC` de `FELECTRO` y busca el PDF `<código de generación>.pdf` y la imagen `<código>.PNG` en la carpeta `RUTAPDF` de la empresa.
3. **Presentación (INV64):** "Ver PDF" (`verdte`: visor de PDF de `RUTAPDF` + código de generación; "Archivo pdf no existe") y "Ticket" (reporte `inrticke2` con el QR en PNG; "No existe Codigo de Generacion, no puede imprimir"). *Se desconoce* quién genera el PDF y el PNG (el mismo proceso externo, *inferido*).
El **envío por correo** del DTE y la **contingencia** no existen en el código de INV64: `tipocontin`/`motivocont` se escriben fijos en `"null"` (no hay modo de contingencia) y no hay rutina de correo [V].

11.2 **Documentos que se emiten y cuántos hay** (documentos distintos, no filas; filas vigentes de `FELECTRO` = 35,944; 7,403 borradas = preparaciones rehechas):

| Tipo DTE | Documento | `TIPODOC` en `FELECTRO` | Documentos | Versión del esquema (`CORRE.VERSION`) |
|---|---|---|---|---|
| 01 | Factura consumidor final | `F` | 235 | 1 |
| 03 | Comprobante de crédito fiscal | `C` | 10,768 | 3 |
| 05 | Nota de crédito | `N` | 641 | 3 |
| 06 | Nota de débito | `D` | 7 | 3 |
| 11 | Factura de exportación | `E` | 21 | 1 |
| 14 | Sujeto excluido | `S` | 18 | 1 |

Fechas de emisión: 2024-11-01 a 2026-10-22 (1,065 documentos en 2024, 8,019 en 2025, 2,606 en 2026) [V]. Antes de
2024-11 hay unos 45,000 documentos de venta **sin** DTE. La remisión (tipo 04), la factura de sujeto excluido de
otro tipo y otros no existen.

11.3 **Estados** (derivados de los campos que escribe el proceso externo) [V por datos]:
- Preparado y pendiente: `NCONTROL` vacío y `PROCESADO = .F.` (unas 13 preparaciones, 9 de ellas con `FALLO = 1`).
- Aceptado: `NCONTROL`, `CODGENERAC` y `SELLORE` llenos y `PROCESADO = .T.`, `FALLO = 0` (≈11,600 documentos).
- Transmitido pero con `FALLO = 1` y `PROCESADO = .T.` (68 en CCF) o sin `PROCESADO` (8 CCF + 1 nota de crédito): **estado ambiguo**; el flag no se limpia al reintentar *(inferido)*.
- `INVALIDADA` nunca se marca (0), `NUMVALIDAC` (número de validación) siempre vacío y `AMBIENTE` siempre vacío en esta copia. La invalidación vive en `FANULAR`.
- No hay estado "rechazado" con motivo: no se guarda el mensaje de error del receptor. *Nueva plataforma:* tabla de eventos de transmisión con estado, respuesta y reintentos.

11.4 **Qué dato legado alimenta qué sección del DTE** (mapeo de campos, no copia del código) [V]:

| Sección del DTE | Campos `FELECTRO` | Origen |
|---|---|---|
| Identificación | `VERSION`, `AMBIENTE`, `TIPODTE`, `TIPOMODELO`, `TIPOOPERAC`, `TIPOCONTIN`, `MOTIVOCONT`, `FECEMI`, `HOREMI`, `TIPOMONEDA` | `CORRE.VERSION`/`TIPDOC`; `EMPRESAS.MODOOP` (ambiente); modelo y operación fijos `1`; contingencia fija `"null"`; fecha del documento (`YYYY-MM-DD`), hora del sistema; moneda fija USD |
| Emisor | `NITEMISOR`, `NRCEMISOR`, `NOMBREEMIS`, `CODACTIEMI`, `DESCACTIEM`, `NOMCOMEEMI`, `TIPOESTABL`, `DEPARTAMEN`, `MUNICIPIO`, `DIRECCEMIS`, `TELEFONOEM`, `CORREOEMI`, `CODESTABMH`, `CODESTABLE`, `CODPUVENMH`, `CODPUNTOVE` | `EMPRESAS` (NIT, registro, nombre, actividad, dirección, teléfono, correo, depto./municipio); tipo de establecimiento y **códigos de establecimiento y punto de venta como literales fijos en el programa** (no configurables por empresa/sucursal) |
| Receptor | `NITRECEPTO`, `NRCRECEPTO`, `NOMBRERECE`, `CODACTIREC`, `DESCACTIRE`, `NOMCOMEREC`, `DEPARTAREC`, `MUNICIPREC`, `DIRECCRECE`, `TELEFONREC`, `CORREORECE`, `TIPODOCUME`, `NUMDOCUMEN` | `CCCLI01` (cxc64): NIT sin guiones, registro de IVA, razón social, actividad (`ACT_ECO`), nombre comercial, dirección, teléfono, correo. Tipo de documento del receptor: 03 pasaporte, 37 otro, 13 DUI/cédula, 36 NIT, **se pisan en ese orden: gana el último que exista (NIT)** |
| Ítems | `NUMITEM`, `TIPOITEM`, `CODIGO`, `CODTRIBUTO`, `CANTIDAD`, `UNIMEDIDA`, `DESCRIP`, `PRECIOUNI`, `MONTODESCU`, `VENTANOSUJ`, `VENTAEXENT`, `VENTAGRAVA`, `TRIBUTODE`, `PSV`, `NOGRAVADO`, `IVALIN`, `IVARETLIN`, `LOTE`, `FVENCE` | Línea del documento: tipo 2 si `ESSERV` (servicio) o 1; código = producto; unidad = `ARTICULO.UNIDADM` (catálogo `UNIDADM`, 56); precio unitario = precio de lista; `VENTAGRAVA` y `VENTAEXENT` de la línea |
| Resumen | `TOTALNOSUJ`, `TOTALEXENT`, `TOTALGRAVA`, `SUBTOTALVE`, `DESCUNOSUJ`, `DESCUEXENT`, `DESCUGRAVA`, `PORCENDESC`, `TOTALDESCU`, `CODTRIBU`, `DESCTRIBU`, `VALTRIBU`, `SUBTOTAL`, `IVAPERCI1`, `IVARETE1`, `RETERENTA`, `MONTOTOTOP`, `TOTALPAGAR`, `TOTALLETRA`, `SALDOFAVOR`, `CONDOPERA`, `CODIGOPAGO`, `MONTOPAGO`, `PLAZO` | Totales del encabezado (`exentot`, `gravadot`, `ivat`, `totalt`); `VALTRIBU` = IVA total; la **retención/percepción viaja en `IVARETE1`** y `IVAPERCI1` queda en 0; `TOTALLETRA` = importe en letras + " Dolares"; condición de pago (§3.7); código de pago = forma de pago MH numérica |
| Apéndice | `CAMPOAPEN…VALORAPE5` | "Datos del Vendedor" (código y nombre), "CCF"/"Código Cliente", observaciones, "OrdenCompra" si hay orden de compra |
| Referencia a otro documento (05, 06) | `TIPODOCNC`, `TIPOGENENC`, `NOCCFDENC`, `FECCFDENC` | Tipo del original fijo `"03"`; si el original tiene DTE: tipo de generación 2 + **código de generación** y fecha de emisión del original; si no: tipo 1 + número del original y su fecha en `CCMOV01` |
| Exportación (11) | `RECINTOFI`, `REGIMEN`, `CODINCOTER`, `NOMINCOTER`, `FLETE`, `SEGURO`, `TIPOITEMEX`, `CODPAIS`, `NOMPAIS`, `TIPOPERSON` | Pantalla de exportación y `CCCLI01` |
| Control (lo escribe el proceso externo) | `NCONTROL`, `CODGENERAC`, `SELLORE`, `NUMVALIDAC`, `FHPROCESAM`, `PROCESADO`, `FALLO`, `INVALIDADA` | Nada en INV64 los escribe (`FHPROCESAM` se llena en la preparación con la fecha del documento y la hora) |

- **Bonificaciones y descuentos.** Sin `DESCUENTOT`: el descuento va por línea (`MONTODESCU = subtotal − total`) y las unidades bonificadas se suman a la venta gravada (`VENTAGRAVA = gravado + bonificación×precio`) y se declaran como descuento total. Con `DESCUENTOT` (activo en esta copia): `MONTODESCU` de línea = 0, `VENTAGRAVA` = subtotal sin descuento, y el descuento total (más la bonificación) se declara en `DESCUGRAVA`/`TOTALDESCU` del resumen [V]. Las dos variantes coexisten en el código; una de ellas es la vigente por empresa.
- **Número de control y código de generación:** los asigna el proceso externo (no hay generación en INV64). El legado usa el número de documento del sistema como `NFACT_ENV` y lo enlaza con `FELECTRO` por `NFACT_ENV + TIPODOC`. En los DTE de compra (`inmmov01` "Leer json") el sistema **lee** el JSON de un CCF recibido buscando textos (`tipoDte`, `numeroControl`, `codigoGeneracion`, `selloRecibido`, `fecEmi`, `nrc`, `nit`, `totalGravada`, `totalExenta`, `ivaPerci1`…) con funciones de texto, no con un analizador JSON; solo acepta tipo 03; el número de documento de compra se toma de los **últimos 10 dígitos del número de control** [V].
- **Representación impresa:** reporte `inrticke2` (ticket) y formatos `.frx`; código QR como PNG externo.

11.5 **Particularidades por tipo** [V]: 05 y 06 apuntan al documento original (§11.4); 05 solo se puede preparar **después de imprimir/aplicar** ("No ha sido aplicada, primero apliquela y luego envie el DTE"); 06 exige fecha de hoy; 11 pone `CODTRIBUTO "C3"`, precio unitario = `ROUND(subtotal/cantidad, 4)`, y para servicios deja recinto, régimen e incoterm en `null`; 14 usa un único apéndice "Sujetos Excluidos", sin NIT del cliente sino del proveedor, ítem tipo 2 y código `null`; 01 tiene el IVA incluido en el precio.
11.6 **Invalidación (`FANULAR`).** Botón "Anular F.Electro", solo si el documento ya está anulado localmente ("Debe de anular primero el Documento"), tiene número de control ("Documento no existe en factura electronica") y no se había registrado ("Documento ya fue registrado como anulado"). Escribe una fila con datos del emisor, del documento (tipo, código de generación, sello, número de control, fecha, monto de IVA), el solicitante (el cliente) y el responsable (el usuario conectado: nombre y DUI), **`tipoanula = 2` fijo**, **`motivoanul` = nombre del usuario** (no un motivo), versión `"02"` fija. `PROCESADO`/`FALLO` los llena el proceso externo (520 solicitudes: 438 CCF, 40 F, 39 N, 3 E; 505 procesadas, 20 con `FALLO = 1`). *Nueva plataforma:* motivo y tipo de invalidación elegibles; reemisión vinculada.
11.7 **Qué se verificó y qué se infiere.** *Verificado en el código y los datos:* la preparación, la ausencia de generación/firma/transmisión en INV64, los campos que escribe y los estados que dejan los datos. *Inferido:* que el proceso externo sea un único programa, que corra en el servidor, que sea síncrono o por lotes (la pantalla recarga `FELECTRO` y no espera; los datos sugieren **por lotes asíncrono**), que el PDF y el PNG los genere él. *Debe consultarse con el negocio/proveedor:* qué programa es, dónde está su configuración (URL del servicio, credenciales y certificado: **existen fuera del código, no se leyeron ni se copian**), cómo se maneja el contingente y el reintento.
11.8 *Nueva plataforma:* módulo `dte` (prefijo `dte_`): `dte_documents` (un registro por documento, no por línea), `dte_events` (emitido/invalidado/rechazado, con respuesta), la generación de JSON y el firmado detrás de una interfaz (`DteProvider`), configuración por empresa y establecimiento (códigos de establecimiento y punto de venta en tabla, **no literales**), secretos en el almacén de secretos de la plataforma, cola con reintentos y modo contingencia explícito. Importar los 11,690 documentos con DTE como histórico inmutable.

---

## 12. Documentos de inventario (entradas, salidas, transferencias)

12.1 **Encabezado `DATAMOV`** (tablas `INMMOV01` entradas/salidas, `INMMOV03` compras, `INMMOV05` transferencias) + **líneas `MOVIMIEN`** (`INMMOV02`, `INMMOV04`, `INMMOV06`). Llave del documento = tipo (E/S) + concepto + número + proveedor [V].
12.2 **Número del documento: lo digita el usuario** (texto de hasta 15, mayúsculas); no se autonumera (`CONCEPTO.GENCORRE` es falso en todas las filas). Unicidad verificada solo al entrar al encabezado ("Número de factura de Envio ya Existe..!", salta al existente) [V]. 1,442 llaves duplicadas en los datos.
12.3 **Conceptos (`CONCEPTO`, 16 filas)** [V]: código de 2 letras + `TIPO_MOV` (E/S) + nombre + banderas `COSTO` (pide costo y recalcula el promedio), `ENVIO`, `GENCORRE`, `AFEC_INV` (todas apagadas), `CTA` (cuenta contable del concepto) y `PASSWORD` (pide clave). Los conceptos presentes: inventario inicial (`II`), entrada por compra (`EC`, `CO`), venta (`SV`, salida), devolución/nota de crédito (`ED`, entrada), ajuste de inventario entrada/salida (`AI`, `EA`, `SA`), salida/entrada por cambio (`SC`, `EC` con clave), producto dañado (`PD`), muestra médica (`$M`), nota de abono (`NA`). Hay códigos **duplicados** (`SV`, `ED`, `EC`, `II` aparecen dos veces): el `SEEK` toma el primero, por lo que la fila con `PASSWORD` solo se alcanza por el buscador [V]. Solo **`II`, `EC` (la primera) y `CO`** tienen `COSTO`.
12.4 **Validaciones de líneas** (mensajes): "Articulo no Existe", "Articulo ya fue registrado", "Debe Digitar el costo", "LOTE NO EXISTE", "DEBE DIGITAR EL NUMERO DE LOTE, O LA FECHA", "No hay Suficiente Existencias!!, bodegaN=…" (error solo si `cfg_exisbo`), "Cantidad sobrepasa al saldo de la orden de compra" [V].
12.5 **Qué hace una línea al grabar** (`INMMOV02 grabar`) [V]:
1. Si es una modificación, primero revierte la línea vieja (`eliminar`) y vuelve a insertar.
2. `MOVIMIEN` (fila): modelo, fecha, tipo, concepto, documento, cantidad, bodega, grupo, subgrupo, costo, total, lote, vencimiento, `COSTO_ANT`, `EXIST_ANT`.
3. `BODMES` (por mes+producto+bodega): suma entradas/salidas y su costo; `FINAL = INICIAL + ENTRADAS − SALIDAS`, `COSTOF = COSTOI + COSTOE − COSTOS`. Si no existe la fila del mes, la crea con apertura tomada del último mes anterior.
4. `ARTICULO`: `BODEGAn` y `EXIST_ACT` ± cantidad. Si la entrada tiene `COSTO`: `COSTOANT ← COSTO_UNIT`, `CPROMANT ← COSTO_PROM`, `COSTO_UNIT ←` costo de la línea; actualiza `ULTCOMPRA/ULTPROVE/ULTPRECIO/ULTCANTID/ULTCOMP` desplazando los viejos a `PEN*`.
5. `MESES` (mes+producto): igual que `BODMES` pero total del producto; luego (§13.2) el costo promedio.
6. Lotes: `VENCE2.FIN` ± cantidad; `SALDOLO` (producto+mes+lote+bodega) entradas/salidas.
7. Orden de compra: `DPEDI.RECIBIDO` + cantidad.
12.6 **Eliminar línea o documento** (`eliminar`): resta de `BODMES`, `MESES`, `SALDOLO`, `VENCE2`, devuelve `BODEGAn`/`EXIST_ACT` y borra la fila; para una entrada con `COSTO` recalcula el promedio solo si saldo y valor son positivos; **no restaura `COSTO_UNIT`** [V]. `INMMOV04` rechaza eliminar/modificar si deja `BODMES.FINAL < 0` ("No puede eliminar, No hay suficiente existencias" / "NO PUEDE MODIFICAR NO HAY SUFICIENTE EXISTENCIA"); `INMMOV02` tiene ese control comentado [V]. La reversa se aplica al mes del documento con el promedio vigente *(inferido: puede distorsionar valores)*.
12.7 **Cerrar documento:** la casilla "Cerrar Documento" bloquea la edición ("No puede modificar, ya ha sido cerrado"), pero pide una clave que cualquier usuario puede dar ("PRIMERA CLAVE" / `clave.spr`). No hay anulación de documentos de inventario: solo editar o eliminar [V].
12.8 **Transferencias** (`INMMOV05/06`): cada línea escribe **dos filas** `MOVIMIEN` (`S` en origen y `E` en `DESTINO`, `TRANSFERIR = .T.`), con el concepto de salida elegido por el usuario (aparecen `SV`, `SA`, `SC`, `PD`, `$M` también en la pata de entrada); actualiza `BODMES` y `SALDOLO` de ambas bodegas y `BODEGAn` de ambas; **no** toca `EXIST_ACT`, costos, `MESES` ni `VENCE2`. "La bodega de origen debe ser diferente a la de destino!". Eliminar se rechaza si el saldo del destino no alcanza ("No puede eliminar, no ya suficiente existencia") [V].
12.9 **Permisos:** `INMMOV02` exige `permiag`/`permim`/`permi` ("No tiene permiso de Agregar Productos", "No tiene permisos para Crear", "No tiene permiso para modificar", "No tiene permiso para Eliminar"); `INMMOV04` solo `permiag`; `INMMOV06` ninguno. Solo `INMMOV02` escribe `BITACORA`. El cierre de mes se comprueba en agregar/modificar/eliminar de `02` y `04`; en `06` solo al eliminar ("!!Mes Cerrado!!, No Puede Eliminar") [V].
*Nueva plataforma:* un único servicio `postMovement` con las mismas reglas para todos los orígenes (documento de movimiento, venta, devolución, compra, producción), control de mes cerrado y permiso uniformes, auditoría siempre, documento **inmutable** (la corrección es un movimiento inverso), y número automático por serie.

---

## 13. Costeo, compras, importaciones y contrato con producción

13.1 **Método: promedio móvil ponderado por producto (todas las bodegas juntas)**, no PEPS ni último costo [V]. El valor y la cantidad se acumulan por mes en `MESES` (`COSTOI/E/S/F`, `INICIO/ENTRADAS/SALIDAS/FIN`); tras cada **entrada con costo** se recalcula
`COSTO_PROM = MESES.COSTOF / MESES.FIN`, solo si ambos son positivos, y se copia a `ARTICULO.COSTO_PROM` y a `MESES.COSTO_PROM`. En los datos `MESES.COSTO_PROM = COSTOF/FIN` en la última fila de cada producto [V].
13.2 **Cuándo cambia el costo** [V]:
- Cambia: entradas de conceptos con bandera `COSTO` (compra `CO`/`EC`, inventario inicial `II`) y la eliminación o modificación de esas entradas.
- **No cambia:** salidas (se valúan al promedio vigente y no lo alteran), transferencias, devoluciones de venta (`ED`), ajustes (`AI`, `EA`, `SA`), muestras, daños. Las entradas sin `COSTO` entran al promedio vigente.
- `COSTO_UNIT` es el costo neto de la última compra con costo.
13.3 **Valor de una salida/venta:** cantidad × `ARTICULO.COSTO_PROM` en el momento del registro, guardado en la línea (`COSTO_PRE`, `COSTO_PROM`, `TOTAL = ROUND(costo × cantidad, 2 ó 5)`); las bonificaciones también salen a costo. No se recalcula la venta ni el kárdex cuando después cambia el promedio… **salvo por el "Posteo" (§16.3)** que re-valúa [V].
13.4 **Existencia negativa:** permitida (solo advertencia, `cfg_exisbo = .F.`). Si el saldo es ≤ 0 el promedio no se recalcula y queda con el último valor [V]. En los datos: 0 productos con existencia negativa hoy, pero **32 productos pasan por saldo negativo en algún momento** (24 filas de `MESES` con `FIN < 0`, 159 con `COSTOF < 0`) [V].
13.5 **Compras** (`INMMOV03` encabezado + `INMMOV04` líneas): sí mueve inventario. Encabezado con datos fiscales (exenta, gravado, IVA, percepción, importación, total, "Transferir al IVA", clase de documento, tipo de operación, clasificación costo/gasto, sector, tipo de costo/gasto) y los datos del DTE recibido (leídos del JSON, §11.4). Línea: `compra`, `bonifica1`, `subtotal`, `porcen`, `descuen`; `cantidad = compra + bonifica1`; `TOTAL = SUBTOTAL − ROUND(SUBTOTAL × % / 100, 3) − DESCUEN`; `COSTO_PRE = TOTAL / CANTIDAD` (**las unidades de regalo diluyen el costo unitario**); el IVA no entra al costo [V]. El botón **"Provisionar"** (`inprovi`) crea el documento por pagar en `QUEDAN` (CONTAC) si el proveedor tiene crédito y `cfg_prove` está activo: valida "Proveedor No Existe!", "Comprobante ya existe para este proveedor!", "Fecha de Recepción no puede ser anterior a la del comprobante", "Fecha de Vencimiento no puede ser anterior a la de recepción" [V]. Con "Transferir al IVA" el documento alimenta el libro de compras de IVA64 (y ver §10.2). Enlace con CxP: por proveedor y número de comprobante (`QUEDAN`), sin llave del documento de inventario *(inferido)*. *Nueva plataforma:* la recepción de mercadería (`inventory`) y el documento de compra del proveedor (`accounts-payable`/`tax`) son dos documentos relacionados; el costo de recepción lleva el valor neto del documento.
13.6 **Importaciones/retaceo** (`retaceo.prg`, `entraped.prg`, `simped*`): reparte fletes, seguros y otros por valor FOB, luego CIF, derechos por partida arancelaria y gastos locales; costo unitario = `ROUND(costo total / recibido, 2)`. `entraped.prg` escribe las entradas pero promedia con el FOB (no con el costo puesto) y deja concepto y bodega en blanco: **parece inconcluso** (existe un `.ERR`). Todas las tablas del retaceo tienen **0 filas** en disco [V]. `inimpor` mantiene `IMPAIS` (producto × país, 0 filas). *Nueva plataforma:* no construir en el primer corte; diseñar `inv_landed_costs` si el negocio importa.
13.7 **Contrato con producción (`LOTE64`).** El spec de lotes (data-model §2) supone `ARTICULO.COSTO_PROM = BODMES.COSTOF / BODMES.FINAL`. **Corrección desde INV64:** el costo promedio de inventario es **por producto** y sale de `MESES.COSTOF / MESES.FIN` (todas las bodegas); `BODMES.COSTOF/FINAL` es el saldo valorado **por bodega**, acumulado con ese mismo promedio global, y solo coincide si el producto está en una sola bodega. Usar el cociente de `BODMES` para pisar `ARTICULO.COSTO_PROM` rompería el promedio global cuando hay existencia en varias bodegas (4 bodegas en disco). Recomendación para el contrato: `inventory.postMovements` calcula el costo promedio por producto y empresa a partir del saldo valorado del producto (suma de bodegas), y devuelve costo unitario y total a producción. Las nueve tablas que escribe producción (`MOVIMIEN` conceptos `PR`/`EP`, `DATAMOV`, `BODMES`, `ARTICULO.BODEGAn/EXIST_ACT`, `MESES`, `VENCE2`, `SALDOLO`, `DPEDI.RECIBIDO`) son exactamente las que escribe el código de INV64 en §12.5; ninguna otra. En el INV64 de este disco no hay conceptos de producción ni `LOTEPADRE`; los datos y el código de INV64 son los de un cliente de **comercio con facturación electrónica y vencimientos por lote** (no de manufactura), de la época 2017–2026 con DTE desde 2024-11.

---

## 14. Existencias: guardadas vs. calculadas

14.1 La existencia se **guarda en cinco lugares** que se actualizan a mano en cada transacción [V]: `ARTICULO.BODEGA1..15` y `EXIST_ACT` (columna de 15 bodegas), `BODMES` (por bodega y mes), `MESES` (por producto y mes), `SALDOLO` (por lote y bodega y mes) y `VENCE2.FIN` (por lote). Se pueden descuadrar entre sí si un guardado falla; `Posteo` los reconstruye desde `MOVIMIEN` (§16.3).
14.2 En los datos [V]: `EXIST_ACT` = suma de `BODEGA1..15` en los 645 productos (0 diferencias) pero difiere de la suma de `MOVIMIEN` firmado en **21 productos con vencimiento** (diferencia neta de 967 unidades); 2 modelos de `MOVIMIEN` no existen en `ARTICULO` y 109 productos no tienen movimientos.
14.3 *Nueva plataforma:* **la existencia se calcula** desde los movimientos (`inv_movements`), por producto-bodega-lote, con un caché de saldos (`inv_balances`) mantenido en la misma transacción y verificable (`rebuild`). `EXIST_ACT` y las 15 columnas de bodega desaparecen. Cantidades y costos como decimales exactos con 5 decimales (como `N13.5`/`N12.5`), totales de línea redondeados a 5 y de documento a 2.

---

## 15. Integración con el libro mayor (CONTAC)

15.1 INV64 **sí contabiliza**, por **lotes manuales por rango de fechas**, con tres procesos que escriben directo en `PARTIDAS`/`DETAPART` (y actualizan `SALDOS`/`SALDOCC`) de CONTAC con el posteador compartido `CGADIPAR.PRG` (el mismo que usan Bancos y CxC) [V]:

| Proceso | Lee | Débito / crédito (origen de la cuenta, no los códigos) |
|---|---|---|
| **Generar Partida de Ventas** (`ccpartve`) | `FACT` y `DEVOL` del rango, todos los tipos | Débito a la cuenta contable del cliente (`CCCLI01.CTA`) por total (CCF: total + IVA; F/E: total); crédito a `ARTICULO.CTAVENTA` por la base y a la cuenta de IVA débito fiscal (cuenta distinta para CCF y para F/E, de `BASE.MEM`); las devoluciones invierten. La percepción/retención de `CORFACT.IVAPER` va en una cuenta de IVA retenido contra el cliente |
| **Generar Partida de Costo** (`ccpartco`) | `FACT` (+ `DEVOL` si se marca) y `ARTICULO` | `ROUND(cantidad × FACT.COSTO_PRE, 2)`: débito `ARTICULO.CTACOSTO`, crédito `ARTICULO.CTA` (inventario); centro de costo de configuración; las viñetas (`PREVINE`) van a una cuenta adicional |
| **Generar Partida Contable** (`ccpart`) | `MOVIMIEN` del rango, entradas o salidas, por concepto | Salidas: débito `CONCEPTO.CTA`, crédito `ARTICULO.CTA`; entradas: al revés. Se salta la línea si falta cualquiera de las dos cuentas (pérdida silenciosa) |

15.2 **Tipo de partida:** lo elige el usuario del catálogo `TIPOPAR` (en los datos: tipo 07 "VENTAS O FACTURACION" con 299 partidas y 08 "COSTO DE VENTA" con 296); número propuesto o digitado ("Partida ya existe; Desea Eliminarla" la reemplaza). **El mes de la partida es el del inicio del rango**, aunque el rango abarque más de un mes. Mes cerrado en contabilidad: "Mes ya fue cerrado en contabilidad" [V].
15.3 **Vínculo documento→partida: no existe.** Ningún documento se marca como contabilizado y la partida no guarda qué documentos incluye; la única protección es reutilizar el mismo número de partida (se reemplaza). Rangos distintos que se traslapan **duplican**; huecos **omiten**. 1:1 con lo ya visto en cxc64 [V].
15.4 **Qué no se contabiliza desde aquí:** nota de débito (`C4`), flete y seguro de exportación (no están en `FACT`), sujeto excluido, compras (la provisión va a CxP/Bancos), el IVA de compras, ni los ajustes de inventario salvo vía `ccpart`; `INRNOCTA` lista productos sin cuenta de inventario o de costo, **pero no revisa `CTAVENTA`**, que `ccpartve` necesita (en disco: 645 productos, 260 sin cuenta de inventario, 261 sin cuenta de ventas, 261 sin cuenta de costo) [V].
15.5 **Dos contabilizaciones del mismo hecho** (cxc64 y INV64): ventas se contabilizan en cxc64 ("Generación de partida: ventas") y en INV64 ("Partida de ventas"); costo solo en INV64. Hay que decidir cuál sigue vigente *(pregunta abierta; los datos tienen 299 partidas de ventas y 296 de costo del lado de INV64)*.
15.6 *Nueva plataforma:* contabilización **por documento y en línea** mediante el contrato `gl.postEntry({ source, sourceRef, … })` (nuevas `source`: `ventas`, `inventario`, `costo`; hoy `GL_ENTRY_SOURCES` solo admite `manual`, `bancos`, `iva`, `cierre`, `importado`), con el enlace documento→partida guardado (`sal_document_postings`, `inv_movement_postings`), reglas de cuentas por tipo de documento/concepto/producto en tablas, y cierre diario/mensual en lote opcional que **solo toma lo no contabilizado**. Pendiente: confirmar cuál módulo contabiliza el costo cuando se pase a producción (`lote64` data-model §2).

---

## 16. Controles

16.1 **Permisos.** Menú: `PERFIL` por usuario y pantalla (`permiso`); banderas `permiag/permim/permi/permia`; `USRLVL = 1` = Supervisor (eliminar y anular factura consumidor final lo exigen: "Unicamente el Supervisor puede Eliminar/Anular"). Las banderas del usuario se leen **una vez** al iniciar sesión de `USUARIOS`, no de `PERFIL` [V]. `INMMOV06` no revisa ninguna. *Nueva plataforma:* permisos por acción (`crear`, `modificar`, `anular`, `contabilizar`, `cerrar`, `ver costos`), el usuario de cada acción siempre en bitácora. El permiso `ve_costo` de `USUARIOS` (ver costos) existe y debe conservarse.
16.2 **Cierre mensual** (`cierre1`) [V]: pide la clave de cierre ("Clave Incorrecta"), "Este mes ya fue cerrado!", confirma ("Este Proceso Actualizará saldos del Mes … Seguro de Continuar"), agrega una fila a `CIERRE`, ejecuta el posteo del mes (§16.3) y la creación de los saldos del mes siguiente (`creames`: apertura = cierre anterior), y avanza el mes de trabajo. **No exige que los meses anteriores estén cerrados.** En los datos: 164 filas de `CIERRE`, de 2010-09 a 2026-04; 24 meses dentro del rango no están cerrados; 15,831 movimientos caen en meses no cerrados dentro del rango y 708 son posteriores al último cierre.
16.3 **Posteo de movimiento** (`posteo`, sin clave; también lo ejecuta el cierre) [V]: pone en cero `BODEGA1..15` y `EXIST_ACT` de **todos** los productos; reconstruye `BODMES`/`MESES`/`SALDOLO` del mes desde `MOVIMIEN`; **re-valúa** los movimientos cuyo concepto no tiene `COSTO` (salidas, devoluciones, ajustes) con el promedio corrido (actualiza también el costo de las líneas `FACT` y `DEVOL` correspondientes); recalcula las aperturas del mes siguiente; reconstruye `VENCE2.FIN`; y deja `ARTICULO.BODEGAn` = `BODMES.FINAL` del mes posteado y `COSTO_PROM` = `MESES.COSTO_PROM`. `EXIST_ACT` queda como `BODEGA1+…+BODEGA10` (**solo 10 bodegas**; las bodegas 11–15 no suman). **Consecuencia:** el costo de ventas de una factura puede cambiar después de emitida (el reporte de costos y la partida de costo de otro día dan otro valor). Postear un mes viejo deja el stock de `ARTICULO` en el saldo de ese mes [I]. El orden del re-valuado depende del índice `POSTEO2` (no recuperado) [V].
*Nueva plataforma:* el costo de una salida **se fija al emitir y no cambia**; correcciones de costo = movimientos de ajuste explícitos; el "posteo" desaparece.
16.4 **Reabrir mes** (`inabre`) [V]: pide una clave ("DIGITE LA CLAVE", la de cualquier usuario), borra la fila de `CIERRE` ("Mes ha sido Abierto con exito"; "Mes no ha sido cerrado") y registra en `BITACORA`. No recalcula nada y cualquier mes puede reabrirse. *Nueva plataforma:* permiso `reabrir`, motivo obligatorio y bitácora, sin claves compartidas.
16.5 **Claves:** la clave de cierre está en un archivo `CLAVE.MEM`; la "clave" de pantallas especiales (`clave.spr`) compara contra las contraseñas de **cualquier** usuario; no hay registro de quién la usó [V].
16.6 **Bitácora:** solo algunas pantallas escriben `BITACORA` (artículos, `INMMOV02`, exportaciones, sujeto excluido, apertura de mes). Los documentos de venta (CCF, F) **no** auditan el usuario más allá de `CORFACT.USUARIO` [V]. 23,607 filas (23,203 borradas) en disco.
16.7 **Convenciones de anulación:** `ANULADA` booleana en encabezado, totales a 0 o conservados según la pantalla (inconsistente), líneas borradas, fila de cartera con monto 0, `FANULAR` para el DTE (§9.3, §11.6).

---

## 17. Inventario físico, kárdex y valuación

17.1 **Inventario físico** (`fisico01…04`, `infisico`) [V]: `ARTICULO.EBODE1..15` guarda el saldo congelado, `FISICO1..15` el conteo; "Inicializar" copia `BODMES.FINAL` del mes a `EBODEn` (con un error de digitación que omite `EBODE13`, y mensajes "Reconstruyendo Saldos antes de Inicializar…", "Esta seguro de Inicializar inventario fisico"); `fisico03` compara (solo bodegas 1–10). **No genera ningún movimiento de ajuste**: los ajustes se digitan a mano en `inmmov01` con `AI`/`EA`/`SA`. En disco la función casi no se usa (1 producto con conteo). *Nueva plataforma:* conteo físico por sesión y bodega con ajuste automático al aprobar.
17.2 **Kárdex** (`kardex2`) [V]: lee `MOVIMIEN` entre fechas ordenado por producto, fecha y tipo; filtro por grupo o producto y por bodega; **saldo de apertura** = fila de `MESES` (o `BODMES`) del mes más las entradas y salidas desde el día 1 hasta la fecha inicial − 1; valores = `MOVIMIEN.TOTAL` y `COSTO_PRE` como quedaron tras el posteo; saldo corrido = apertura + E − S *(inferido)*. `kardex3` (resumido) y `kardexlo` (por lote) no se leyeron a fondo.
17.3 **Valuación** (`sival01/02`) [V]: lee `MESES` (o `BODMES` por bodega) del mes elegido para productos con `INICIO + ENTRADAS − SALIDAS ≠ 0`; la valuación es `COSTOF` (saldo valorado) y el costo unitario `COSTO_PROM`. **Paridad:** la valuación y el kárdex nuevos deben cuadrar contra estos reportes; mientras el posteo re-valúe, los reportes viejos dan el costo "ajustado".

---

## 18. Reportes y consultas

Están en el menú **D- Reportes** (≈150 opciones, ver README §3). Los que alimentan libros de impuestos o conciliaciones y deben tener paridad: **corte de facturación** (`incorca`, por tipo de documento, ventas y devoluciones, por artículo o consolidado, con márgenes), **corte diario** (`incrodia`), **Cuadratura de Facturación** (`incuadre`: suma `FACT` contra `CORFACT`, advierte "FACTURA REPETIDA" en F y crea la `C0` faltante), **documentos anulados al DET** (`danulado`: rangos de correlativos emitidos y anulados por tipo de documento, con series y resoluciones de una tabla `RESOL` que no está en disco, exporta XLS y texto para Hacienda), **F983/F983V2** (no leídos), **Ventas y existencias**, **Valorización**, **Kárdex**, **Pedidos pendientes**, **Vencimientos**. *Nueva plataforma:* reportes parametrizados sobre un solo motor (agrupar por línea/vendedor/cliente/artículo/período), con exportación; no se replican los ~85 reportes de ventas uno por uno.

---

## 19. Datos sucios y discrepancias encontradas (para migración)

| # | Hallazgo | Impacto |
|---|---|---|
| 1 | **El `DATAMOV` en disco es de una versión anterior al código** (34 columnas; falta `SIIVA`, `NCONTROL`, `CODGENERA`, `SELLOR`, `CLASEDOC`, `TIPOOPE`, `CLASIFIC`, `SECTOR`, `TIPOCOSTO`, `OBSERVA`, `AREA`) | Los datos fiscales de compras no se pueden importar de aquí; pedir la copia viva (open-questions) |
| 2 | 1,442 llaves duplicadas en `DATAMOV` (tipo+concepto+número+proveedor); 174 filas sin tipo ni concepto | Llave natural no única: usar id estable y reportar |
| 3 | `CONCEPTO` con códigos repetidos (`SV`, `ED`, `EC`, `II`) | Resolver antes de importar: mapa por nombre y bandera |
| 4 | `EXIST_ACT` ≠ suma de movimientos en 21 productos con lote; 2 modelos de `MOVIMIEN` sin `ARTICULO`; 109 productos sin movimiento | Importar movimientos y recalcular; reportar diferencias |
| 5 | `TOTAL ≠ CANTIDAD × COSTO_PRE` en 64 entradas `CO` y 5 ventas | Importar tal cual |
| 6 | 127 productos con `COSTO_PROM = 0` (18 servicios); 129 con `COSTO_UNIT = 0` | Ventas a costo 0 en el histórico |
| 7 | 32 productos con saldo negativo en algún momento; 24 `MESES` con `FIN<0`; 918 `SALDOLO` con `FIN<0` | Permitir saldos históricos negativos en el importador |
| 8 | `FELECTRO` con preparaciones borradas (7,403 filas) y estados ambiguos (`FALLO=1` con `PROCESADO`) | Importar solo el último intento por documento; guardar el estado más reciente |
| 9 | `AMBIENTE` vacío en todos los DTE y `MODOOP` vacío en `EMPRESAS` | No se puede saber si fueron pruebas o producción: preguntar |
| 10 | `CORFACT` con filas sin `TIPO_MOV`/`CONCEPTO` (90 CCF) y `TIPDOC` vacío antes de 2024-11 | Asignar tipo por `TIPOFAC` |
| 11 | La nota de crédito sobre factura consumidor final suma IVA otra vez (8 filas) | Importar tal cual; marcar |
| 12 | Cierre de períodos inconsistente (24 meses sin cerrar dentro del rango, 15,831 movimientos) | No usar `CIERRE` como verdad de períodos |
| 13 | `CIERRE` empieza en 2010-09 pero los movimientos desde 2017-07 | Ignorar los meses sin movimiento |
| 14 | Datos de INV64 llegan a 2026-07; cxc64 a 2026-10 | La paridad de ventas contra CxC/IVA exige copias del mismo día |
| 15 | Texto en cp1252 (`cp=03`) en la mayoría de las tablas; algunas (`CLIENTES`, `CONTRIBU`, `DPROVI0*`, `IVAFAC/IVAFIS`, `GASTOS`, `PROYVIS`, `RENTAT`) en cp850 (`cp=00`) | Usar la detección de página de códigos del importador |

Tablas en disco que **no** son datos vivos (se ignoran): `*.BAK`, `provedorold`, `copia`, `xx`, las de `DBF/DBF`, `DBF/dbfOLD`, y en `FUENTE`: `WILDA`, `VEN*`, `VENTAS*`, `XX`, `XXX`, `ARTI`, `COR`, `PP`, etc. (copias de trabajo con datos reales).
