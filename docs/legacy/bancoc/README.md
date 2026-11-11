# BANCOC — Bancos y Cuentas por Pagar (legacy spec)

Extraído del sistema MCERP (Visual FoxPro 9), carpeta `MCERP/BANCOC`.
Proyecto vivo: `BANCO64.PJX` (344 entradas). Menú principal: `BAMENU.MPR` (generado de `BAMENU.MNX`).
Target en la nueva plataforma: módulo nuevo `banking` y módulo nuevo `accounts-payable`
(la lógica de CxP **sí existe** dentro de BANCOC; no hay módulo legado aparte), con piezas que van a
`tax` (IVA y renta) y a la plataforma (empresas, usuarios, bitácora).

Documentos:

- [business-rules.md](business-rules.md) — reglas de negocio extraídas del código
- [data-model.md](data-model.md) — tablas legadas, modelo propuesto (`bnk_`, `ap_`) y notas de migración
- [open-questions.md](open-questions.md) — decisiones pendientes para el negocio

> Este spec describe *qué hace* el sistema, no copia el código. No contiene datos de clientes
> (solo estructura, conteos de registros, textos de menú y lógica).
> **Marca:** lo no marcado se verificó en el código fuente o en la estructura de las tablas.
> Lo que es deducción lleva la etiqueta *(inferido)*.

## 1. Qué hace el módulo

BANCOC mezcla dos áreas que en la plataforma nueva se separan:

1. **Bancos:** catálogo de bancos y cuentas bancarias; emisión de cheques, remesas (depósitos),
   notas de cargo, notas de abono y transferencias; cada documento **genera su partida en la
   contabilidad** (CONTAC) en el mismo momento; impresión de cheques con estatus (impreso, firmado,
   entregado, cobrado); cheques postfechados; conciliación bancaria; reportes de saldos,
   disponibilidad y flujo de efectivo.
2. **Cuentas por pagar (menú "Cuentas por pagar"):** proveedores, compras al crédito (se llaman
   internamente *quedan*), notas de crédito/débito, pagos aplicados a documentos (el cheque o
   transferencia cancela facturas), cancelaciones manuales, vencimientos, antigüedad de saldos,
   estados de cuenta y la **provisión contable** de los documentos.

Los dos comparten el mismo folder de datos que CONTAC: **no existe `MCERP/BANCOC/dbf`**. Las tablas de
Bancos y CxP (`CTABANCO`, `MOVIBAN`, `DETABANK`, `QUEDAN`, `MOVQUE`, `PROVEDOR`…) viven en
`MCERP/CONTAC/dbf` junto a `PARTIDAS`, `DETAPART`, `CATALOGO`, etc. (la ruta de datos sale de
`EMPRESAS.CAMINO`). `MCERP/BANCOC/fuente` solo trae código y unas pocas tablas de trabajo.

## 2. Proyecto vivo

Hay tres proyectos en `BANCOC/fuente`. Se usó el más completo; los otros son versiones anteriores.

| Proyecto | Entradas | Forms | Programas | Reportes | Nota |
|---|---|---|---|---|---|
| `BANCO64.PJX` | **344** | 82 | 74 | 47 | **Vivo.** Es superconjunto de `BANCOS.PJX`. |
| `BANCOS.PJX` | 310 | 74 | 68 | 44 | Versión anterior (sin `cnempre`, `verche`, `vercprov`, `verdpro`, `verpa`, `vergiro`, 3 reportes de cheques/antigüedad). |
| `BANCOS2.PJX` | 251 | — | 56 | 39 | Versión más vieja (pantallas aún como `.spr`/`.s2x`). |

`BANCO64.PJX` por tipo de archivo: 82 formularios `.scx` (79 locales + 2 de `CONTAC` + 1 de `INVENT`),
77 `.spr` generados/stubs (los forms convertidos solo llaman `DO FORM`), 74 programas `.prg`
(70 locales + 4 de `CONTAC`/`INVENT`), 47 reportes `.frx`, 1 menú (`bamenu.mnx`), 60 imágenes/íconos,
1 ícono de aplicación y 1 `foxypreviewer.app` excluido. Del folder `fuente` (1301 archivos) solo
unos 280 archivos de código están en el proyecto; el resto son compilados `.fxp`, respaldos `.BAK`, temporales `PTEMP*`/`DTEMP*`,
`.ERR` y copias. Los otros 2 `.PJX` (`BANCOS`, `BANCOS2`) y los forms fuera del proyecto son código muerto.

