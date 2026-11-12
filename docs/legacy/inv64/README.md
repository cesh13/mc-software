# INV64 — Inventario, facturación y facturación electrónica (legacy spec)

Extraído del sistema MCERP (Visual FoxPro 9), carpeta `MCERP/INV64`.
Proyecto vivo: `INVENT64.PJX` (915 entradas). Menú principal: `MENUIN.MPR` (generado de `menuin.mnx`).
Target en la nueva plataforma: `inventory` (existencias, kárdex, costeo, compras de mercadería), un módulo **nuevo
`sales`** (documentos de venta), un módulo **nuevo de facturación electrónica** (`dte_`), y piezas que van a `tax`,
`accounts-receivable`, `accounts-payable`, lotes/producción (`LOTE64`) y el libro mayor.

Documentos:

- [business-rules.md](business-rules.md) — reglas de negocio extraídas del código
- [data-model.md](data-model.md) — tablas legadas, modelo propuesto (`inv_`, `sal_`, `dte_`) y notas de migración
- [open-questions.md](open-questions.md) — decisiones pendientes para el negocio

> Este spec describe *qué hace* el sistema, no copia el código. No contiene datos de clientes (solo estructura,
> conteos de registros, textos de menú y mensajes de error genéricos). No contiene credenciales ni valores de
> configuración de facturación electrónica: solo se dice que existen y dónde.
> **Marca:** lo no marcado se verificó en el código fuente o en la estructura/conteos de las tablas.
> Lo que es deducción lleva la etiqueta *(inferido)*. Nada de la normativa tributaria o del DTE se afirma de
> memoria: se describe lo que hace el código y se marca qué debe contrastarse con la regla vigente.

## 1. Qué hace el módulo

INV64 es el módulo más grande del sistema y hace **cuatro trabajos distintos** que la nueva plataforma debe separar:

1. **Inventario:** catálogo de productos (645 en disco), grupos/subgrupos (líneas), 4 bodegas, lotes con vencimiento
   (574 de 645 productos), movimientos de entrada/salida/transferencia, kárdex, valuación, inventario físico, cierre
   mensual. El costo es **promedio móvil por producto** (no por bodega).
2. **Facturación (ventas):** crédito fiscal (CCF), factura consumidor final, exportación, notas de crédito, nota de
   abono, nota de débito, sujeto excluido, pedidos/prefacturas/remisiones. **Toda la facturación con líneas de
   producto vive aquí**: cada documento escribe a la vez el encabezado (`CORFACT`/`CORDEV`), las líneas
   (`FACT`/`DEVOL`), el kárdex (`MOVIMIEN`), y la fila de cartera en `CCMOV01` (cxc64).
3. **Facturación electrónica (DTE):** desde las pantallas de factura, un botón **prepara** (no transmite) el documento en
   la tabla `FELECTRO` (una fila por línea). **Un programa externo que no está en el código fuente** firma, transmite
   y escribe de vuelta número de control, código de generación y sello; también produce el PDF/PNG. El mismo
   esquema aplica a invalidaciones (`FANULAR`).
4. **Contabilización de ventas, costo y movimientos:** tres procesos por rango de fechas (movimientos, ventas, costo
   de ventas) que escriben partidas directo en el libro mayor de CONTAC con el posteador compartido `CGADIPAR.PRG`.
   Además: compras de mercadería (con provisión a CxP vía `QUEDAN`), presupuestos/cuotas de venta, y ~180 reportes
   de ventas y existencias.

### Dónde están los datos

`access.PRG`/`selemp.PRG` hacen `SET PATH` con las rutas de `EMPRESAS` (`CAMINO` = inventario, `CXC`, `BANCOS`, `LOTE`,
`RUTAFOTO`, `RUTAINV`, `RUTAPDF` [V]). Por eso el código abre sin ruta tablas de cuatro módulos:

| Carpeta | Contiene | Ejemplos |
|---|---|---|
| `MCERP/INV64/DBF` (`CAMINO`) | Las tablas propias de inventario/facturación | `ARTICULO`, `MOVIMIEN`, `DATAMOV`, `MESES`, `BODMES`, `SALDOLO`, `CORFACT`, `FACT`, `CORDEV`, `DEVOL`, `FELECTRO`, `FANULAR`, `CORRE` |
| `MCERP/INV64/FUENTE` | Código, **y** `EMPRESAS`, `USUARIOS`, `PERFIL`, `USREMP`, `BITACORA` (sistema de usuarios compartido) | — |
| `MCERP/cxc64/DBF` (`CXC`) | Cartera | `CCMOV01`, `CCCLI01`, `CCVEND` |
| `MCERP/CONTAC/dbf` (`BANCOS`) | Libro mayor y CxP | `PARTIDAS`, `DETAPART`, `CATALOGO`, `QUEDAN`, `PROVEDOR` |

Subcarpetas `DBF/DBF` y `DBF/dbfOLD` son respaldos más viejos (DATAMOV con 23,015 y 9,054 filas): se ignoran.
Hay una sola empresa en disco. **Los datos de INV64 son de la misma época y cliente que cxc64 e IVA64**
(`FELECTRO` = 35,944 filas como cuenta IVA64; `CCMOV01` tiene 56,774 documentos `C0` contra ≈56,400 encabezados de
`CORFACT`) [V por conteos]; **no** son del cliente de `LOTE64` (el spec de lotes ya lo notó: aquí no hay conceptos de
producción ni el campo `LOTEPADRE`). Rango de datos: movimientos 2017-07 a 2026-07; DTE 2024-11 a 2026-10.

## 2. Proyecto vivo

| Proyecto | Entradas | Nota |
|---|---|---|
| `INVENT64.PJX` | **915** | **Vivo.** Superconjunto de `INVENT.PJX`. Es el que se usó. |
| `INVENT.PJX` | 884 | Versión anterior |

Conteo de `INVENT64.PJX` por tipo: **269 pantallas** (`.scx`), **244 reportes** (`.frx`), **101 programas** (`.prg`),
**229 `.spr`** (pantallas de FoxPro 2.x o *stubs* de conversión que hacen `DO FORM`), **64 imágenes/íconos**,
**3 consultas** (`partida.qpr`, `retaceo.qpr`, `vcif.qpr`), **2 menús** (`menuin.mnx`, `cuac.mnx`), 1 aplicación
(`foxypreviewer.app`, visor de impresión). Programa principal: `access.prg`. La carpeta `FUENTE` tiene 3,249 archivos;
el resto (compilados, `.BAK`, `.XLS`, `.PDF`, copias de tablas) es código muerto o respaldo. `INVE.MPR` y `CUAC.MPR`
son menús secundarios (`CUAC` = "Modificar Formatos", editor de formatos de factura).

**Importante para leer el código:** en las pantallas convertidas, el `.spr` es un *stub* **más** un bloque de
procedimientos (`grabar`, `borrar`, `anular`, `val`, `eliminar`…) que la pantalla `.scx` invoca con `DO grabar`.
La lógica de guardado está en el `.spr`; la de eventos y la del DTE, en el `.scx`. Hay copias viejas (`GRABAR.PRG`,
`BORRAR.PRG`, `.BAK`) que no son las vivas.

## 3. Mapa de menú → funcionalidad

192 opciones con acción en `MENUIN.MPR`. **187 revisan permiso en `PERFIL`** (usuario + clave de pantalla;
si falta: "Lo siento no tiene Acceso a esta opción") y llama antes a `nomoros()`; las 5 excepciones que no revisan
`PERFIL` son "Detalle del Pedido" (subpantalla), "Usuarios" (exige `USRLVL=1`), "Seleccionar Mes de Trabajo" y los dos
"Modificar Formatos" [V]. Una vez dentro, las pantallas usan las banderas del usuario: `permiag` (agregar), `permim`
(modificar), `permi` (eliminar), `permia` (anular) y `usrlvl = 1` (Supervisor) [V].

**Lectura:** *L* = leído, *P* = leído por encima (estructura/consultas, no cada rama), *N* = no leído (solo se
conoce el texto del menú y la pantalla). **Destino:** `INV` inventory · `SAL` sales · `DTE` facturación electrónica ·
`TX` tax · `AR` accounts-receivable · `AP` accounts-payable · `PROD` lotes/producción · `GL` libro mayor ·
`PL` plataforma · ❌ no migrar · 🔁 migrar rediseñado.

