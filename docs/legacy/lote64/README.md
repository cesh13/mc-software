# LOTE64 — Lotes / fórmulas / despachos (legacy spec)

Extraído del sistema MCERP (Visual FoxPro 9), carpeta `MCERP/LOTE64`.
Proyecto vivo: `lote.pjx` (203 entradas). Menú principal: `LPMENU.MPR` (generado de `lpmenu.mnx`).
Target en la nueva plataforma: **módulo nuevo `production`** (fórmulas y órdenes de producción), que **no escribe**
en las tablas de inventario ni del libro mayor: pide los movimientos de existencias a `inventory` y publica la partida
de costos al libro mayor mediante contratos (ver [data-model.md](data-model.md) §2). Piezas que van a la plataforma:
empresas, usuarios, permisos, mes de trabajo.

Documentos:

- [business-rules.md](business-rules.md) — reglas de negocio extraídas del código
- [data-model.md](data-model.md) — tablas legadas, modelo propuesto (`prod_`) y notas de migración
- [open-questions.md](open-questions.md) — decisiones pendientes para el negocio

> Este spec describe *qué hace* el sistema, no copia el código. No contiene datos de clientes
> (solo estructura, conteos de registros, textos de menú y lógica). **No se transcribe ninguna fórmula real**
> (ingredientes y proporciones son secreto industrial): solo la estructura.
> **Marca:** **[V]** verificado en el código fuente, **[D]** verificado en los datos (estructura/conteos),
> **[I]** inferido (deducción mía, sin confirmar).

## 1. Qué hace el módulo y para qué negocio

**Producción por órdenes con fórmula y costeo real**, para una empresa que **fabrica o empaca/termina productos a
partir de materia prima y material de empaque** (y a veces manda la transformación a un maquilador externo). Tres
nociones, que el código nombra distinto a como se usarían en una planta [V][I]:

| Término del sistema | Qué es realmente | Confianza |
|---|---|---|
| **Lote** (`LOTE`, tabla `lote`) | La **orden de producción**: una corrida de un producto, con cantidad programada y fabricada, fecha, responsable, turno, estatus, costos. La pantalla se llama "Ordenes de Produccion" y los reportes "Ordenes de Produccion"; en el código "lote" y "orden" se usan como sinónimos. El número de lote lo digita el usuario (convención de letras + dígitos). **No** es un lote de compra ni de ganado. | Alta [V] |
| **Fórmula** (`formula`/`detaform`) | La **receta (lista de materiales)**: para fabricar `PROGRAMA` unidades del producto se consumen estas cantidades de cada materia prima (`MP`) o material de empaque (`ME`), más tarifas de mano de obra (`MOD`) e indirectos (`IND` %). Una fórmula por producto; **sin versiones**. | Alta [V] |
| **Despacho** (`despacho`/`detadesp`) | Un **vale de envío ("ruta") que agrupa órdenes de producción** que salen de planta hacia bodega (el reporte se titula "ENVIO DE LOTES DE PRODUCCION A BODEGA"). Es un control en papel: **no mueve existencias, no costea y no se liga a facturas ni a rutas de reparto**. 1 sola fila en disco. | Media-alta [V] |

**Qué hace al "procesar" una orden** [V]: descuenta del inventario cada insumo (a su costo promedio del momento),
da entrada al producto terminado con el costo real de la orden (materiales + mano de obra + maquila + indirectos
+ viñeta/etiqueta), y le recalcula el costo promedio al producto. Escribe **directamente** en las tablas de inventario
de `INV64` (`ARTICULO`, `BODMES`, `MESES`, `MOVIMIEN`, `DATAMOV`, `VENCE2`, `SALDOLO`, `DPEDI`). Puede además generar
**una partida contable resumen por rango de fechas** (menú "Generar Partida Contable") que escribe directo en el libro
mayor de CONTAC.

**Qué tipo de negocio** [I]: manufactura ligera / empaque con maquila. Indicios en el código y la estructura:
catálogos de actividades `LLENADO / PESADO / ETIQUETADO`, máquinas `LLENADORA / ETIQUETADORA`, campos `FFARMA`
(forma farmacéutica) y `PRESENTA`, costo de **viñeta** (etiqueta) por unidad, estatus `P.T. MAQUILA`, formatos
impresos con firmas "ENTREGO/RECIBIO PRODUCTO SEMI TERMINADO" y "REVISO CONTROL DE CALIDAD", y una pantalla de
**desperdicio por tipo** (quebrado, inflado, crudo, dorado, pegado, cabezal, quemado, retenido en máquina, caído al
suelo, grasoso, falto de manteca) que apunta a producto horneado/frito. Es decir, el módulo parece **genérico y
personalizado por cliente**: no hay un sector único evidente. **No lo usan todos los clientes** (ver abajo).