Tablas con propiedad de Bancos/CxP: **≈17 tablas de datos** (ver [data-model.md](data-model.md)); de ellas
se usan con datos 9 (`BANCOS`, `CTABANCO`, `MOVIBAN`, `DETABANK`, `TMOV`, `COMPROB`, `PROVEDOR`,
`QUEDAN`, `MOVQUE`, `NCREDEB`, `PROVISIO`) y varias existen vacías.

## 3. Mapa de menú → funcionalidad

Hay ≈50 opciones con acción. **Cada opción revisa permiso** igual que CONTAC: abre `PERFIL` (índice
`usuario`), busca `usuario + clave del programa` y, si `permiso` es falso, muestra
"Lo siento no tiene Acceso a esta opción". Todas las opciones llaman primero a `nomoros()`, que
impide abrir otra pantalla mientras hay una tabla abierta (hay una edición en curso; si no, muestra
`simoros`). Excepciones: "Seleccionar Mes de Trabajo" y "Seleccionar Empresa" no revisan `PERFIL`;
"Usuarios" solo distingue nivel 1 (Supervisor: `acceso`) del resto (`acceso2`, cambio de clave propia).

Columna **Destino**: ✅ migrar · 🔁 migrar rediseñado · ❌ no migrar. Módulo: `banking` (BK),
`accounts-payable` (AP), `tax` (TX), plataforma (PL).

### Mantenimientos

| Opción | Pantalla | Destino |
|---|---|---|
| Bancos | `sbmban01` | ✅ BK — catálogo de bancos (código 2 car., nombre) |
| Cuentas Bancarias | `sbmcue01` | ✅ BK — cuentas, con cuenta contable, moneda, correlativo de cheque |
| Transacciones | `sbmope01` | 🔁 BK — tipos de transacción (cheque, remesa, NC, NA, transferencia, VT) con el tipo de partida y el sentido |
| Códigos de Moneda | `sbmmon01` | ❌ una moneda por empresa (decisión 13 de CONTAC); la tasa de cambio queda fuera |
| Sucursales | `sbmuni02` | 🔁 TX — `UNIDADES` solo alimenta el libro de compras (sucursal del documento); vacía en los datos |
| Seleccionar Mes de Trabajo | `sbselmes` | ✅ PL — selector de período (el de CONTAC) |
| Seleccionar Empresa de Trabajo | `selemp2` | ✅ PL — selector de empresa |

### Creación de Documentos

| Opción | Pantalla | Destino |
|---|---|---|
| Emisión de Documentos | `sbmdoc01` | ✅ BK — **pantalla principal**: cheque, remesa, NC, NA, transferencia; genera la partida |
| Partida de Remesa Concentrada | `sbreme01` | 🔁 BK — editor de partida contable (copia de la de CONTAC) que además crea movimientos bancarios; ver regla 5.7 |
| Imprimir Cheques | `sbichv01` | ✅ BK — impresión por rango de cheques (continuo o manual) |
| Imprimir Comprobantes Contables | `cgipar01` | ✅ GL — es la misma impresión de partidas de CONTAC; se reutiliza |
| Conciliación Bancaria | `sbmconci` | 🔁 BK — marca de movimientos conciliados; ver regla 8 |

### Reportes (Bancos)

| Opción | Pantalla | Destino |
|---|---|---|
| A- Listado de Cuentas Bancarias | `sblcue01` | ✅ BK |
| B- Saldos Bancarios | `sbrsal01` | ✅ BK |
| C- Libro Auxiliar de Bancos | `sblban01` | ✅ BK |
| D- Disponibilidad Diaria | `sbrdisp1` | ✅ BK |
| E- Listado de Cheques Emitidos | `sblche01` | ✅ BK |
| F- Consolidado de Movimientos | `sbrcon01` | ✅ BK |
| G- Movimientos Diarios | `sbmovd` | ✅ BK |
| H- Cheques Postfechados | `sbrpost1` | ✅ BK |
| I- Imprimir Conciliación Bancaria | `sbrconci` | ✅ BK |
| Consulta de Cheque | `sbmcon` | ✅ BK — búsqueda por nombre o número, con exportación a Excel |
| Flujo de Efectivo | `sbrflujo` | ✅ BK — movimientos por cuenta de contrapartida |

### Cuentas por pagar