### A- Mantto. (20)

| Opción | Pantalla | Destino | L |
|---|---|---|---|
| A- Mantenimiento de Artículos | `inmart1` | ✅ INV — ficha de producto (ver §4) | L |
| Consultar Artículo | `inmart2` | ✅ INV (consulta) | N |
| B- Crear Grupos / C- Crear Subgrupos | `inmgp01`, `inmsub01` | ✅ INV — líneas y sublíneas (`TABLA`, `TABLA2`) | P |
| D- Crear Ubicaciones | `inmubica` | ✅ INV (opcional) | N |
| E- Crear Proveedores | `inmpro01` | 🔁 AP — proveedor único compartido con CxP | N |
| F- Tipos de Movimientos | `inmtmov1` | 🔁 INV — conceptos de movimiento (`CONCEPTO`) | L |
| G- Crear Bodegas | `inmbod1` | ✅ INV | L |
| H- Creación de Sucursales | `sbmuni02` | 🔁 PL/TX | N |
| I- Gastos | `vencos` | ❌ gastos de ventas por vendedor (comisiones) | N |
| J- Creación de Importaciones | `inimpor` | ❌ tabla `IMPAIS` (0 filas) | P |
| K- Proyección de Cobros por Línea | `ccproyco` | ❌ presupuestos | N |
| Creación de Clientes | `ccmcli01` | ✅ AR (pantalla de cxc64) | N (cxc64) |
| Creación de Vendedores / Depto. / Municipios / Países / Tipos de Negocios | `ccmvend1`, `ccmdep01`, `ccmmun01`, `ccmpais`, `ccmtneg1` | ✅ AR/TX/PL (catálogos compartidos con cxc64) | N (cxc64) |
| Actualizar Series de Documentos | `inmserie` | 🔁 SAL — series y resolución por tipo de documento | L |
| Creación de Fabricantes | `inmfabri` | ✅ INV (opcional; `FABRICAN` borrada por completo en disco) | N |

### B- Transacciones (4)

| Opción | Pantalla | Destino | L |
|---|---|---|---|
| Entradas/Salidas | `inmmov01` (+ `inmmov02` líneas) | ✅ INV — documento de movimiento | L |
| Transferencias entre bodegas | `inmmov05` (+ `inmmov06`) | ✅ INV | L |
| Compras | `inmmov03` (+ `inmmov04`) | 🔁 INV + TX + AP — recepción de compra con datos fiscales y provisión | L |
| Orden de Compra | `inmped` | 🔁 INV/AP — órdenes de compra (`PEDI`/`DPEDI`: 3 filas) | L |

### C- Facturación (24)

| Opción | Pantalla | Destino | L |
|---|---|---|---|
| Especificar Tipos de Mov. | `inmovfac` | ❌ configuración vieja de conceptos de factura | N |
| Consultar Clientes | `inconcli` | ✅ AR (consulta) | N |
| **Crédito Fiscal** | `inmfac01` | ✅ SAL — CCF, DTE 03 | L |
| **Consumidor Final** | `inmfac03` | ✅ SAL — factura, DTE 01 | L |
| **Exportaciones** | `inmexp01` | ✅ SAL — DTE 11 | L |
| **Notas de Crédito** | `inmdevol` | ✅ SAL — devolución con producto, DTE 05 | L |
| Compras a Sujetos Excluidos / Sujeto Excluido | `ivaexcl`, `ivaexcl2` | 🔁 TX/AP — DTE 14; **no está en inventario**: vive en `COMPRAS` (IVA64) | L |
| Corte de Facturación Diario | `incrodia` | ✅ SAL (reporte de corte) | P |
| Nota de Abono | `inmdevo2` | 🔁 SAL/AR — nota de crédito sin DTE (2 filas en disco: casi sin uso) | L |
| Nota de Débito | `ccmmov02` | ✅ SAL/AR — DTE 06, sin producto (8 filas) | L |
| Pedidos | `inmpedi` (+`inmpedi2…5`) | 🔁 SAL — pedido→autorización→factura (0 filas en disco) | L |
| Detalle del Pedido | `inmpedi2` | subpantalla | P |
| Egresos / Envíos | `inmenv01`, `inmenvi1` | ❌ sin uso (0 filas; `ENVIO` 11) | P |
| Ruta de Despacho | `simov1v2` | ❌ logística de reparto (como cxc64) | N |
| Generar Documentos Anulados al DET | `danulado` | 🔁 TX — rangos de correlativos emitidos/anulados para Hacienda | L |
| Actualizar No. Declaración Exportación | `inmexp02` | ✅ SAL | L |
| Nota de Remisión | `inremi01`/`inmfenv` | ❌ 0 filas (consignaciones/remisiones) | P |
| Prefactura / Generar Facturas de Prefacturas | `inmped2`, `infacecf` | ❌ 0 filas | L |
| Recibo de Documentos | `inrecdoc` | ✅ SAL (fecha de recibido) | L |
| Venta Diaria | `inrvdia` | ✅ reporte | N |