**¿La empresa en disco lo usa? Sí, y a fondo** [D]: 22,643 órdenes vivas (22,592 procesadas, 50 pendientes, 1 anulada)
entre 2019-03 y 2020-10 (435 a 1,453 por mes), 173 productos distintos, 98,857 líneas de consumo, 377 filas de fórmula
(282 productos formulados). Después de 2020-10 no hay datos aunque el código se compiló en 2021-12 [D] (pregunta 1).

### Dónde están los datos (tres carpetas)

`EMPRESAS` (en `fuente`, 1 empresa) lleva `CAMINO = \MCERP\LOTE64\DBF`, `INTEGRA = \MCERP\INV64\dbf` y
`CONTA = \MCERP\contac\dbf`, y `access.prg` hace `SET PATH TO <camino>;<integra>;<conta>` [V][D]. Por eso el código
abre tablas "sin ruta" que están en otra carpeta:

| Carpeta | Contiene | Ejemplos |
|---|---|---|
| `MCERP/LOTE64/DBF` | Las tablas propias de producción | `LOTE`, `DETALOTE`, `FORMULA`, `DETAFORM`, `FORMULA2`, `DETAFOR2`, `DESPACHO`, `DETADESP`, `CFINDI`, `ESTATUS`, `LACTIVI`, `LINDI`, `LMAQUINA`, `MOBRA`, `LABMAQUI` |
| `MCERP/INV64/DBF` | Inventario (lo que la producción **lee y escribe**) | `ARTICULO`, `BODEGAS`, `MOVIMIEN`, `DATAMOV`, `BODMES`, `MESES`, `SALDOLO`, `VENCE2`, `CIERRE`, `TABLA`, `DPEDI`, `PEDI`, `DESALIDA` |
| `MCERP/CONTAC/dbf` | Libro mayor y catálogo contable | `PARTIDAS`, `DETAPART`, `CATALOGO`, `TIPOPAR`, `SALDOS` |

**Hallazgo importante para la migración** [D]: los datos de `INV64/DBF` que hay en disco **no son los del cliente de
producción**. Los códigos de producto de `LOTE64` (letras + dígitos, p. ej. forma `AAAAAA999`) **no existen en
ningún `ARTICULO.DBF` de `INV64`** (645 productos con código numérico, 0 coincidencias con las 282 fórmulas, ni en las
copias `DBF/` y `dbfOLD/`), y los 174,562 movimientos de `MOVIMIEN` no traen ningún concepto de producción
(`PR`, `EP`, `ET`, `SP`, `PP`: 0). El lado de inventario de este cliente **no está en el disco**: la paridad contra
inventario y contabilidad necesita una copia consistente de `INV64`/`CONTAC` del mismo cliente.
Además `MOVIMIEN` en disco **no tiene el campo `LOTEPADRE`** y no existe la tabla `ENTREGAP`, que el código usa (§ Entregas
parciales en business-rules): la versión de `INV64` en disco es anterior al código de `LOTE64` [D].

## 2. Proyecto vivo

Un solo proyecto en `MCERP/LOTE64/FUENTE`: **`lote.pjx`**. Está completo (los 51 forms y 27 programas existen en la
carpeta).

| Tipo | Entradas | Nota |
|---|---|---|
| Forms (`.scx`) | **51** | 35 alcanzados desde el menú; 16 subpantallas y auxiliares (fecha de proceso, desperdicio, búsquedas, impresión, login) |
| Pantallas generadas (`.spr`) | 42 | Casi todas son *stubs* de 1 línea que hacen `DO FORM`; hay 6 con código real de FoxPro 2.x (`LPMLOTE.SPR` y `LPDESP01.SPR` con procedimientos auxiliares, `LPMFORM1.SPR`, `CCPARTCO.SPR`, `CNPERFIL.SPR` y `LPRENDI.SPR`, esta última sin `.scx`) |
| Programas (`.prg`) | 27 | `access.prg` (principal), `posmov.prg`/`posmov2.prg` (recosteo), `cgadipar.prg` (posteo al libro mayor), `ultimo.prg`, `proteger.prg`, ayudas de búsqueda `ver*.prg` |
| Reportes (`.frx`) | 32 | |
| Menús | 1 (`lpmenu.mnx`) | |
| Imágenes / íconos | 47 + 1 | |
| Visor | `foxypreviewer.app` (excluido) | |

