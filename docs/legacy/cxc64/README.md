# cxc64 — Cuentas por Cobrar (legacy spec)

Extraído del sistema MCERP (Visual FoxPro 9), carpeta `MCERP/cxc64`.
Proyecto vivo: `cxc64.pjx` (500 entradas). Menú principal: `MENU.MPR` (generado de `menu.mnx`).
Target en la nueva plataforma: módulo `accounts-receivable` (ya existe un scaffold vacío), con piezas que van a
`tax` (catálogos y libros de IVA de ventas), `banking` (depósitos de lo cobrado), `inventory` (la factura con líneas de
producto) y la plataforma (empresas, usuarios, bitácora).

Documentos:

- [business-rules.md](business-rules.md) — reglas de negocio extraídas del código
- [data-model.md](data-model.md) — tablas legadas, modelo propuesto (`ar_`) y notas de migración
- [open-questions.md](open-questions.md) — decisiones pendientes para el negocio

> Este spec describe *qué hace* el sistema, no copia el código. No contiene datos de clientes
> (solo estructura, conteos de registros, textos de menú y lógica).
> **Marca:** lo no marcado se verificó en el código fuente o en la estructura/conteos de las tablas.
> Lo que es deducción lleva la etiqueta *(inferido)*.

## 1. Qué hace el módulo

Cuentas por cobrar de una empresa que **vende a crédito con vendedores, rutas de cobro y repartidores**. El módulo
es mucho más grande que su espejo de pagar (BANCOC): 156 pantallas y 107 reportes. Hace seis cosas:

1. **Clientes** (crédito, plazo, vendedor, clasificación, datos tributarios, casa matriz) y catálogos de apoyo
   (vendedores, tipos de negocio, bancos de los clientes, departamentos/municipios, visitadores…).
2. **Libro de movimientos de cartera** (`CCMOV01`): *una sola tabla* guarda las facturas (cargos), las notas de
   débito, las notas de crédito, los abonos (recibos), los cheques postfechados y rechazados y las remesas. Los
   tipos (`CTMOV`) se llaman **C0** factura, **C4** nota de débito, **A0** abono, **A1/A3/A6** notas de crédito,
   **A4** remesa de cheque, **A5/A7/A8** abonos internos, **C2/C3** cheque rechazado/postfechado, **C6** cargo
   interno, **PA** pago anticipado (ver business-rules §2).
3. **Cobranza operativa:** rutas de despacho de repartidores, rutas de cobro de vendedores (manuales y
   automáticas), **liquidaciones** de vendedor/transportista. **Los abonos entran por la liquidación**: 57,158 de los
   57,183 abonos del disco cuelgan de una liquidación (la pantalla suelta "Notas de Abono" casi no se usa).
4. **Reportes de cartera:** antigüedad de saldos (7 pantallas, hasta 8 modos en una de ellas), estados de cuenta, auxiliares, históricos,
   cheques postfechados, notas no aplicadas, límites de crédito, ventas/cobros por vendedor, KPI.
5. **Comisiones y presupuestos de ventas y cobros** de vendedores (con deducciones tipo planilla: ISSS, AFP,
   renta). Es una función de remuneración de vendedores, no de cobranza.
6. **Generación de partidas contables**: cinco procesos por lotes (ventas, devoluciones, notas de abono,
   abonos, remesas) que escriben **directo en `PARTIDAS`/`DETAPART`/`SALDOS`/`SALDOCC` del libro mayor** con el mismo
   posteador que usa Bancos (`CGADIPAR.PRG`). Ver business-rules §10.

**La facturación con líneas de producto no vive aquí: vive en inventario (`INV64`).** Las pantallas de factura de
inventario (`INMFAC01`, `INMEXP01`, `INMDEVOL`) escriben ellas mismas la fila `C0` en `CCMOV01` (monto, IVA,
exento, gravado, retención, plazo, vendedor, serie/resolución). La pantalla de CxC "Creación de
Facturas/comprobantes" (`ccmmov01`) es una captura manual del encabezado para documentos que no pasan por
inventario (ver business-rules §3).