### D- Reportes (≈150 opciones, 14 submenús)

Todos son lectura; se mapean a reportes de `inventory`/`sales` (no se especifican uno por uno; ver `business-rules.md` §18).

| Grupo | Pantallas | Destino | L |
|---|---|---|---|
| A- Listados generales (4) + B- Lista de productos + Productos con datos MH | `inrgrup1`, `inrsub01`, `inrtmov`, `inrprov1`, `incat01`, `incatmh` | ✅ INV | N |
| Movimientos (7) | `inrmovi1`, `inrart01`, `siven01`, `inrmovil`, `inrmovi4`, `inrmovi2`, `inrmovi`, `inrvexis` | ✅ INV | N |
| **Kárdex (3)** | `kardex2` (E), `kardex3` (resumido), `kardexlo` (por lote) | ✅ INV | L / P / P |
| **F- Valorización de Inventarios**, W- con viñeta | `sival01`, `sival02` | ✅ INV | L / P |
| Existencias (4) | `inrbode1`, `sirexi03` (retroactiva), `inultcom`, `inexislo` | ✅ INV | N |
| Cortes (6) | `incorca` (+ Excel `incorcae`), `incorrem`, `incorcal`, `incorre2`, `incorca2` | ✅ SAL (corte de facturación; `incorca` es la base de varias conciliaciones) | P |
| J- Reporte de Advertencias | `inrexis1` | ✅ INV (mínimos) | N |
| **K- Reportes de ventas** (≈85 en 12 submenús: por línea, vendedor, cliente, artículo, anual, histórico, país, tipo de negocio, matriz, proveedor, visitador, margen, rotación, devoluciones, venta diaria, tabla por fecha XML) | `inrvenl2`, `inrmven2`, `inrvenc1`, `inrvenp1`, `lpranual`, `inrartcl`, `inrmarge`, `inrvenar`, `inrvende`, `invdia`, … | ✅ SAL (un motor de reportes con filtros; muchos son variantes del mismo) | N |
| M- Consultar No. Devoluciones, O- Análisis de Costos, T- Pedidos (2), U- Exportaciones, Z- Órdenes de compra pendientes, Vencimiento (2), Reportes para IMS, KPI de Despacho | `inrdev01`, `incosto`, `incorre`, `inrempen`, `inrexpo`, `inordcom`, `inrvence`, `inrclilo`, `inrvenc4`, `kpidespa` | ✅ INV/SAL salvo IMS y KPI (🔁 opcional) | N |

### E- Inventario Físico (5) y Retaceo (3)

| Opción | Pantalla | Destino | L |
|---|---|---|---|
| A- Listados para Inventario / B- Ingresar Inventario Físico / C- Diferencias / D- Inventario Físico / E- Inicializar | `fisico02`, `fisico01`, `fisico03`, `fisico04`, `infisico` | 🔁 INV — toma física que **sí genere el ajuste** (hoy no lo hace) | L |
| Retaceo: Partidas Arancelarias / Bancos / Pedidos | `simpdar`, `simban01`, `simped01` | 🔁 INV — costeo de importaciones (tablas con 0 filas; ver business-rules §13.6) | P |

### F- Utilerías (≈27)