**Código muerto** (existe en `FUENTE` pero **no** está en el proyecto) [V]: `lpmlotet.scx` (variante de la orden de
producción, 201 KB de `.spr`), `lprformc.scx`, `lprprovi.scx`, `phinfo.scx`, `verpa.scx` y todos los `.bak`,
`.fxp`, `ACCESS.BAK`, `LPMLOTE.BAK`. Del folder `FUENTE` también hay **tablas de trabajo con datos reales** (`PROCE`
503 filas, `DETALLE2` 2,232, `DETALLES` 3,197, `LOT`, `DETA`, `ERROR` 654, `FOXUSER`) que son resultados temporales de
reportes: **no se migran**. `lprendi` (Rendimientos) está en el proyecto pero tiene instrucciones de depuración (`SUSP`,
`BROWSE`) y no termina de construir el reporte (§Reportes).

## 3. Mapa de menú → funcionalidad

36 opciones con acción (más 4 barras estándar de FoxPro: Buscar, Buscar otra vez, Cambiar ventana, Reloj).
**Todas las que abren una pantalla de negocio revisan permiso en `PERFIL`** (usuario + nombre de la pantalla; si falta:
"Lo siento no tiene Acceso a esta opción") y llaman antes a `nomoros()` (no abre otra pantalla si hay una tabla abierta).
**Sin revisión de `PERFIL`**: "Seleccionar Mes de Trabajo", "Seleccionar Empresa", "Usuarios" y "Rendimientos"
(`LPRENDI`). Las pantallas, una vez abiertas, **no** usan banderas de agregar/modificar/eliminar de `PERFIL`: solo el
permiso de abrir [V]. El menú oculta pestañas completas a los usuarios de tipo 2 (`USRTYPE=2`): **Archivos** e
**Impresiones**, y la opción "Lotes de Producción"; quedan solo despachos, entregas parciales, mes/empresa, indirectos y
utilidades [V] (probablemente el perfil de bodega/despacho [I]).

Columna **Destino**: ✅ migrar · 🔁 migrar rediseñado · ❌ no migrar. `production` (PR), `inventory` (INV),
`general-ledger` (GL), plataforma (PL).

### Archivos (9)

| Opción | Pantalla | Destino |
|---|---|---|
| A-Formulas de Producción | `lpmform1` | ✅ PR — fórmula (receta) de un producto con su costo teórico; ver business-rules §4 |
| A-Formulas Maestra | `lpmforma` | 🔁 PR — copia de la pantalla anterior sobre `formula2`/`detafor2` (12 fórmulas, 166 líneas); ninguna otra pantalla las usa. Propuesta: unificar con fórmulas mediante **versiones** (preguntas 5 y 7) |
| Crear Maquiladores | `lpmaqui` | ✅ PR — maquiladores (código, nombre, contacto, bodega destino de la materia prima). **Defecto:** "Eliminar" borra de `mobra`, no de `labmaqui` (§20) |
| B-Especificar Movimientos | `inmovlot` | 🔁 PR/INV — dos códigos de concepto de inventario (entrada `NFA`, salida `NDE`) guardados en `MOVI.MEM`; en disco `NFA = EP`, `NDE = PR`. Se vuelve **configuración del módulo** |
| C- Crea Estatus de Ordenes de Produccion | `lpestatu` | ✅ PR — catálogo (6 estatus en disco) |
| D-Crear Actividades de Produccion | `lpmacti` | 🔁 PR — catálogo (3); **no lo usa ninguna otra pantalla** [V] |
| E- Crear Indirectos de Produccion | `lpmindi` | 🔁 PR — catálogo (2); **ninguna otra pantalla lo usa** [V] |
| Crear Mano de Obra | `lpmobra` | 🔁 PR — catálogo (2 empleados con tarifa `CPHORA`); **ninguna otra pantalla lo usa** |
| Crear Maquinarias | `lpmmaq` | 🔁 PR — catálogo (2 máquinas con tarifa `CPHORA`); **ninguna otra pantalla lo usa** |