| Opción | Pantalla | Destino |
|---|---|---|
| A- Mantenimiento de Proveedores | `sbmpro01` | ✅ AP |
| B- Tipos de Comprobante | `sbmcom01` | ✅ AP |
| C- Compras al Crédito | `sbmfac01` | ✅ AP — pantalla principal de CxP |
| D- Notas de Crédito / Débito | `sbmfac02` | ✅ AP |
| E- Cancelación de Comprobantes | `sbmfac03` | ✅ AP — pago manual sin cheque |
| F- Generar provisión | `qwgpro01` | ✅ AP — genera la partida de provisión (al GL) |
| G- Quedan Emitidos | `qwique01` | ✅ AP |
| H- Abonos por Períodos | `sbrdoc01` | ✅ AP |
| I- Documentos Vencidos | `qwrque03` | ✅ AP |
| J- Programación de Pagos | `qwrque04` | ✅ AP |
| K- Antigüedad por Días Vencidos | `ccranti2` | ✅ AP |
| L- Documentos Recibidos por Fechas | `sbmpag01` | ✅ AP |
| M- Antigüedad Proveedores | `ccranti1` | ✅ AP |
| N- Estado de Cuentas | `sbrest01` | ✅ AP |
| O- Histórico de Proveedor | `sbrhist1` | ✅ AP |
| P- Histórico de Documentos | `sbrhisdo` | ✅ AP |
| Q- Auxiliar de Proveedores | `sbrauxi` | ✅ AP |
| Documentos por Vencer | `qwrque05` | ✅ AP |
| Antigüedad de Saldo Retroactiva | `sbrsaldo` | ✅ AP — saldo al corte reconstruido |
| Documentos No provisionados | `qwrnpro` | ✅ AP |
| Reconstruir Saldos | (`sbrecon` comentado) | ❌ opción sin acción; los saldos se calculan |

### Utilidades

| Opción | Pantalla | Destino |
|---|---|---|
| Reindexar Archivos | `reindex` | ❌ no aplica en SQLite |
| Configurar | `config2` | ✅ configuración por empresa (tasas, cuentas contables, banderas) → `tax` + `banking` |
| Usuarios | `acceso` / `acceso2` | ✅ PL (Better Auth + roles) |
| Mantenimiento de Empresas | `sbmemp01` | ✅ PL |
| Cambiar Número a Comprobante | `sbchgnum` | ✅ BK — con bitácora; solo para documentos sin efecto cerrado |
| Cierre de Mes | (sin acción: el código está comentado) | ❌ el cierre vive en el GL (ver regla 11) |
| Bitácora del Sistema | `bitacora` | ✅ PL (`core_audit_log`) |
| Buscar / Buscar otra vez / Calculadora | (menú del sistema de FoxPro) | ❌ |

### Pantallas alcanzadas desde otras (no están en el menú)

| Pantalla | Se llama desde | Destino |
|---|---|---|
| `ivacomp2` | "Ingresar al Iva" en `sbmdoc01`; tras grabar una partida con la cuenta de IVA crédito fiscal | 🔁 TX — libro de compras (`LIBCOMP`) |
| `ivarenta` | "Ingresar Renta" en `sbmdoc01`; renta retenida de `sbmfac01` | 🔁 TX — retenciones de renta (`RENTAT`) |
| `ivmcon01` | variante de consulta del libro de IVA | 🔁 TX |
| `qwcque01`, `qwcque02` | `sbmdoc01` al elegir proveedor: selección de documentos a pagar y monto por documento | ✅ AP/BK |
| `qwprovi1` | "Provisionar Proveedor" en `sbmfac01`/`sbmfac02`: líneas contables de un documento | ✅ AP |
| `qwnombre`, `qwcanque.prg` | proveedor "solo nombre" (código con `+`); agrega/elimina pagos aplicados | ✅ AP |
| `sbchgnm2` | "Anular → copiar con nuevo número" | ✅ BK |
| `fecfirma`, `fecrecib` | casillas Firmado / Entregado del cheque (piden fecha y quién recibe) | ✅ BK |
| `verche`, `verpa`, `vercprov`, `verdpro` | botones "Partidas", búsqueda de documentos | ✅ UI |
| `cgcopipa`, `copend01`, `qwrque*`, `sbrpro01`, `sbmtran`, `sbrecon` | sin llamada desde el menú (`copend01` = cheques a contratistas, solo si `cfg_obra`) | ❌ muertas o de módulo de obras; ver preguntas |

## 4. Pantallas clave (descripción de la interfaz)

Renderizadas con `render_scx.py` (solo se leyeron las posiciones; no se vieron en navegador).
Todas son ventanas modales de ancho fijo (≈ 570 a 940 px) con fondo gris de Windows.