### Dónde están los datos (tres carpetas)

`selemp.PRG` hace `SET PATH TO <datos CxC>;<datos CONTAC>;<datos INV64>` con las rutas `CAMINO`, `CAMINO2` y
`CAMINOINV` de `EMPRESAS` [V]. Por eso el código abre tablas "sin ruta" que están en otro módulo:

| Carpeta | Contiene | Ejemplos |
|---|---|---|
| `MCERP/cxc64/DBF` (`CAMINO`) | Las tablas propias de CxC | `CCMOV01`, `CCCLI01`, `CCTMOV`, `CCVEND`, `LIQUIDA`, `COBRO`, `DETACOB`, `DESPACHO`, `DETADES`, `CIERREC` |
| `MCERP/CONTAC/dbf` (`CAMINO2`) | El libro mayor y el catálogo contable | `PARTIDAS`, `DETAPART`, `CATALOGO`, `TIPOPAR`, `SALDOS`, `SALDOCC`, `CTABANCO` |
| `MCERP/INV64/DBF` (`CAMINOINV`) | Inventario y facturación | `FACT`, `CORFACT`, `DEVOL`, `CORDEV`, `FORMPAGO`, `FELECTRO` |

`MCERP/cxc64/FUENTE` trae el código y muchas tablas de trabajo/copias (`CAL`, `LORENA`, `REVISA`, `VALIDA`, `WILDA`,
`TABLAX`… son copias de `CCMOV01` con datos reales; ver data-model §1.4). **La empresa que hay en disco sí usa el
módulo** y a fondo: 56,774 facturas, 57,183 abonos, 1,792 clientes, movimientos de 2017 a octubre de 2026 (ver
data-model). No hay empresas adicionales en `EMPRESAS` (1 vigente, 1 borrada).

## 2. Proyecto vivo

Hay dos proyectos en `cxc64/FUENTE`. Se usó el más completo.

| Proyecto | Entradas | Forms | Spr | Programas | Reportes | Menús | Imágenes | Nota |
|---|---|---|---|---|---|---|---|---|
| `cxc64.pjx` | **500** | 156 | 123 | 57 | 107 | 1 (`menu.mnx`) | 53 + 1 ícono | **Vivo.** Superconjunto de `cxc.pjx`. |
| `cxc.pjx` | 481 | 149 | 123 | 52 | 100 | 1 | 53 | Versión anterior: le faltan `cancela`, `ccpagoco`, `ccrclide`, `ccrclimh`, `cctanti`, `idbuscal`, `idbuscar` y 7 reportes/5 programas. |

Los 156 formularios incluyen 117 alcanzados desde el menú; los otros 39 son subpantallas (`ccmliqv2`,
`ccpnc`, `ccmcli02`, `estado`…), buscadores o reportes de uso indirecto. El proyecto referencia además un reporte
de inventario (`..\..\invent\fue64new\invccost.frx`) y `foxypreviewer.app` (visor de impresión). Programa
principal: `access.prg` (carga configuración `.MEM`, empresa, usuario).
Del folder `FUENTE` (1,426 archivos) solo unos 443 son código incluido en el proyecto (156 forms + 57 programas + 107
reportes + 123 `.spr`); el resto son compilados `.fxp`, respaldos, temporales y copias. Todo lo que no está en el
proyecto es código muerto (ej.: `ccmcli03` y `ccmcli05`, esta última una variante de la ficha de cliente que el menú tiene
comentada). `ccmcob1` y `simov1` sí están en el proyecto pero ningún menú las llama (versiones anteriores de las
rutas, reemplazadas por `ccmcob1v2` y `simov1V2`).

## 3. Mapa de menú → funcionalidad