### Movimientos (6)

| Opción | Pantalla | Destino |
|---|---|---|
| A- Lotes de Producción | `lpmlote` (+ `lpmfec` fecha de proceso, `lpdetade` desperdicio, `verlotes` búsqueda, `lprlote` impresión) | ✅ PR — **orden de producción**: crear, modificar, eliminar, anular, **procesar** (mueve inventario y costos), transferir materia prima, imprimir. Núcleo del módulo |
| B- Despacho de Lotes | `lpdesp01` | 🔁 PR — vale de envío que agrupa órdenes; sin efecto en existencias (§16). Propuesta: **no migrar como módulo propio**; ver pregunta 27 |
| C-Selecionar Mes de Trabajo | `sbselmes` | ❌ PL — mes de trabajo de la plataforma |
| D-Seleccionar Empresa de Trabajo | `selemp` | ❌ PL — empresa activa |
| Actualizar Indirectos | `cflote` | 🔁 PR — tarifas mensuales de mano de obra e indirectos (`CFINDI`) y dos procesos masivos que las aplican a órdenes y a fórmulas; **sin datos desde 2017** (pregunta 17) |
| Entregas Parciales | `lpmtrane` (+ `inmp` impresión) | 🔁 PR/INV — entrega parcial de producto a bodega 17 antes de procesar la orden; **0 usos en disco y la tabla `ENTREGAP` no existe** (pregunta 24) |

### Impresiones (15)

| Opción | Pantalla | Destino |
|---|---|---|
| A-Formulas de Productos | `lprform` | ✅ PR — listado de fórmulas por línea, con o sin costos |
| Formulas de Productos completas | `lprformt` | ✅ PR — fórmulas con consumo por unidad |
| B- Lotes Pendientes de Procesar | `lppend1` | ✅ PR — órdenes no procesadas ni anuladas (por fecha programada) |
| C- Produccion y Programación | `lprprod1` | ✅ PR — órdenes programadas en un rango, con detalle de insumos |
| D- Producción por Fecha | `lprprod2` | ✅ PR — órdenes procesadas por fecha de fabricación |
| E- Producción por Lineas | `lprproli` | ✅ PR — por línea de producto; "detallar/consolidado", "ver costos", "solo maquila" |
| F- Detalle de Consumo | `lprprodl` | ✅ PR — insumos consumidos por producto y línea |
| G- Producción Anual | `lpranual` | ✅ PR — por año; unidades o costo unitario con viñeta |
| H- Consumo por Articulos | `lprprodp` | ✅ PR — consumo total por insumo |
| I- Impresion de Lotes | `lprlote2` | ✅ PR — impresión masiva de órdenes (orden de maquilado / hoja de producción) |
| Produccion al costo Standar | `lprprost` | 🔁 PR — producción valorada por componente del costo |
| Movimientos de Maquila x Proveedor | `lpimaqui` | 🔁 PR — costo de maquila por proveedor (por la orden de compra de la maquila) |
| Rendimientos | `lprendi` | ❌ PR — reporte inconcluso (§13); rediseñar como rendimiento real vs fórmula |
| Estatus de Ordenes de Produccion | `lprstatu` | ✅ PR |
| Detalle de Desperdicio en Produccion | `lprdespe` | 🔁 PR — desperdicio por tipo (§13) |

### Utilidades (6 + sistema)

| Opción | Pantalla | Destino |
|---|---|---|
| Reindexar Archivos | `reindex` | ❌ — mantenimiento de índices de VFP; no aplica (solo usuarios de nivel 1–3 lo veían) |
| Usuarios | `acceso` / `acceso2` (+ `cnperfil` perfiles) | ❌ PL — usuarios y permisos (no revisa `PERFIL`) |
| Mantenimiento de Empresas | `sbmemp01` | ❌ PL |
| **Recalcular Costos** | `posteo` → `posmov.prg` | 🔁 PR — vuelve a leer del inventario el costo de cada insumo y reescribe costos de órdenes y de la entrada del producto; bloqueado si el mes está cerrado (§14) |
| Configurar Cuentas Contables | `confcta` | 🔁 PR/GL — cuentas de mano de obra, indirectos, maquilado y etiqueta (`CUENTAS.MEM`) |
| **Generar Partida Contable** | `ccpartco` (→ `cgadipar.prg`) | 🔁 PR + GL — partida resumen de costos de producción por rango de fechas (§15) |