**`sbmdoc01` — Emisión de Documentos** (938 × 608). Es el modelo de las demás.
- **Barra superior de íconos** (de izquierda a derecha, en el mismo estilo de CONTAC): Agregar, Buscar,
  Eliminar, Modificar, Anterior, Siguiente, Finalizar, Anular; luego Grabar, Cancelar, Imprimir,
  Ingresar al Iva, Ingresar Renta y, a la derecha, Partidas (ver la partida contable).
- **Encabezado en dos columnas.** Izquierda: Operación (tipo de transacción), Cuenta Bancaria (con
  nombre del banco), "A nombre de" (o "Concepto" si no es cheque), Partida Contable y Concepto
  Contable General. Derecha: Número de Cheque o Remesa, Fecha, Postfechado para, Proveedor, Monto, Tipo
  de Cambio (solo moneda distinta a la base).
- **Línea de captura contable** (Cuenta, C.C., Concepto, Cargo, Abono) sobre un **grid de 5 columnas**
  con las líneas de la partida; las de la cuenta bancaria y las de impuestos salen solas.
- **Pie:** TOTALES de cargos y abonos y "Diferencia"; a la izquierda "Estatus del Cheque" con cuatro
  casillas (Impreso, Firmado, Entregado, Cobrado) y a la derecha la casilla "Calcular Impuesto LIOF".
- El título de la ventana muestra la empresa y el mes de trabajo.

**`sbmfac01` — Compras al Crédito** (884 × 612). Barra: Anterior, Siguiente, Modificar, Eliminar,
Agregar, Finalizar, Grabar, Ignorar, Ver Doc., Leer json (lee el documento tributario electrónico).
Bloque izquierdo de datos del documento (proveedor, tipo, número, resolución, serie, correlativo interno,
fechas de documento/recibido/vencimiento, orden de compra, moneda, quedan, sucursal, combos de
tipo de operación, clasificación, sector y tipo de costo/gasto para el libro de compras). Bloque central de
**montos** apilados: Afecta, Exenta, Iva, Iva Retenido, Iva Percibido, Renta, Otro Cargo, Total, Abono,
Saldo. Columna derecha de **botones de acción**: Provisionar Proveedor, Imprimir Quedan, Ver Pagos,
Buscar Cargos, Imprimir Retención; casillas "Transferir al Iva", "Es compra", "Documento Provisionado".

**`sbmcue01` — Cuentas Bancarias** (567 × 428). Barra: Anterior, Siguiente, Modificar, Eliminar, Agregar,
Finalizar, Grabar, Cancelar, Buscar. Campos: Banco, No. cuenta de banco, Descripción, Tipo de cuenta,
Moneda, Tasa de cambio, Cuenta Contable (con su nombre), fecha de apertura, vencimiento y tasa de
interés (solo a plazo), Saldo Inicial y su fecha, Correlativo de Cheque, Formato de Cheque, casilla
"Cuenta Exenta" (de LIOF).

**`sbmconci` — Conciliación Bancaria** (812 × 551). Arriba: cuenta, mes conciliado y casilla "Conciliar
Todo". Un **grid ancho de 7 columnas** (Fecha, Tipo, Num.Part, Num.Doc, A Nombre, Concepto, Monto) con
una casilla por fila; abajo Buscar, Finalizar, Grabar, Cancelar.

Familiaridad para la nueva UI: barra de íconos en el mismo orden, encabezado + grid de líneas contables,
barra TOTALES/Diferencia, y los estatus del cheque como casillas bajo el grid.

## 5. Fuera de alcance de este spec

- Extraer el detalle de los 47 reportes `.frx` (solo se leyó lo necesario: los tramos de antigüedad).
- Emisión de documentos tributarios electrónicos: `sbmfac01` solo **lee** el JSON de un DTE.
- Cheques a contratistas / control de obra (`cfg_obra`, tablas `CONTRAT`, `CHEQUE`): no hay datos y el
  flag está apagado; ver preguntas.
- Formatos de impresión de cheques y de quedan (`FORMACHK`, `cfg_formaq`): dependen del cliente.
- El libro de compras y las retenciones de renta como módulo propio (`tax`): aquí solo se documenta la
  interfaz con Bancos/CxP. Sus tablas (`LIBCOMP`, `RENTAT`) pertenecen al módulo IVA.
- Multimoneda: el legado maneja 5 códigos de moneda por cuenta, la plataforma una por empresa.