| Opción | Pantalla | Destino | L |
|---|---|---|---|
| A- Reindexar Archivos | `reindex` | ❌ no aplica en SQLite | — |
| B- Cierre Mensual | `cierre1` | 🔁 INV — cierre de período con clave | L |
| C- Posteo de Movimiento | `posteo` | ❌ reconstruye existencias y re-valúa costos; en la nueva plataforma el saldo se calcula (business-rules §16.3) | L |
| D- Configurar: Sistema de Inventario / Usuarios / Integración a Otros Módulos / Firmas Orden de Compra | `config1`, `acceso`+`acceso2`, `config3`, `confirma` | 🔁 PL/INV | L / P / L / N |
| E- Activar Bodegas | `config2` | 🔁 INV | L |
| F- Seleccionar Mes de Trabajo | `siselmes` | ✅ PL | P |
| G- Abrir Mes Cerrado | `inabre` | 🔁 INV — con permiso y bitácora | L |
| H- Mantenimiento de Empresas | `sbmemp01` | ✅ PL | N |
| I- Generar Partida Contable / Generar Partida de Ventas / Generar Partida de Costo | `ccpart`, `ccpartve`, `ccpartco` | 🔁 GL — **un servicio de posteo por contrato** (business-rules §15) | L |
| Cambiar correlativos / Cambiar Serie de Correlativos | `correla` | 🔁 SAL — series | L |
| Cambiar número a un comprobante | `cambianu` | ❌ (id estable; solo con anulación + reemisión) | L |
| Cambiar clave de cierre | `cambiacl` | 🔁 PL | P |
| Artículos sin cuentas contables | `inrnocta` | ✅ INV (validación previa a contabilizar) | L |
| Actualizar Grupos | `actugrup` | ❌ utilería de datos | N |
| Generar F983 / F983V2 | `f983`, `f983v2` | 🔁 TX — archivo para Hacienda desde `FACT`/`CORFACT` | N |
| Cambiar Código a un Producto | `cambia` | ❌ id estable | L |
| Modificar Formatos (CCF, Consumidor final) | `cuac.mpr` | ❌ impresión: plantillas nuevas | — |
| Cuadratura de Facturación | `incuadre` | 🔁 SAL — verificación de consistencia | L |
| Cambiar Número de Lote a un producto | `camlote` | ❌ | N |
| Tabla de Comisiones | `inporcom` | ❌ comisiones (fuera de alcance) | N |

### G- Presupuestos (11)

Cuotas por vendedor/producto/visitador, proyecciones por línea, presupuesto global y 7 reportes comparativos
(`ppranual`, `inmproyv`, `inmprart`, `inmprevi`, `venmeta`, `inrpres1…3`, `inrpresa`, `inrpresp`, `inrprevi`).
❌ fuera del primer corte (como en cxc64). **N.**

## 4. Pantallas clave (descripción de la interfaz)

Renderizadas con `render_scx.py` (solo se leyeron las posiciones; no se vieron en navegador). Todas son formularios
FoxPro con barra de botones al pie (Anterior, Siguiente, Modificar, Eliminar, Agregar, Finalizar / Grabar, Cancelar)
y, a la derecha, botones de acción.

**`inmfac01` — Comprobante de Crédito Fiscal.** Cabecera arriba a la izquierda: Cliente (con `*` para buscar),
Vendedor, Visitador, Transporte, **F. Pago MH** (forma de pago del catálogo de Hacienda) y a la derecha Comp No.,
Fecha, Forma de pago (Crédito/Contado), Plazo, % Comisión, Flete, No. de Pedido. Debajo, **Código de generación** y
**Número de control** del DTE (solo lectura, vienen de `FELECTRO`) y No. de orden de compra. Una **línea de
captura** (Producto, Descripción, Bodega, Unidades vendidas, Unidades bonificadas, Lote, Precio unitario, SubTotal,
% de descuento) con una rejilla debajo que muestra las líneas ya capturadas. A la derecha, los totales: Exento,
Gravado, IVA, Retención, Total. Botones: Imprimir, Anular, Observaciones, "Enviar F.Electro", "Anular F.Electro",
"Ver PDF", "Ticket", "Facturar Pedidos", "Guía Urbano", Buscar.