## 4. Pantallas clave (qué se ve)

Descripción hecha leyendo las posiciones del renderizado de `render_scx.py` (no se vieron capturas).

**Órdenes de Producción (`lpmlote`, 974×666).** Arriba una barra de íconos: Anterior, Siguiente, Modificar, Eliminar,
Agregar, Finalizar, **Anular**, Imprimir, Grabar, Cancelar, **Ver** (buscador); a la derecha tres botones: **Procesar Lote**,
**Transferir Exist. Materia Prima** y **Detalle de Desperdicio**. Debajo, un panel azul con el encabezado en dos columnas:
*Orden No.*, *Fecha Program.*, *Cantidad*, *M.O.D.*, *IND.*, *Maquilado* (tarifa por unidad), casilla *Procesado*, y a la derecha
*Producto* (código + descripción), *Responsable*, *Entregas Parciales* (+ botón "Ver Entregas"), *Horas MOD*, *Orden de
Compra No.*, *Bodega*, *Estatus*, *Turno*, *Lote* y *Vencimiento* del producto terminado, *Maquilador*, casilla *Transferido*.
A la derecha, un cuadro negro de **costos**: M.Prima, M.Empaque, M.Obra, C.Indirectos, Maquilado, Costo Total, C. Unitario y
C.Prom Ant. Al centro una **cuadrícula de insumos** (Producto, Descripción, Unidad, M.Prima ☐, Cantidad, Lote, Costo Unit.,
Costo Total, Bodega) con una fila de captura arriba (Supr = quitar línea). Al pie: casillas *Procesado* y *Anulado*.

**Fórmulas de Productos (`lpmform1`, 1064×728).** Íconos: Agregar, Buscar, Eliminar, Modificar, Anterior, Finalizar, Siguiente,
Grabar, Ignorar, Imprimir, Ver. Encabezado: *Producto* (código + descripción), *Medida Base*, *Cantidad Formulada* (el
tamaño de la corrida), *M. de Obra*, *Indirectos %*. Cuadrícula: Código, Descripción, Unidad, *Es M.* (materia prima), Cantidad,
Costo Unit., Costo Total. A la derecha: Costo M.Prima, Costo M.Empaque, Costo M.de Obra, Costos Indirectos, Costo Total, Costo
Unit. Abajo: "Descripción del proceso" (memo).

**Despacho de Lotes (`lpdesp01`, 595×~400).** *Fecha*, *Ruta de Desp. No.* (generado), y una cuadrícula de 12 filas "DETALLE DE
LOTES": No. de lote, Producto, Descripción, Fecha de programación, Cantidad; botones Primero/Último y Anterior … Finalizar.

**Entregas Parciales (`lpmtrane`, 515×241)** y **Actualizar Indirectos (`cflote`, 499×225)** son diálogos pequeños: el primero
con orden, producto, bodega, unidades a fabricar/entregadas/disponibles, documento, fecha y unidades a entregar; el segundo con
mes, año, % de indirecto y tarifa de mano de obra, y dos botones ("Actualizar Ordenes de Produccion", "Actulizar Formulas").

## 5. Fuera de alcance de este spec

- **Cómo `INV64` valúa y cierra existencias** (qué hacen `BODMES`/`MESES`, cierre de mes, ajustes, la reconstrucción de saldos): se
  describe aquí solo lo que la producción **escribe** en cada tabla. El otro spec (INV64) debe confirmar el método de valuación
  (promedio por bodega y mes) y el cierre. Ver data-model §2 para las columnas exactas y poder unir ambos documentos.
- Usuarios, permisos, empresas, mes de trabajo, reindexado: plataforma (ya especificados en otros módulos).
- Facturación, DTE, rutas de reparto: inventario / CxC.
- Costeo estándar o por actividades: **no existe** en el sistema; las tablas de actividades, indirectos, mano de obra y maquinaria
  son catálogos sin uso (§3).
- Subproductos, mermas con valor, rendimiento esperado, versiones de fórmula, sustitutos, **no existen** (se dice explícitamente
  en business-rules §4, §6 y §13).