118 opciones con acción: 116 revisan permiso en `PERFIL` (usuario + clave de la pantalla; si falta, "Lo siento no
tiene acceso") y llaman antes a `nomoros()` (no abre otra pantalla si hay una tabla abierta). **Dos opciones no revisan
permiso**: "Ventas y Bancos" y "Ventas e Ingresos" (se abren con `DO FORM` directo). Las pantallas, una vez abiertas,
usan cinco banderas de `PERFIL`: `permiso` (abrir), `permiag` (agregar), `permim` (modificar), `permi` (eliminar),
`permia` (anular) [V].

Columna **Destino**: ✅ migrar · 🔁 migrar rediseñado · ❌ no migrar. Módulo: `accounts-receivable` (AR), `tax` (TX),
`banking` (BK), `inventory` (INV), plataforma (PL), GL = libro mayor, `commissions` = módulo futuro opcional.

### Archivos (18)

| Opción | Pantalla | Destino |
|---|---|---|
| A- Tipos de Movimientos | `ccmtmov1` | 🔁 AR — tipos de documento **con las cuentas contables** de cada tipo (es la tabla que gobierna el posteo; ver business-rules §10) |
| B- Clientes | `ccmcli01` (+ `ccmcli02` condiciones de crédito, `estado` movimiento del crédito, `ccmcli04` referencias) | ✅ AR |
| C- Vendedores | `ccmvend1` | ✅ AR |
| D- Transportistas / E- Vehículos / F- Ayudantes | `ccmtran1`, `ccmveh01`, `ccmayu01` | ❌ AR — logística de reparto; si se necesita, módulo de distribución (pregunta 4) |
| G- Tipos de Negocios | `ccmtneg1` | ✅ AR |
| H- Bancos | `ccmbanco` | 🔁 AR/BK — catálogo de bancos de los cheques de clientes (26); unificar con `bnk_banks` |
| I- Departamentos / J- Municipios | `ccmdep01`, `ccmmun01` | 🔁 TX/PL — catálogos geográficos tributarios compartidos |
| K- Establecer % Comisión / L- Tabla de Renta / M- Tabla de ISSS / N- Especificaciones de Comisiones | `cxccomi`, `cxcmren1`, `cxcdescu`, `rcobros` | ❌ fuera de CxC (comisiones de vendedores; pregunta 7) |
| O- Creación de Matriz | `ccmmatri` | ✅ AR — "casa matriz": agrupa clientes de una cadena (pago y notas cruzadas) |
| P- Crear Países | `ccmpais` | 🔁 TX/PL — catálogo compartido |
| Q- Crear Visitadores | `ccmvisi` | 🔁 AR — opcional (visitadores; solo para KPI/presupuesto) |
| Crear Sucursales | `ccmsuc01` | 🔁 AR/TX — sucursal del cliente (código de establecimiento del documento tributario) |

### Movimientos (20)

| Opción | Pantalla | Destino |
|---|---|---|
| A- Creación de Facturas/comprobantes | `ccmmov01` | 🔁 AR — captura manual de factura/CCF/exportación sin inventario; las facturas de inventario llegan por API |
| B- Notas de Débito | `ccmmov02` | ✅ AR |
| C- Notas de Crédito | `ccmmov03` | ✅ AR |
| D- Notas de Abono | `ccabono` | 🔁 AR — recibo de cobro (se unifica con la liquidación) |
| E- Abonos Internos | `ccmmov06` | ✅ AR — ajustes/retenciones aplicadas sin efectivo |
| F- Cargos por cheques | `ccmmov04` | ✅ AR — cheque rechazado o postfechado |
| G- Cargos Internos | `ccmmov09` | ✅ AR |
| H- Remesas por Cheques | `ccmmov05` | 🔁 AR + BK — depósito de cheques postfechados |
| I- Pagos Anticipados | `ccmpant1` | 🔁 AR — anticipos (0 registros; ver pregunta 18) |
| J- Ruta de Despacho Transp. | `simov1V2` | ❌ logística de reparto (pregunta 4) |
| K- Liquidación Transportistas | `ccmliq02` → `ccmliq03` | 🔁 AR — liquidación de cobros de repartidor |
| L- Ruta de cobro Vendedores | `ccmcob1v2` | 🔁 AR — lista de documentos a cobrar por vendedor/ruta (no es contable) |
| M- Liquidación de Vendedores | `ccmliqve` → `ccmliqV2` | ✅ AR — **pantalla principal de cobranza**: aquí se capturan los abonos |
| N- Ruta Automática de Cobros | `ccraut1` | 🔁 AR — genera la ruta de cobro por semana/día del cliente |
| O- Mover Nota de Crédito | `ccmueve` | 🔁 AR — reasignar una NC a otra factura |
| P- Liberar Nota de Crédito | `ccdesap` | 🔁 AR — deshacer la aplicación de una NC |
| Q- Asignar Quedan | `ccmmovqu` | 🔁 AR — fecha de "quedan" de la factura (1 registro con dato) |
| Aplicar Notas de Crédito | `ccaplinc` → `ccpnc` | ✅ AR — parte una NC sin aplicar entre varias facturas |
| Modificar Vendedor a un Documento | `ccmcamv` | 🔁 AR — con bitácora y permiso |
| Cancelar Ventas de Contado | `cancela` | 🔁 AR — genera el abono en efectivo de las facturas de contado |

### Reportes (53 opciones en 11 submenús)

| Grupo | Opciones (pantallas) | Destino |
|---|---|---|
| Listados de clientes (4) + A-Listado + B-Listados Generales | `ccrcli01`, `ccrkpi`, `ccrcli06` (sin movimiento), `ccrclimh` (campos MH), `ccrlis01` | ✅ AR (KPI de creación 🔁/❌) |
| **Antigüedades (7)** | `ccranti2` (C: por saldos), `ccanti` (D: por días vencidos), `ccranti4` (más de 180 días), `ccrnego` (por tipo de negocio), `ccanti2` (R: saldo general), `ccantlen` (línea de negocio), `cctanti` (tabla de vencimientos) | ✅ AR — un solo motor con parámetros (corte, base fecha doc./vencimiento, agrupar por vendedor/cliente/negocio) |
| Estados de cuenta (2) | `ccrestc1` (por cliente), `ccrestsu` (por casa matriz) | ✅ AR |
| Movimientos (6) | `ccrmov01`, `ccrcocli`, `ccrmov02`, `ccrmov03`, `ccrmovbi`, `ccrmovta` | ✅ AR (consulta de movimientos); `ccrmovta` ❌ |
| Históricos (4) | `ccrhist1` documentos, `ccrhistc` cliente, `ccrhisch` cheque, `ccrabono` cobros | ✅ AR |
| Auxiliares (2) | `ccrauxi` clientes, `ccrauch` cheques | ✅ AR |
| Cortes (2) | `ccrchep3` cheques postfechados, `ccrcaja1` **corte de caja** | ✅ AR/BK |
| Ventas (3 + 2 sin permiso) | `ccrvenco`, `ccrcob01` (ventas de crédito), `ccrvenve`; `rventaybancosV2` ("Ventas y Bancos"), `rvencobro` ("Ventas e Ingresos") | ✅ AR; las dos últimas cruzan ventas con depósitos del banco (ver business-rules §11) |
| Notas de crédito (2) | `ccrnoap` no aplicadas, `ccrapli` aplicadas | ✅ AR |
| Cobros y comisiones (11) | `ccrcon01`, `calcomib`, `ccrcobve`, `pcobros`, `ccrmov04`, `ccrabon`, `calcomi2`, `calcomi1`, `ccrmovla`, `ccrablab`, `ccpagoco` | cobros ✅ AR (`ccrcon01`, `ccrcobve`, `pcobros`, `ccrmov04`, `ccrabon`); "lavado de dinero" (`ccrmovla`, `ccrablab`) 🔁 AR (reporte de cobros en efectivo por rango; ver pregunta 20); comisiones (`calcomi1/2/b`, `ccpagoco`) ❌ (pregunta 7) |
| Otros | `ccrpant1` (anticipos), `ccrchep2` (H: cheques postfechados), `ccvisita` (visitas), `ccrhisnc` (L: consultar NC/abono), `ccrdest1` (despachos), `ccrlimit` (**límites de crédito y saldos**), `ccvence` (Z: vencimientos), `ccrhistd` (estado del documento), `ccrdoc` (bitácora de salida de documentos) | ✅ AR salvo `ccrdest1`/`ccvisita` ❌ |

### Utilidades (17)

| Opción | Pantalla | Destino |
|---|---|---|
| A Seleccionar Mes de Trabajo | `cgselmes` | ✅ PL |
| B Configuración → Iva / Usuarios / Débito Fiscal | `ccmiva`, `acceso`/`acceso2`, `config2` | 🔁 TX (tasa de IVA) · PL (usuarios) · AR/TX (cuentas y retención; business-rules §4 y §10) |
| C Reindexar Archivos | `reindex` | ❌ no aplica en SQLite |
| D **Posteo de Abonos** | `ccpost01` | ❌ reconstruye saldos de documento y estadísticas; los saldos se calculan (business-rules §6) |
| E **Generación de Partida** → Ventas / Devoluciones / Notas de Abonos / Abonos-Clientes / Remesas | `ccpart`, `ccpartde`, `ccpartna`, `ccpartab`, `ccpartre` | 🔁 AR → GL — un solo servicio de posteo (business-rules §10) |
| N Creación de empresas | `sbmemp01` | ✅ PL |
| O Cerrar Mes / P Abrir Mes Cerrado | `cierre1`, `inabre` | 🔁 AR — cierre propio de cartera (con clave); ver business-rules §12 |
| Cambiar Código a un Cliente | `camcli01` | 🔁 AR — con bitácora; el id estable evita el recorrido de tablas |
| Mover Documento de un Cliente a Otro | `camdoc01` | 🔁 AR — con permiso supervisor y bitácora |
| Cambiar Cartera de un Vendedor a Otro | `camven01` | 🔁 AR |
| Buscar / Buscar otra vez / Cambiar ventana | (menú del sistema FoxPro) | ❌ |

### Presupuestos (8)

`ccmpvend`, `ccmpclie`, `ccpcobro`, `ccpcobrc`, `ccrcobro`, `capeicli`, `ccmvicli`, `kpivenvi` — presupuesto de ventas y de
cobros por vendedor/cliente/visitador y sus KPI. Tablas `PVENDE` (118) y `PCLIENTE` (7,122). ❌ fuera del primer corte
(pregunta 8).

### Pantallas alcanzadas desde otras (no están en el menú)

| Pantalla | Se llama desde | Destino |
|---|---|---|
| `ccmliqV2` (detalle de liquidación) | "Liquidación de Vendedores" | ✅ AR |
| `ccmliq03` | "Liquidación Transportistas" | 🔁 AR |
| `ccpnc` | "Aplicar Notas de Crédito" | ✅ AR |
| `ccmcli02`, `ccmcli04`, `estado` | botones de la ficha del cliente | ✅ AR |
| `ccmcli03`, `ccmcli05` (fuera del proyecto); `ccmcob1`, `simov1` (en el proyecto, sin llamada desde el menú) | variantes antiguas | ❌ muertas |
| `idbuscal`, `idbuscar`, `ver*.prg` | buscadores ("*" en un campo) | ✅ UI |
| `pasg` | pide la clave para cerrar el mes | ✅ AR |

## 4. Pantallas clave (descripción de la interfaz)

Renderizadas con `render_scx.py` (solo se leyeron las posiciones; no se vieron en navegador). Todas son ventanas
modales de ancho fijo con fondo gris de Windows, barra de íconos arriba y campos a la izquierda.

**`ccmcli01` — Creación de Clientes** (939 × 583). **Barra de íconos** (como CONTAC): Anterior, Siguiente,
Modificar, Eliminar, Agregar, Finalizar, Grabar, Cancelar, Buscar, y a la derecha las fichas imprimibles ("Ficha
Cliente", "Ficha Todos", "Ficha Vacía", "Último Cliente"). **Columna izquierda:** Código, Razón Social, Nombre
Comercial, Contacto, Dirección, Dirección de entrega, Día y hora de recibido, Ciudad, País, Casa Matriz, Visitador,
Vendedor, Cuenta Contable, Límite del Crédito, Plazo, Lista de Precio, Actividad Económica, Correo; **columna
central:** País MH, Departamento, Municipio, Distrito, Tipo de Negocio, Tipo de Persona (Natural/Jurídica), Especialidad,
Forma de pago MH; **columna derecha:** Fax, Teléfono, No. Registro, NIT, DUI, Pasaporte, otro documento, Giro, Código de
sucursal, Código de médico y las casillas **Cliente Exento, Gran contribuyente, Inactivo, Cliente de Contado, Suspendido**.
Abajo, tres botones grandes: "Condiciones del Crédito", "Movimiento del Crédito", "Referencias Comerciales".

**`ccmmov01` — Creación de Facturas/comprobantes** (741 × 531). Barra superior: Anterior, Siguiente, Modificar,
Eliminar, Agregar, Finalizar, Grabar, Cancelar, Buscar, **Ver abonos**. Bloque de datos: Documento, C/F/E, Fecha,
Plazo, Vencimiento (calculado); bloque de montos: Gravado, IVA, Retención, Exento, **Monto Total** y, a la derecha,
Cargos, Abonos y Saldo; abajo Cliente, Vendedor y Concepto. Es la pantalla más simple y muestra el modelo: un
documento = una línea de totales, sin detalle de productos.

**`ccabono` — Notas de Abonos** (593 × 409) y **`ccmliqV2` — detalle de liquidación** (893 × 706): son el mismo
formulario de recibo. Campos en orden: No. N/A, Fecha, **Tipo Doc (C/F/E)**, **Mov.** (C0/C2/C3), **Aplicado a**
(número de documento), Cliente, Vendedor, Saldo del documento, **Forma de pago** (EF efectivo, CH cheque, DE
depósito), Banco, No. Cheque, **Post-fechado para**, **En poder de**, **Valor del Abono**, **% de Comisión**,
**Días transcurridos** (desde la factura) y la casilla "Es Transferencia". La liquidación suma arriba: Vendedor,
Fecha, **No. de liquidación**, **Remesa** y **Cuenta** bancaria. Se captura **un abono por documento pagado**.

**`ccpnc` — Aplicar Notas de Crédito** (753 × 512). Izquierda los datos de la NC (documento, tipo, monto, cliente,
casa matriz); a la derecha un grid con una fila por documento destino (tipo mov., C/F/E, documento, monto a aplicar)
y abajo "Monto Aplicado" y "Pendiente de Aplicar" con los botones Aplicar y Salir.

**`ccpart`** (412 × 285). Cuatro campos: periodo Del/Al, Tipo de partida (se elige con "*" de la lista de tipos),
Núm. (se propone el siguiente), Concepto general; botones Proceder/Ignorar. Las otras cuatro generaciones son iguales.

Familiaridad para la nueva UI: barra de íconos en el mismo orden; la ficha del cliente en tres columnas con los
tres botones de crédito; el recibo como grid de "abono por documento" dentro de la liquidación.

## 5. Fuera de alcance de este spec

- Extraer el detalle de los 107 reportes `.frx` (solo se leyeron las expresiones de la antigüedad de saldos).
- La **facturación con líneas de producto, el DTE y la anulación de facturas** viven en inventario (`INV64`):
  aquí solo se documenta lo que escriben en `CCMOV01` y lo que CxC exige (business-rules §3).
- Rutas de despacho, transportistas, vehículos, ayudantes (logística de reparto) y rutas de cobro: se describen
  porque tocan los abonos (`FLIQUI`), pero no se especifican como módulo.
- Comisiones de vendedores y sus tablas de renta/ISSS/AFP (parecen copiadas de la planilla), y presupuestos/KPI.
- El libro de IVA de ventas (`tax`): solo la interfaz (business-rules §11).