**`inmmov01` — Transacciones de inventario (encabezado).** Movimiento (Entrada/Salida), Tipo Mov. (concepto de dos
letras), No. Doc., Fecha, Proveedor, Orden de compra, Observaciones, Req., Área, casilla *Cerrar documento*.
Mitad derecha: **bloque fiscal** (Exenta, Gravado, Percepción, IVA, Total; Código de generación, Número de control,
Sello de recepción, Tipo de documento, Tipo de operación, Clasificación, Sector, Tipo de costo/gasto,
casilla *Transferir al IVA*) y el botón **"Leer json"** (lee el JSON de un DTE de compra). El botón **"Artículos"**
abre `inmmov02`: rejilla de líneas con Código, Descripción, Bodega, Cantidad, Costo unitario, Costo total, Lote,
Vencimiento y un Total.

**`inmart1` — Ficha de producto.** Izquierda: Código, Descripción, Grupo, Proveedor, Fabricante, Referencias en
libros, Categoría del bien, Ubicación, Peso, Factor de utilidad, Existencia (solo lectura), Cód. de barras, Unidad
y unidad de medida MH, Subgrupo. Casillas: Producto exento, Tiene vencimiento, Es servicio. Centro: Costos (último
y anterior, promedio y anterior). Derecha: **Precios de venta** (Distribuidor, Público, Otro) y **con IVA**,
cuentas contables (Inventario, Ventas, Costo de venta), Avisar a / Máxima / Mínima, y la estadística de las últimas
compras (fecha, documento, cantidad, precio, proveedor).

Para la nueva UI: ver business-rules §3.8 (captura por rejilla de líneas) y §12 (documento de movimiento).

## 5. Fuera de alcance de este spec

- Los ~150 reportes `.frx`: solo se leyeron las fuentes de `kardex2` y `sival01/02`. Los demás se listan por menú.
- Presupuestos, cuotas y comisiones de vendedores; KPI de despacho; reportes "para IMS".
- Pantallas de clientes/vendedores/catálogos geográficos que son de cxc64 (ver su spec).
- El **programa externo** que transmite el DTE (no está en el código; ver business-rules §11.7).
- Cómo se corta la factura en papel/PDF (formatos `.frx` de `CCF`, `inrfac01/02`, `inrticke2`): la nueva plataforma
  rediseña la representación gráfica.
- Producción de lotes: ver `docs/legacy/lote64`. Aquí solo se describe el **contrato** (business-rules §13.7).

## 6. Qué leí y qué no

**Leído completo o casi:** `access.prg`, `selemp.prg`; el menú completo (192 opciones); `inmfac01` (SCX y `.spr`),
`inmfac03`, `inmexp01`, `inmdevol`, `inmdevo2`, `ccmmov02`, `ivaexcl`, `ivaexcl2`, `inmpedi`, `inmped`, `inmped2`,
`infacecf`, `danulado`, `incrodia`, `incuadre`, `cambianu`, `correla`, `inmserie`, `inrecdoc`, `verdte`; `inmmov01…06`,
`inmart1`, `inmbod1`, `inmtmov1`, `config1…3`, `cambia`, `fisico01…04`, `infisico`, `cierre1`, `posteo`, `posmov.prg`,
`creames.prg`, `inabre`, `retaceo.prg`, `entraped.prg`, `kardex2`, `sival01/02`; `ccpart`, `ccpartve`, `ccpartco`,
`cgadipar.prg`, `inprovi`. Las 10 tablas principales: estructura, conteos y agregados.
*(Las pantallas de ventas y contabilización las analizó un subagente con el mismo método; sus conclusiones coinciden
con mis lecturas de `inmfac01` y están marcadas igual.)*

**No leído:** los ~244 reportes `.frx` (salvo las fuentes de kárdex/valuación), los ~150 reportes de ventas por
pantalla, `inmpedi3-5`, `f983*`, `inrmarge`, los presupuestos, `kardex3`/`kardexlo` (por encima), `sival02` (por
encima), el contenido de los archivos `.MEM` distinto de `BASE.MEM` (solo nombres y valores no sensibles), y los
formatos de impresión. **No se pudo determinar:** cómo se transmite el DTE (programa externo), el índice `POSTEO2`
que ordena el re-valuado, ni los campos `AMBIENTE`/`MODOOP` (vacíos en esta copia).
