# LOTE64 — Reglas de negocio

Extraídas de los formularios `lpmlote.scx` (+ `lpmlote.spr`), `lpmform1.scx` (+ `.spr`), `lpmforma.scx`, `lpmfec.scx`, `lpdetade.scx`,
`lpmtrane.scx`, `inmp.scx`, `cflote.scx`, `posteo.scx`, `ccpartco.scx` (+ `.spr`), `confcta.scx`, `inmovlot.scx`, `lpdesp01.scx` (+ `.spr`),
`lpestatu.scx`, `lpmacti.scx`, `lpmindi.scx`, `lpmobra.scx`, `lpmmaq.scx`, `lpmaqui.scx`, los formularios de reportes (`lprform`,
`lprformt`, `lppend1`, `lprprod1`, `lprprod2`, `lprproli`, `lprprodl`, `lpranual`, `lprprodp`, `lprlote2`, `lprlote`, `lprprost`, `lpimaqui`,
`lprstatu`, `lprdespe`, `lprendi.spr`) y de búsqueda (`verfor`, `verlotes`); programas `access.prg`, `posmov.prg`, `posmov2.prg`, `posteo.prg`,
`cgadipar.prg`, `ultimo.prg`, `proteger.prg`, `verlot.prg`, `verlote.prg`, `verlin.prg`, `vercf.prg`, `boton4.prg`; menú `LPMENU.MPR`; `MOVI.MEM`
y `CUENTAS.MEM`. Las cifras salen de una lectura de las tablas de `MCERP/LOTE64/DBF` y `MCERP/LOTE64/FUENTE` (solo conteos y
patrones; no se copió ningún dato, **ni ninguna fórmula**). Los efectos sobre inventario se describen tabla por tabla y campo por campo; los
nombres de tablas e índices de `INV64` se verificaron en el código de `LOTE64` y en la estructura de `MCERP/INV64/DBF`.

Convenciones: **[V]** verificado en el código; **[D]** verificado en los datos; **[I]** inferido.
"Nueva plataforma:" marca dónde el sistema nuevo debe diferir a propósito.

## 1. Cómo está armado el sistema (contexto)

- Aplicación VFP aparte, con login propio (`access.prg` → `intro.spr`), selección de empresa (`selemp.prg`) y menú (`LPMENU.MPR`) [V].
  `access.prg` restaura `EMPRESA.MEM`, abre `EMPRESAS` y hace `SET PATH TO <camino>;<integra>;<conta>`: producción (`camino`), inventario
  (`integra`) y contabilidad (`conta`). Por eso las pantallas abren `articulo`, `movimien`, `bodmes`… "sin ruta". **Si las rutas no existen en
  la máquina, las pantallas fallan.** En la copia, `EMPRESAS` trae 1 empresa con rutas `\MCERP\LOTE64\DBF`, `\MCERP\INV64\dbf`,
  `\MCERP\contac\dbf` [D].
- **Mes de trabajo** (`mesact`, `AAAAMM`): cada usuario guarda el suyo en `MESACT.<usuario>` (`.MEM` en la carpeta de datos) [V]. La fecha
  programada (`FECHAP`) y la de fabricación (`FECHAF`) **deben caer en el mes de trabajo** (§5, §6).
- Usuarios (`USUARIOS`: `USRLVL` 1 Administrador, 2 Operador y Consulta, 3 Operador, 4 Consulta; `USRTYPE`; `VE_COSTO`), permisos por pantalla (`PERFIL`
  usuario + nombre de pantalla) y auditoría (`BITACORA`) son el sistema compartido [V]. En producción **no se escribe `BITACORA`** (la línea está
  comentada en `lpmlote.scx`), no hay usuario ni hora en `LOTE`/`DETALOTE`, y **no hay transacciones** (`BEGIN TRANSACTION` no aparece en ningún archivo):
  si el equipo se apaga a la mitad de "Procesar", queda un movimiento a medias [V].
- Borrar en VFP es una marca (`DELETE`) y las tablas acumulan filas "borradas". Aquí es **extremo**: `LOTE` tiene 17,442 filas borradas junto a
  22,643 vivas; `DETALOTE` 105,870 junto a 98,857. Causa: **cada "Modificar" borra la orden y la vuelve a agregar** (§5). 13,720 órdenes (61 %) tienen
  al menos una copia borrada; 1,069 órdenes solo existen borradas (eliminadas sin procesar) y 1 orden procesada está borrada [D].
- Dinero y cantidades son `N(12–14,5)` (cinco decimales; **cada importe de línea se redondea a 5 decimales**, ver §7). El redondeo de VFP `ROUND` es
  "mitad hacia afuera" [V].
- **Nueva plataforma:** `empresa_id` en toda tabla, importes como cadenas decimales exactas (con 5 decimales para costos unitarios y cantidades), sin
  borrado físico (`is_active` y estado `anulada`), mes de trabajo y períodos en tabla, auditoría con valores antes/después en `core_audit_log`, y
  **toda operación que toque existencias y costos dentro de una sola transacción**.

## 2. Catálogos y configuración

Todos los catálogos son pantallas CRUD sencillas (Anterior / Siguiente / Modificar / Eliminar / Agregar / Finalizar). Código obligatorio y único:
"Debe Asignar un Número al Grupo !!!" / "Codigo ya existe !!!". "Eliminar" pide confirmación y borra (marca) [V].

| Catálogo | Tabla (clave) | Campos | Notas |
|---|---|---|---|
| Estatus de órdenes | `ESTATUS` (`CODIGOS` C3) | `ESTATUS` C50 | 6 en disco: `01 PROGRAMADA`, `02 INICIADA`, `03 INTERMEDIO`, `04 PTE.HORAS`, `05 FINALIZADA`, `06 P.T. MAQUILA` [D]. **Solo informativo**: ninguna regla depende del estatus (§5) |
| Actividades | `LACTIVI` (`CACTIVI` C5) | `DESCRIPA` C50, `CPHORA` N12.2 (costo por hora) | 3: llenado, pesado, etiquetado. **Ninguna pantalla lo usa** [V] |
| Indirectos | `LINDI` (`CINDI` C5) | `DESCRIPI`, `CPHORA` N12.5 | 2 (supervisores). **Sin uso** [V] |
| Mano de obra | `MOBRA` (`CODEMP` C5) | `NOMBREE` C50 (persona), `CPHORA` N12.5 | 2 empleados con tarifa por hora. **Sin uso** [V] |
| Maquinaria | `LMAQUINA` (`CODMA` C5) | `DESCRIPMA`, `MODELO` C25, `CPHORA` N12.5 | 2 (llenadora, etiquetadora). **Sin uso** [V] |
| Maquiladores | `LABMAQUI` (`CODIGO` C3) | `NOMBRE`, `CONTACTO`, `BODEGA` N5 | 1. Se usa en la orden (§9, §11) |
| Tarifas mensuales | `CFINDI` (`MES`+`YEAR`) | `INDI` N12.2 (% de indirectos), `OBRA` N12.4 (costo de mano de obra) | 58 vivas; **solo años 2013 a 2017** [D]. Ver §14 |
| Movimientos | `MOVI.MEM` (variables `NFA`, `NDE`) | concepto de **entrada** de producto terminado (`NFA`) y de **salida** de insumos (`NDE`) | En disco `NFA = EP`, `NDE = PR` [D]. Pantalla "Especificar Movimientos" (`inmovlot`) [V] |
| Cuentas contables | `CUENTAS.MEM` (`CFG_MOBR`, `CFG_INDI`, `CFG_MAQU`, `CFG_ETIQ`, `CFG_CONTA`) | cuenta de mano de obra, indirectos, maquilado y etiqueta (viñeta); `CFG_CONTA` activa la validación contra `CATALOGO` | Las cuatro cuentas están llenas en disco [D]. Validación: "Cuenta No Existe!", "Cuenta no es de detalle!" |
| Empresa | `EMPRESAS.CVINETA` (lógico) | activa el costo de **viñeta** (etiqueta) por producto | `F` en la copia: el costo de viñeta está **apagado** (VINETA = 0 en todas las órdenes) [D] |

**Los códigos de concepto de inventario `PR`, `EP`, `ET`, `SP`, `PP`** (§6, §9, §10) no vienen en la tabla `CONCEPTO` del `INV64` en disco [D]
(solo `II, EC, SV, ED, AI, CO, NA, EA, SA, SC, PD, $M`). Otro indicio de que no es la copia del mismo cliente.

**Nueva plataforma:** los catálogos de actividades, indirectos, mano de obra y maquinaria **no se migran** hasta que alguien los necesite (no
alimentan ningún cálculo); estatus y maquiladores sí. Los conceptos de inventario de producción (consumo, producto terminado, traslado a proceso)
son datos de `inventory` y los define su módulo; `production` solo guarda cuál usa.

## 3. Qué significan "lote", "fórmula" y "despacho" aquí (síntesis)

Ver el resumen y el nivel de confianza en el [README](README.md) §1. En una frase: **lote = orden de producción**; **fórmula = receta de un
producto (lista de insumos por tamaño de corrida)**; **despacho = vale que agrupa órdenes que van a bodega**, sin efecto contable ni de existencias.
El número de lote (`LOTE` C7) es **texto digitado por el usuario**, con prefijos de letras y dígitos (patrones `A999999` en 13,369 órdenes, `AA99999`
en 9,228 y 46 puramente numéricos) [D]; no es un lote de compra ni uno de vencimiento (eso es `LOTE2`, §12).

## 4. Fórmulas (recetas)

Tablas `FORMULA` (encabezado) y `DETAFORM` (insumos) [V]. Pantalla "Formulas de Productos" (`lpmform1`).

### 4.1 Estructura

- **Encabezado** (`FORMULA`, llave `PRODUCTOF` C16 = código del producto): `MBASE` N10.2 "Medida Base", `PROGRAMA` N14.2 "Cantidad Formulada"
  (tamaño de la corrida a la que corresponden las cantidades), `MOD` N12.5 (mano de obra directa **por unidad**), `IND` N5.2 (**% de
  indirectos** sobre materiales + mano de obra), `LINEA` N3 (línea de producto = `ARTICULO.GRUPO`), `FFARMA`, `PRESENTA`, `GRANEL`, `NDIASP`,
  `OBSERVA1-4`, `COMENTARIO` (memo, "Descripción del proceso") [V]. `FFARMA`, `PRESENTA`, `GRANEL`, `NDIASP`, `OBSERVA*` y `COMENTARIO` están **vacíos en
  las 377 filas** [D].
- **Líneas** (`DETAFORM`: `PRODUCTOF`, `PRODUCTO` C16, `CANTIDAD` N13.5, `MP`, `ME`, `MG` lógicos): cada línea es un insumo con su cantidad **para la
  corrida completa** (`PROGRAMA`). `MP` = materia prima; `ME` = material de empaque (la pantalla guarda `ME = !MP`); `MG` = "a granel" (semi-terminado) [V].
  Datos: 1,213 líneas `MP`, 564 no-`MP`; ninguna es ambas; 475 tienen ambas banderas en falso/vacías (líneas viejas sin `ME` grabado) [D].
- Las cantidades están **en la unidad del artículo** (`ARTICULO.UNIDAD`); no hay conversión de unidades ni factor de rendimiento [V].
- **Costo teórico** que muestra la pantalla: materias primas = Σ `cantidad × ARTICULO.COSTO_PROM` de las líneas `MP`; empaque = Σ de las demás;
  `mano de obra = round(PROGRAMA × MOD, 5)`; `indirectos = round((MP + ME + mano de obra) × IND / 100, 5)`; total = suma; costo unitario =
  `round(total / PROGRAMA, 5)` [V] (nótese que los `valid` de `Cantidad Formulada`/`M. de Obra`/`Indirectos` redondean a **2** decimales y la
  función de totales a 5: ambos coexisten en la pantalla [V]).
- Tamaños: mediana 4 líneas por fórmula, máximo 32 [D].

### 4.2 Reglas de captura (mensajes literales)

| Regla | Mensaje |
|---|---|
| El producto debe existir en `ARTICULO` (`*` abre búsqueda) | "Producto no existe, verifique" |
| Agregar: si ya hay fórmula del producto, la carga | "Producto ya fue formulado" (aviso) |
| Buscar/Modificar: debe existir | "Producto no ha sido formulado" |
| `MBASE` obligatoria y > 0 | "Debe especificar la Medida Base" / "La Medida Base debe ser mayor que 0" |
| `PROGRAMA` obligatoria y > 0 | "Debe especificar la Cantidad Formulada" / "La Cantidad Formulada debe ser mayor que 0" |
| Eliminar | "Se eliminará <código> # <descripción>!!!" (confirmación) |
| Borrar línea (Supr) | "desea eliminar este registro?" |

- **Modificar = borrar la fórmula y su detalle y volver a agregar** (`seek … delete; append blank; gather`) [V]. No hay historial, ni vigencia, ni versión,
  ni usuario/fecha de cambio. Eliminar marca como borrado encabezado y detalle (con `SEEK LEFT(productof,10)`, una llave más corta que la de captura, 16) [V].
- **No hay sustitutos de insumos, ni insumos alternativos, ni subproductos o coproductos, ni merma/rendimiento esperado en la fórmula** [V]: se dice
  explícitamente porque se preguntó. (`MG` marca un insumo "a granel", sin efecto en ningún cálculo; no se encontró uso fuera de copiarse a la orden.)
- **Insumos que son a su vez productos formulados:** 433 de las 1,777 líneas (96 productos distintos) usan como insumo un producto que tiene su propia
  fórmula [D]. El sistema **no** programa producción en cascada: cada orden consume lo que haya en existencias del semi-terminado (§6.1).
- **Fórmula maestra** (`lpmforma`, tablas `FORMULA2`/`DETAFOR2`): clon exacto de la pantalla anterior sobre otras dos tablas (12 fórmulas, 166
  líneas). Ninguna otra pantalla ni reporte las lee [V]. Propósito desconocido (pregunta 7).

### 4.3 Datos sucios de fórmulas [D]

- **Llaves duplicadas:** 377 filas vivas pero solo **282 productos distintos**: 47 productos tienen entre 2 y 7 filas de encabezado vivas y en
  32 de ellos los parámetros difieren (`PROGRAMA`, `IND`, `LINEA`). `SEEK` toma la primera que encuentre el índice, así que el sistema usa una y
  oculta las demás. 3,741 órdenes usan un producto con fórmula duplicada. Hay 14 líneas de detalle repetidas por completo y 17 insumos repetidos
  dentro de una fórmula (con distinta cantidad). Ver pregunta 4.
- `MOD = 0` en **las 377** fórmulas, aunque 18,768 órdenes tienen `MOD > 0`: la tarifa de mano de obra se tecleó en la orden o se borró de las
  fórmulas después (pregunta 17). `IND > 0` en 87.
- Las **cantidades de las líneas de las órdenes ya no cuadran con la fórmula actual** en 7,044 de 12,861 líneas verificadas (muestra de las primeras
  3,000 órdenes): la orden es una **copia (snapshot) editable** de la fórmula, no un enlace [D].
- Los códigos de las 282 fórmulas **no existen** en el `ARTICULO` de `INV64` en disco (§1 del README).

**Nueva plataforma:** fórmula con **versiones** (`version`, `valid_from`, solo una vigente por producto), encabezado + líneas con cantidad
**por unidad base y por tamaño de lote**, tipo de línea explícito (`materia_prima`, `empaque`, `semiterminado`), y la orden **congela** una copia
de la versión usada. Importar eligiendo una fila por producto con regla acordada (propuesta: la última física) y reportar las demás.

## 5. Orden de producción (lote): crear, modificar, eliminar

Tablas `LOTE` (encabezado, índices por `LOTE+CODIG_PROD`, `SALFEC`, `dtoc(FECHAF,1)+LOTE`, `CODIG_PROD`) y `DETALOTE` (líneas; índice
`LOTE+CODIG_PROD+CODIG_MATE`) [V]. Pantalla `lpmlote` ("Ordenes de Produccion").

### 5.1 Campos del encabezado (`LOTE`) [V]

`LOTE` C7 número; `CODIG_PROD` C16 producto; `LINEA` N3 (= `ARTICULO.GRUPO`); `CANTIDAD` N14.2 **cantidad fabricada** (la que se procesa);
`CANTIDADPR` N12.2 **cantidad programada** original; `MOD` N10.5 y `MODM` N12.5 (tarifa por unidad de mano de obra y de maquila); `CI` N5.2 (% indirectos);
`HORAS` N12.2 ("Horas MOD", informativo salvo §14); `RESPONSAB` C35, `TURNO` C40, `OBSERVA` C40; `FECHAP` fecha programada, `FECHAF` fecha de
fabricación (se llena al procesar); `BODEGA` N5 bodega de **entrada** del producto terminado; `STATUS` C3; `PROCESADO`, `ANULADO` lógicos; `LOTE2` C12
y `FVENCE2` D (lote y vencimiento del **producto terminado**); `ORDENC` C10 (orden de compra de la maquila); `CODIGOM` C3 (maquilador); `FFARMA`, `PRESENTA`
(copiados de la fórmula; en disco vacíos); `ENTREGASP` N12.2 (entregas parciales acumuladas); **costos congelados al procesar**: `CMP`
(materia prima), `CME` (empaque), `CMOD` (mano de obra), `CMODM` (maquila), `CIND` (indirectos), `VINETA` (etiqueta); `SALFEC` (mes; **vacío en 22,590
de 22,592 procesadas**); 11 campos de desperdicio `P*` (§13) [V][D].
Líneas (`DETALOTE`): `LOTE`, `CODIG_PROD`, `CODIG_MATE` (insumo), `CANTIDADP` N13.5 (cantidad a consumir), `CANTIDADO` N12.5 (cantidad original de la
fórmula; solo 767 líneas la traen), `PUNIT` N12.5 (costo unitario **congelado** al procesar), `MP`, `MG`, `BODEGA` (de dónde sale el insumo),
`LOTEIN` (lote de vencimiento del insumo), `PROVEEDOR`, `LOTEPRO`, `FEFABRICA`, `FEVENCE`, `ADICION`, `DEVOL` [V]. `ADICION`/`DEVOL`
(adiciones y devoluciones de insumo) **nunca se escriben** distinto de cero [D] y no entran en ningún cálculo.

### 5.2 Crear una orden ("Agregar")

1. **Número de lote.** La pantalla propone `val(último lote) + 1` rellenado a 7 dígitos; con los números alfanuméricos reales esto da `0000001`, así que **en la
   práctica el usuario digita el número** [V][D]. Si el número ya existe: "Lote ya fue Ingresado..." y carga la orden. Vacío: " Digite Número de Lote..!".
2. **Producto** (`*` busca por código o nombre): debe existir en `ARTICULO` ("Código de Articulo no Existe.." + "Digite [*] para ayuda") y **debe tener fórmula**
   ("Producto no tiene Formula"). Copia `LINEA` (de `ARTICULO.GRUPO`), `CPROMANT` (costo promedio anterior, informativo) y, si `CVINETA`, el costo de viñeta
   (`ARTICULO.PVINETA`).
3. **Cantidad** ("Debe especificar la cantidad Programada" si es 0). Al confirmarla se **crea la orden y sus líneas de inmediato**: copia `MOD` e `IND` de la
   fórmula (`MOD`→`MOD`, `IND`→`CI`), `FFARMA`, `PRESENTA`, `CANTIDADPR = CANTIDAD`, `BODEGA = 1`, y por cada línea de la fórmula agrega una línea de orden
   con **`CANTIDADP = CANTIDAD_fórmula / PROGRAMA × cantidad de la orden`** (regla de tres), `CANTIDADO` igual, `MP`/`MG` de la fórmula y `BODEGA = 1`
   (los insumos salen de la bodega 1 por omisión) [V]. Escalar es lineal: no hay redondeo por tamaño de lote ni cantidad mínima.
4. **Fechas.** `FECHAP` por omisión = hoy; debe estar en el mes de trabajo: "Año Incorrecto. Debe ser AAAA" / "Mes Incorrecto. Debe ser MM".
5. **Campos opcionales:** responsable, turno, horas, tarifas `MOD`, `CI`, `MODM` (editables), **bodega** (debe existir en `BODEGAS`: "!!Numero de Bodega no Existe!!"; 0 abre
   la lista), **estatus** (debe existir en `ESTATUS`; en blanco abre la lista; mensaje reutilizado "!!Numero de Bodega no Existe!!" por error de copia), **maquilador**
   (debe existir: "!!Maquilador no Existe!!"), **orden de compra** (se completa a 10 dígitos; si el producto no está en la orden: "Producto no Existen en la Orden de Compra",
   solo aviso).
6. **Lote y vencimiento del producto terminado** (`LOTE2`, `FVENCE2`): **obligatorios solo si el artículo tiene `VENCE`**: " Debe especificar el numero de lote" /
   " Debe especificar el vencimiento" [V]. En disco solo 13 órdenes traen `LOTE2` y ninguna `FVENCE2` (§12).
7. **Líneas:** se pueden **editar antes de procesar** (insumo con `*` de búsqueda, "Código No existe !!! ", cantidad, bodega, lote de vencimiento del insumo): agregar, cambiar o quitar
   (Supr, "desea eliminar este registro?"). Pueden agregarse insumos que no están en la fórmula y repetir un insumo (6 órdenes lo tienen duplicado [D]). Después de procesar, **las líneas quedan
   bloqueadas**.
8. **"Grabar"** agrega la orden y copia el cursor de líneas a `DETALOTE`. Para "Modificar" primero **borra la orden y todas sus líneas** y las vuelve a insertar (§1). Si
   existen entregas parciales (`ENTREGAP`) recalcula `ENTREGASP`. "Cancelar" recarga lo guardado.

   Nota técnica [V]: el paso 3 ya agregó una fila de `LOTE` y de `DETALOTE`, y "Grabar" agrega otra; en disco **no** hay números duplicados vivos [D], de modo que la
   duplicación se resuelve por otro camino que no se pudo reproducir leyendo el código (los 17,442 borrados son consistentes con este patrón). Para la migración
   basta importar las filas vivas.

### 5.3 Cambiar la cantidad después de crearla

Al cambiar `CANTIDAD` (en modificación): "Cantidad Diferente a la Programada, Desea Recalcular Formula". **Sí:** borra y regenera las líneas escaladas a la nueva cantidad (conserva `CANTIDADPR`
original). **No:** deja las líneas como están (el producto saldrá con otra cantidad pero se consumen los insumos de antes) [V]. 3,041 órdenes procesadas (13 %) terminan con `CANTIDAD ≠ CANTIDADPR`
(1,589 menos, 1,449 más) [D].

### 5.4 Modificar

- No se puede modificar una orden **anulada**: "Lote NO Puede ser Modificado". Una orden **procesada** sí entra a modificación pero con los campos de línea y los datos de cabecera bloqueados
  (`When … AND !m.procesado`); **quedan editables solo** `MOD` y `CI` (tarifas) [V]. Cambiar `MOD`/`CI` de una orden procesada **no cambia sus costos
  congelados** (`CMOD`, `CIND`) hasta que se corra "Recalcular Costos" (§14).

### 5.5 Eliminar

Pide "Esta seguro de Eliminar este Lote". **Solo si no está procesada ni anulada**; si no: "Lote no puede Eliminarse, ya fue Procesado". Borra (marca) encabezado y líneas. No toca existencias
(una orden sin procesar no ha movido nada) [V]. En disco 1,069 órdenes fueron eliminadas sin procesar [D].

### 5.6 Estados

No hay un campo de estado de proceso: el estado resulta de dos banderas [V]:

| Estado | `PROCESADO` | `ANULADO` | Qué permite |
|---|---|---|---|
| Programada / pendiente | F | F | todo: editar, eliminar, procesar, anular (solo marca), transferir materia prima |
| Procesada | T | F | ver, imprimir, modificar tarifas, anular (con reversa), entregas parciales no |
| Anulada | T o F | T | solo ver / imprimir. En disco: 1 anulada y **no** procesada [D] |

Más el **estatus** (`ESTATUS`: programada, iniciada, intermedio, pte. horas, finalizada, P.T. maquila), un dato libre de seguimiento que **no gobierna nada** [V]. En disco, 22,581 órdenes tienen `06`,
61 están en blanco y 1 tiene `05`: es decir, el estatus se usó como etiqueta de tipo de producción y no como flujo (pregunta 11).
Quién puede cambiar el estado: cualquier usuario con el permiso de abrir la pantalla `lpmlote` (4 de 4 usuarios con perfil en la copia) [V][D]; no hay permiso aparte para procesar o anular ni se guarda quién lo hizo.

**Nueva plataforma:** estado explícito `borrador → programada → procesada → anulada` con fechas y usuario de cada transición; permisos separados (`capture`, `supervise` para anular una procesada); sin borrado físico (eliminar = anular
si nunca se procesó); la orden **no se reescribe** al modificarla (se actualiza y se audita con valores antes/después); el estatus de seguimiento queda como catálogo opcional.

## 6. Procesar una orden: verificaciones y efectos en inventario

Botón **"Procesar Lote"** (visible solo si `!procesado` y `!anulado`). Es la operación central: **mueve existencias y costos de golpe, sin transacción** [V].

### 6.1 Verificaciones previas (todas sobre las líneas de la orden)

Para cada línea, en este orden (acumula mensajes pero sigue revisando; si alguna falla no se procesa nada):

1. **Existencia global:** `ARTICULO.EXIST_ACT < CANTIDADP` → "No existe Suficiente Existencia  <código>  <existencia>".
2. **Existencia por lote de vencimiento** (solo si el insumo tiene `VENCE`): `SALDOLO.FIN` del (insumo + mes de trabajo + `LOTEIN` + bodega) menor que `CANTIDADP` →
   "NO HAY SUFICIENTE EXISTENCIA EN LOTE EN ESA BODEGA <código> <fin>".
3. **Existencia por bodega:** el campo `ARTICULO.BODEGAn` de la bodega de la línea menor que `CANTIDADP` → "No existe Suficiente Existencia  <código>  <existencia>".
4. Si algo falló: "Lote no puede Procesarse". **No se permiten existencias negativas por esta vía.**

Si todo pasa: pide la **fecha de fabricación** (`lpmfec`, "Procesar Orden de Produccion": fecha y observación; "Debe especificar la Fecha de Fabricación", "Año Incorrecto.  Debe ser AAAA", "Mes Incorrecto.  Debe ser MM"),
confirma "Seguro de Procesar Lote" y muestra "PROCESANDO LOTE". **No se revisa si el mes está cerrado** (la lectura de `CIERRE` está comentada en `lpmlote.scx`) [V] — pregunta 16.

### 6.2 Efectos, línea por línea (consumo de insumos)

Para cada línea de `DETALOTE` (con `msalfec` = mes de `FECHAF`; `bodega` = bodega de la línea):

| Tabla (en `INV64/DBF`) | Qué escribe |
|---|---|
| **`BODMES`** (`SALFEC`+`MODELO`+`BODEGA`) | Si no hay fila del mes, la crea con `INICIAL`/`COSTOI` = `FINAL`/`COSTOF` de la fila anterior más cercana del mismo insumo y bodega (o 0). `SALIDAS += CANTIDADP`; `COSTOS += cossal`; `FINAL = INICIAL + ENTRADAS − SALIDAS`; `COSTOF = COSTOI + COSTOE − COSTOS` |
| **`ARTICULO`** | `BODEGAn -= CANTIDADP` (n = bodega de la línea); `EXIST_ACT -= CANTIDADP` |
| **`MESES`** (`SALFEC`+`MODELO`) | Igual a `BODEGAS` pero a nivel artículo: crea la fila copiando `GRUPO`, `SUBGRUPO`, `COSTO_PROM`, inicio/costo inicial del mes anterior; `SALIDAS += CANTIDADP`; `COSTOS += cossal`; `FIN = INICIO + ENTRADAS − SALIDAS`; `COSTOF = COSTOI + COSTOE − COSTOS` |
| **`MOVIMIEN`** (un registro) | `MODELO` insumo, `FECHA_MOV = FECHAF`, `TIPO_MOV = 'S'`, `CONCEPTO = NDE` (`PR`), `NFACT_ENV = LOTE`, `CANTIDAD`, `BODEGA`, `COSTO_PRE = COSTO_PROM = round(cossal / CANTIDADP, 5)`, `TOTAL = cossal`, `TIPO_PAGO = '1'`, `GRUPO`, `SUBGRUPO`, `LOTE = LOTEIN`, `FVENCE = FEVENCE` |
| **`VENCE2`** y **`SALDOLO`** | Solo si `LOTEIN` no está vacío: `VENCE2.FIN -= cantidad` (fija `FVENCE` si estaba vacío) y `SALDOLO` (insumo + mes + lote + bodega) `SALIDA += cantidad`, `FIN = INICIAL + ENTRADA − SALIDA` |
| `DETALOTE` | `PUNIT = ARTICULO.COSTO_PROM` (el costo unitario queda **congelado** en la línea) |

donde **`cossal = round(CANTIDADP × ARTICULO.COSTO_PROM, 5)`**: **el insumo se valúa a su costo promedio global vigente** (`ARTICULO.COSTO_PROM`), no al de la bodega ni al de un lote de compra (§7).

Después de las líneas se agrega a **`DATAMOV`** un encabezado: `FECHA_MOV = FECHAF`, `TIPO_MOV = 'S'`, `CONCEPTO = NDE`, `NFACT_ENV = LOTE`, `BODEGA = bodega del encabezado` [V].

### 6.3 Efectos, entrada del producto terminado

Con `modtot = round(CANTIDAD × MOD, 5)`, `momtot = round(CANTIDAD × MODM, 5)`, `totcos = Σ cossal`, `indtot = round(((totcos + modtot + momtot) × CI) / 100, 5)`,
`totge = modtot + totcos + indtot + momtot`, `vineta = LOTE.VINETA` (cantidad × costo de viñeta, 0 si `CVINETA` es falso) y **costo total de la entrada = totge + vineta**:

| Tabla | Qué escribe |
|---|---|
| **`BODMES`** (producto, bodega del encabezado, mes de `FECHAF`) | Crea la fila si falta; `ENTRADAS += CANTIDAD`; `COSTOE += totge + vineta`; `FINAL = INICIAL + ENTRADAS − SALIDAS`; `COSTOF = COSTOI + COSTOE − COSTOS` |
| **`ARTICULO`** (producto) | `BODEGAn += CANTIDAD`; **`CPROMANT = COSTO_PROM`** (guarda el anterior); **`COSTO_PROM = round(BODMES.COSTOF / BODMES.FINAL, 5)`**; `EXIST_ACT += CANTIDAD` |
| **`MESES`** | `ENTRADAS += CANTIDAD`; `COSTOE += totge + vineta`; `FIN`, `COSTOF` como arriba; **`COSTO_PROM = round(COSTOF / FIN, 5)`** |
| **`MOVIMIEN`** | `TIPO_MOV = 'E'`, `CONCEPTO = NFA` (`EP`), `NFACT_ENV = LOTE`, `CANTIDAD`, `BODEGA`, `COSTO_PRE = COSTO_PROM = round((totge + vineta) / CANTIDAD, 5)`, `TOTAL = totge + vineta`, `LOTE = LOTE2`, `FVENCE = FVENCE2`, `ORDENC = ORDENC` |
| **`DPEDI`** | Si `ORDENC` no está vacío: `RECIBIDO += CANTIDAD` en la línea (orden + producto) de la orden de compra de maquila |
| **`VENCE2`** y **`SALDOLO`** | `VENCE2.FIN += CANTIDAD`; `SALDOLO` `ENTRADA += CANTIDAD` para (producto, mes, `LOTE2`, bodega). **Se ejecuta siempre**, porque el código pregunta `!empty(m.lote)` (el número de la orden, nunca vacío) en vez de `LOTE2`: para productos sin control de vencimiento crea una fila con lote en blanco (§20) |
| **`DATAMOV`** | Encabezado `E`/`NFA`/`LOTE` con la fecha y la bodega |
| `LOTE` | `PROCESADO = T`; `CMOD = modtot`; `CMODM = momtot`; `CIND = indtot`; `CMP = Σ líneas MP`; `CME = Σ líneas no MP`; `VINETA`; `FECHAF`; `OBSERVA` |

Resultado de la regla de costo: **el costo del producto terminado es costo real de la orden**: materiales a promedio vigente + mano de obra + maquila + indirectos + viñeta, dividido entre la cantidad
**efectivamente fabricada** (`CANTIDAD`, no la programada) [V]. Verificado en datos: de 22,592 órdenes procesadas, `CMP` coincide con Σ(`CANTIDADP × PUNIT`) de las líneas `MP` en 22,587 y `CME` con el resto en 22,591, y `CMOD = round(CANTIDAD × MOD, 5)` en todas; `CIND = (CMP+CME+CMOD+CMODM) × CI / 100` en todas (con tolerancia de 0.01) [D].

### 6.4 Cantidad vs bodega de salida

El producto entra a la bodega del encabezado (`BODEGA`; 19,403 órdenes bodega 1, 3,215 bodega 2 y **25 con bodega 0** [D]; si es 0 al procesar se usa 1). Los insumos salen de la bodega de cada línea (74,803 líneas de la 1 y 24,054 de la 2).

### 6.5 Subproductos, merma, coproductos

**No existen** [V]: la orden produce **un solo producto** (el de `CODIG_PROD`). La merma no se registra como movimiento ni se valúa (§13); lo que se pierde en proceso simplemente eleva el costo unitario del único producto terminado (porque el costo total se reparte
entre la cantidad realmente fabricada).

**Nueva plataforma:** `production` envía a `inventory` **un contrato de movimientos** con `source = 'produccion'`, `source_ref = <orden>`: una lista de salidas (insumo, bodega, cantidad, lote opcional) y una entrada (producto, bodega, cantidad, **costo total**,
lote y vencimiento opcionales). `inventory` valúa las salidas con su método (hoy: promedio) y devuelve los costos reales, con los que `production` calcula el costo de la entrada. Existencias **calculadas desde movimientos** (no columnas `BODEGAn`/`EXIST_ACT` ni
`BODMES`/`MESES` como fuente de verdad). Una sola transacción por orden. Las verificaciones de existencia las hace `inventory` (política: bloquear o permitir negativo con permiso; pregunta 15). El mes cerrado **sí** debe bloquear (pregunta 16).

## 7. Cálculo del costo y cómo llega al costo del inventario

1. **Costo del insumo** = `ARTICULO.COSTO_PROM` al momento de procesar (promedio global). El simulado de la pantalla antes de procesar usa el mismo campo con el valor del día; después de procesar la pantalla muestra `PUNIT` congelado [V].
2. **Costo de la orden** (§6.3): `CMP + CME + CMOD + CMODM + CIND + VINETA`. Los **indirectos** son un **porcentaje** (`CI`) sobre materiales + mano de obra + maquila; **no** se reparten por horas, actividades ni máquinas. La **mano de obra** es una tarifa **por unidad producida** (`MOD`,
   `MODM`), no por hora (el campo `HORAS` solo cuenta en §14). [V]
3. **De la orden al costo del producto:** `ARTICULO.COSTO_PROM` del producto se reemplaza por `BODMES.COSTOF / BODMES.FINAL` de la fila (producto, bodega de entrada, mes). Es decir, el **promedio móvil mensual de esa bodega**, que incluye el saldo inicial valuado, las entradas
   del mes (otras órdenes, compras) menos las salidas del mes. No es el costo de la última orden ni un promedio global de todas las bodegas [V]. `MESES.COSTO_PROM` hace lo propio a nivel artículo y mes. Riesgo: si `FINAL = 0` la división falla (no hay protección en el proceso; sí en la anulación) [V].
4. **Costo de un insumo que es otro producto formulado** (semi-terminado): se toma tal cual su `COSTO_PROM` vigente; no se "explota" la receta [V].
5. El **costo de ventas** posterior lo calcula `INV64` a partir de `COSTO_PROM` y los movimientos (fuera de este spec).

**Nueva plataforma:** el método de valuación vive en `inventory` (propuesta: promedio móvil por artículo y empresa, con la opción de por bodega si el negocio lo exige; pregunta 14). Los costos de la orden se **guardan como decimales exactos** (5 decimales en unitarios y 2 en totales
contables), se muestran desglosados (materiales, empaque, mano de obra, maquila, indirectos, viñeta) y la entrada de producto terminado lleva el costo total calculado. Paridad: reproducir el redondeo de 5 decimales por línea antes de sumar.

## 8. Anular una orden

Botón **"Anular"** (visible si `!anulado`). Pide "Seguro de Anular es  Lote" (texto literal, con doble espacio). [V]

- **Si la orden no está procesada:** solo marca `ANULADO = T`.
- **Si está procesada: revierte los movimientos** (sin transacción):
  1. Por cada línea: devuelve el insumo con el **costo congelado** `PUNIT` (`cossal = round(CANTIDADP × PUNIT, 5)`): `BODMES` (`SALIDAS -=`, `COSTOS -=`), `ARTICULO` (`BODEGAn +=`, `EXIST_ACT +=`), `MESES` (`SALIDAS -=`, `COSTOS -=`), y **busca el movimiento de
     salida por la llave** (`'S'`+concepto `NDE`+número de lote+insumo): si lo encuentra revierte `VENCE2`/`SALDOLO` y **borra el `MOVIMIEN`**; borra también el encabezado `DATAMOV` de la salida.
  2. Producto terminado: `BODMES` (`ENTRADAS -= CANTIDAD`, `COSTOE -= (totge + sumvi)`), `ARTICULO` (`BODEGAn -=`, `EXIST_ACT -=`, y `COSTO_PROM = round(COSTOF/FINAL, 5)` **solo si `COSTOF > 0`**), `MESES` (igual), `VENCE2`/`SALDOLO` del lote del producto, `DPEDI.RECIBIDO -=` si hay orden
     de compra; **borra el `MOVIMIEN` de entrada** y el encabezado `DATAMOV`.
  3. Marca `ANULADO = T` (queda `PROCESADO = T`).
- **Diferencias con el proceso original** (la reversa **no es exacta**) [V]: (a) el costo de la entrada se recalcula con `totge = modtot + totcos + indtot`, donde `indtot` **no incluye la maquila** y `totge` **omite por completo `CMODM`**; (b) `sumvi` se recalcula como
  `round(CANTIDAD × VINE)` en vez del `VINETA` congelado; (c) `CPROMANT` no se restaura; (d) las **entregas parciales (`SP`/`ET`) no se revierten**; (e) los movimientos se **borran** (marca de VFP), así que desaparece el rastro del movimiento original. Para órdenes con maquila o viñeta el
  costo revertido en `BODMES`/`MESES` puede no igualar el que se cargó (170 órdenes con maquila en disco [D]).
- No hay "des-anular". Las órdenes anuladas quedan excluidas de todos los reportes (`!anulado`) y de la partida contable [V].

**Nueva plataforma:** la anulación crea **movimientos inversos** (contra-asientos) con los mismos valores del movimiento original (se leen de lo guardado, no se recalculan), liga ambos con `source_ref`, no borra nada, requiere permiso de supervisar y está bloqueada si el período de alguno de los movimientos
está cerrado. Si ya se contabilizó, genera la partida inversa.

## 9. Transferir materia prima al maquilador ("Transferir Exist. Materia Prima")

Pantalla `lpmlote`, botón visible si la orden no está procesada ni transferida (`!m.transF And !m.procesado`). [V]

- Bodega destino = `LABMAQUI.BODEGA` del maquilador de la orden; si no hay maquilador, **bodega 3** fija.
- Mismas verificaciones de existencia que §6.1 (más "Lote no puede ser Transferido"); pide la fecha (`lpmfec`) y "Seguro de Transferir Existencias"; mensajes "TRANSFIRIENDO EXISTENCIAS" / "PROCESO FINALIZADO".
- Por cada línea genera **una salida y una entrada de inventario con `CONCEPTO = 'PP'`** (`MOVIMIEN` `S` de la bodega de la línea y `E` a la bodega del maquilador, al mismo costo promedio), actualiza `BODMES` (por bodega) y `MESES` y **solo las columnas `BODEGAn`** de `ARTICULO` (no
  `EXIST_ACT`), más `VENCE2`/`SALDOLO` si el insumo es por lote; agrega dos encabezados `DATAMOV` (`S`/`PP` bodega 1 y `E`/`PP` bodega destino). Luego pone `LOTE.TRANSF = T` y **cambia la bodega de cada línea de la orden a la del maquilador**, de modo que "Procesar" consuma de ahí.
- **No está en uso en los datos y probablemente no funciona:** la tabla `LOTE` en disco no tiene el campo `TRANSF`/`TRANS`; el código usa `detalot.NLOTE` y `detalot.FVENCE`, campos que `DETALOTE` no tiene (`LOTEIN`, `FEVENCE`); y hay un error evidente de captura en la rama "ya existe" de `BODMES`
  (`entradas = bodmes.salidas + …`) [V][D]. 5,479 órdenes tienen maquilador `01`, pero ninguna prueba de que se hayan transferido existencias.

**Nueva plataforma:** traslado entre bodegas es un movimiento de `inventory` (transferencia, sin cambio de costo), disparado desde la orden con `source = 'produccion'`; la bodega del maquilador es atributo del maquilador. Pregunta 23.

## 10. Entregas parciales ("Entregas Parciales")

Pantalla `lpmtrane` (+ `inmp` impresión). Entrega **antes de procesar** una parte de lo que se va a fabricar. [V]

- Se captura la orden (debe existir: "LOTE NO EXISTE"; **no procesada**: "Lote ya fue procesado, no puede hacer entregas parciales"; con `LOTE2`: "Debe especificar el No. de lote "; con `FVENCE2`: "Debe de Especificar la fecha de Vencimiento"), el documento ("Documento NO PUEDE QUEDAR EN BLANCO" / "Documento ya fue ingresado"), la fecha y la cantidad;
  "Cantidad a Transfererir, supera la cantidad a Fabricar" si excede `CANTIDAD − ENTREGASP`; "Cantidad a cero, no puede descargar" si es 0. Termina con "Proceso Finalizado".
- Efecto: `LOTE.ENTREGASP += cantidad`; fila en `ENTREGAP` (lote, producto, documento, fecha, cantidad, bodega); y una **entrada de inventario** del producto terminado con `CONCEPTO = 'ET'`, **bodega 17 fija en el código**, valuada al `COSTO_PROM` **actual** del producto (no al costo de la orden), con
  `BODMES`, `ARTICULO` (`BODEGAn`, `EXIST_ACT`; **no cambia `COSTO_PROM`**), `MESES`, `MOVIMIEN` (incluye `LOTEPADRE = lote`), `VENCE2`/`SALDOLO` y `DATAMOV`.
- Al **procesar** una orden con `ENTREGASP > 0` se registra la salida compensatoria `SP` (cantidad `ENTREGASP`, de la bodega del encabezado, al costo unitario `sumun` calculado en pantalla) para que el total en existencias sea igual a `CANTIDAD` (§6). Recalcular costos (§14) reescribe los movimientos de entrega parcial con el costo final de la orden.
- **Estado real:** 0 órdenes con `ENTREGASP > 0`; **la tabla `ENTREGAP` y el campo `MOVIMIEN.LOTEPADRE` no existen en disco** y ninguna bodega 17 está en `BODEGAS` (4 bodegas) [D]. Las entregas parciales **no se han usado** en los datos disponibles.

**Nueva plataforma:** si el negocio lo pide, "recepción parcial de producto terminado": varias entradas ligadas a la orden, cada una al costo estimado y regularizadas al cerrar. Hasta entonces no se construye. Pregunta 24.

## 11. Maquila (producción por terceros)

- Una orden puede tener **maquilador** (`CODIGOM` → `LABMAQUI`), **tarifa de maquila por unidad** (`MODM`) y **orden de compra** (`ORDENC`, 10 dígitos, validada contra `DPEDI`). El costo de maquila de la orden = `round(CANTIDAD × MODM, 5)` (`CMODM`) y **entra en la base de los indirectos** (§6.3) [V].
- Al procesar, `DPEDI.RECIBIDO` de la orden de compra aumenta en la cantidad fabricada (control de lo recibido del maquilador) [V].
- Reporte "Movimientos de Maquila x Proveedor" (`lpimaqui`): une `LOTE.ORDENC = PEDI.NFACT_ENV` para obtener el proveedor; solo órdenes procesadas con `CMODM > 0`; "Resumido" o "Detallado por mes" [V].
- Datos [D]: 5,479 órdenes (24 %) con maquilador `01`; **171** con tarifa `MODM > 0`; **0** con `ORDENC`. Por eso el reporte de maquila por proveedor **no devolvería nada** con estos datos y las 171 órdenes con costo de maquila no están ligadas a una compra.
- La cuenta contable de la maquila (`CFG_MAQU`) se acredita en la partida de §15.

**Nueva plataforma:** el maquilador es un proveedor (de CxP/compras) con tarifa; la maquila es un costo de la orden que idealmente nace de una factura de servicio (CxP) y no de una tarifa tecleada. Pregunta 25.

## 12. Vencimientos y trazabilidad

- Un artículo con `VENCE = T` obliga a registrar **lote y vencimiento** en sus entradas/salidas (`VENCE2` por lote y `SALDOLO` por lote, mes y bodega). En producción: (a) el **insumo** se consume de un lote concreto (`LOTEIN`, validado contra `VENCE2`: "No. de lote no existe, verifique..."; `*` muestra los lotes con saldo `FIN > 0`),
  y (b) el **producto terminado** lleva su propio lote y vencimiento (`LOTE2`, `FVENCE2`; obligatorios si `VENCE`) [V].
- **Trazabilidad real:** el vínculo insumo → producto es solo la orden: `MOVIMIEN.NFACT_ENV` (= número de lote de la orden) en las salidas `PR` y la entrada `EP`; `DETALOTE.LOTEIN` guarda el lote del insumo consumido y `MOVIMIEN.LOTE` el lote movido. **No existe** consulta de trazabilidad hacia adelante
  ni hacia atrás en el sistema, ni "retiro de lote" [V].
- **En los datos no se usa:** ninguna línea de `DETALOTE` tiene `LOTEIN`, `LOTEPRO`, `PROVEEDOR` ni fechas; solo 13 órdenes traen `LOTE2` y ninguna `FVENCE2` [D]. Lo que la empresa llama "lote" es la orden de producción.

**Nueva plataforma:** campos de lote/vencimiento opcionales en los movimientos de `inventory`; `production` los pasa (lote del insumo por línea; lote y vencimiento del producto terminado) y ofrece la consulta "¿con qué se hizo este lote / a dónde fue este insumo?" cuando el cliente use vencimientos. Pregunta 26.

## 13. Desperdicio y rendimiento

- **Desperdicio por tipo** (pantalla `lpdetade`, botón "Detalle de Desperdicio" de la orden): once campos numéricos `N12.2` en `LOTE` — quebrado, inflado, crudo, dorado, pegado, cabezal, quemado, retenido en máquina, caído al suelo, grasoso, falto de manteca — editables **solo antes de procesar** (`!m.procesado`) [V].
  119 órdenes (0.5 %) tienen algún valor [D]. No son cantidades valuadas, no mueven inventario y no tienen unidad declarada (¿porcentaje o unidades? pregunta 28). Reporte: "Detalle de Desperdicio en Produccion" (`lprdespe`, por rango de fecha de fabricación y línea).
- **Rendimiento:** no hay rendimiento esperado en la fórmula. Lo único que existe es la diferencia `CANTIDAD` (fabricada) vs `CANTIDADPR` (programada) y el hecho de que el costo unitario sube cuando se fabrica menos [V][D]. La opción "Rendimientos" (`lprendi`) recorre las órdenes procesadas y arma una tabla de
  consumo teórico (`cantidad de la fórmula / PROGRAMA × fabricada`) pero **contiene instrucciones de depuración (`SUSP`, `BROWSE`) y termina imprimiendo el reporte de "Producción por Fecha"**: está inconcluso [V].
- **Merma:** sin campo, sin movimiento, sin valuación (§6.5).

**Nueva plataforma:** registrar en la orden la **cantidad real consumida por insumo** (adiciones, devoluciones, desperdicio) como movimientos, calcular rendimiento = fabricado / esperado y variación de consumo por insumo; el desperdicio por tipo, si se quiere conservar, como catálogo + cantidades.

## 14. Actualizar indirectos y mano de obra; recalcular costos

### 14.1 "Actualizar Indirectos" (`cflote`)

Pantalla de dos partes: captura de la **tarifa del mes** en `CFINDI` (mes, año, `INDI` % indirectos, `OBRA` costo de mano de obra; CRUD con búsqueda; "Ya fue ingresado" si el mes+año existe) y dos botones [V]:

- **"Actualizar Ordenes de Produccion"** (`posmov2.prg`): para cada orden con `FECHAF` en el mes elegido: vuelve a leer el costo de cada salida `PR` desde `MOVIMIEN` (por la llave concepto+lote+insumo+`LOTEIN`) y reescribe `PUNIT`; si `INDI > 0` **y la orden tiene `HORAS > 0`**, cambia `CI = INDI`; si `OBRA > 0`, cambia
  **`MOD = OBRA × HORAS / CANTIDAD` (queda en cero para toda orden sin horas)**; recalcula `CMOD`, `CIND` (base = materiales + mano de obra, **sin maquila**), `CMP`, `CME`, `VINETA`; y reescribe en la **entrada** `EP` de `MOVIMIEN` el costo unitario y el total (sin maquila, `CMODM` queda sin tocar). **No toca `BODMES`, `MESES` ni `ARTICULO`.** Muestra "Reconstruyendo Saldos".
- **"Actulizar Formulas"** (sic): si la **primera** fórmula tiene `MOD > 0`, pone `MOD = OBRA` en **todas**; si tiene `IND > 0`, pone `IND = INDI` **solo en el registro actual** (falta `ALL`) [V].
- Estado: `CFINDI` solo tiene meses de 2013 a 2017; 2 de 22,592 órdenes tienen `HORAS > 0` [D]. Todo apunta a que **la función quedó fuera de uso**, y ejecutarla hoy pondría `MOD = 0` a las órdenes del mes (pregunta 17).

### 14.2 "Recalcular Costos" (`posteo` → `posmov.prg`)

Diálogo "Recalcular Costos de Produccion" con mes y año (por omisión, el mes de trabajo). Si existe cualquier fila de `CIERRE` para ese mes (no se mira `CERRADO`): "No puede reconstruir, mes ya fue cerrado". Si no: "Reconstruyendo Saldos" y, por cada orden del mes por `FECHAF` [V]:
reescribe `PUNIT` de cada línea con el costo **registrado** en su movimiento de salida (no re-valúa a costo actual); recalcula `CMOD`, `CMODM`, `CIND` (base **sin maquila**, a diferencia del proceso original), `CMP`, `CME`, `VINETA`; reescribe la entrada `EP` de `MOVIMIEN` (`COSTO_PRE`, `COSTO_PROM`, `TOTAL`) y las
entradas parciales ligadas por `LOTEPADRE`. **Tampoco toca `BODMES`/`MESES`/`ARTICULO`.** Sirve para que el costo de la orden siga a los costos de salida cuando `INV64` los corrige (p. ej. al reconstruir saldos) [I]. Con insumo repetido en una orden, la llave encuentra siempre el primer movimiento (6 órdenes) [V][D].

**Nueva plataforma:** "recosteo" de un período como proceso explícito, idempotente, bloqueado en períodos cerrados, que **genera ajustes** (movimientos y partida de diferencia) en lugar de reescribir el pasado, y deja en el registro qué cambió. Una sola fórmula de indirectos (con o sin maquila: pregunta 18) para proceso, recosteo y anulación.

## 15. Contabilidad: partida contable de costos de producción

El módulo **sí contabiliza**, pero **a mano y por lote de fechas**, escribiendo **directo en el libro mayor** de CONTAC: "Generar Partida Contable" (`ccpartco`). No contabiliza al procesar la orden [V].

1. Pide fecha inicial y final ("Debe especificar la fecha", "Fecha inicial debe ser menor que la final"), el **tipo de partida** (lista de `TIPOPAR`) y el **número** (propone el siguiente del mes: máximo + 1 con 6 dígitos). Si ya existe: "Partida ya existe; Desea Eliminarla". El concepto es
   **"COSTO DE VENTA DEL dd/mm/aaaa AL dd/mm/aaaa"** (texto copiado del proceso de costo de ventas; no dice "producción").
2. Toma las órdenes **procesadas y no anuladas** con `FECHAF` en el rango. Sin ninguna: "No Existen Lotes Procesados" / "No hay movimiento".
3. **Líneas generadas** (una por cuenta; se suman las que caen en la misma cuenta) [V]:
   - **Abono** a la cuenta de inventario (`ARTICULO.CTA`) de **cada insumo**, por Σ `round(CANTIDADP × PUNIT, 5)` (detalle "COSTO DE MATERIA PRIMA…" y "COSTO DE MATERIAL DE EMPAQUE…").
   - **Abono** a `CFG_INDI` por Σ `CIND`, a `CFG_ETIQ` por Σ `VINETA`, a `CFG_MAQU` por Σ `CMODM`, a `CFG_MOBR` por Σ `CMOD`.
   - **Cargo** a la cuenta de inventario del **producto terminado** (`ARTICULO.CTA`) por Σ `CMOD + CIND + VINETA + CMODM + CMP + CME` de sus órdenes (detalle "PRODUCCION…").
   Es decir: se traslada el costo de los insumos a producto terminado y se **absorben** (se acreditan) las cuentas de mano de obra, indirectos, maquila y etiquetas, que se supone se cargaron a gasto por otro lado. La partida cuadra por construcción **si `CMP + CME` = Σ líneas**; no se valida (5 de 22,592 órdenes no cuadran en disco [D]).
4. **Escribe vía `cgadipar.prg`**, el posteador común de Bancos/CxC: borra y vuelve a insertar `PARTIDAS`/`DETAPART` con esa llave y **actualiza `SALDOS`** de cada cuenta y de sus cuentas padre; la partida va con `generado = 0` (parámetro 4 en cero), es decir **sin marca de origen** [V]. La fecha de la partida es la inicial del rango y el mes
   del libro es el de esa fecha: **un rango que cruce de mes se contabiliza completo en el primer mes** [V].
5. **No marca las órdenes ya contabilizadas.** Cada ejecución recorre el rango completo, así que dos rangos que se traslapen duplican el costo, y un hueco lo deja fuera; no hay vínculo orden ↔ partida [V]. Si la partida del mismo número ya existe y se acepta reemplazarla, **la pantalla borra `PARTIDAS`/`DETAPART` sin reversar `SALDOS`** y luego `cgadipar` suma los
   nuevos: el riesgo de saldos duplicados que ya señalan los specs de BANCOC y cxc64 [V] (pregunta 21).
6. En la copia de CONTAC **no hay ninguna línea con estos detalles** (`COSTO DE MATERIA PRIMA`, `COSTO DE MANO DE OBRA`, `PRODUCCION`…) [D]. Sí hay 306 partidas con concepto "COSTO DE VENTA DEL…", que parecen venir del proceso de costo de ventas de `INV64`, no de este módulo [I]. No se puede verificar la partida contra datos reales: falta la copia de CONTAC del cliente.

Validaciones de `confcta`: cada cuenta debe existir en `CATALOGO` y ser de detalle ("Cuenta No Existe!", "Cuenta no es de detalle!") cuando `CFG_CONTA` está activo.

**Nueva plataforma:** `production` publica al libro mayor por contrato (`source = 'produccion'`, `source_ref = <orden>` o `<período>`): **por orden al procesarla** (preferido) o en lote por período marcando cada orden como contabilizada; líneas: cargo a inventario de producto terminado; abonos a inventario de insumos, y cuentas
de absorción de mano de obra, indirectos, maquila y etiqueta configurables **por empresa**. Hoy `GL_ENTRY_SOURCES` no incluye `produccion`; hay que agregarlo. La partida de una orden anulada es la inversa. Si la contabilidad de existencias la va a generar `inventory` (consumo y entrada valuados), `production`
solo aporta las cuentas de absorción (decisión conjunta con el spec de INV64; pregunta 21).

## 16. Despacho de lotes ("Despacho de Lotes")

Pantalla `lpdesp01` sobre `DESPACHO` (`LOTE` C6, `NRUTA` C6, `FRUTA` D) y `DETADESP` (`LOTE` C6, `NRUTA`) [V][D]. Es una adaptación de la "ruta de despacho" de CxC.

- **Ruta** (`NRUTA`): se genera `DD` + `MM` + último dígito del año de la fecha + un dígito consecutivo del día (`'1'`, `'2'`…): una sola cifra, así que al décimo vale del día se rompe el formato (6 caracteres). "La fecha no puede quedar en blanco", "No. de Ruta no puede quedar en blanco", "No. de ruta ya existe".
- **Líneas** (hasta 100, 12 visibles): número de lote, que debe existir y **no estar procesado** ("No. de Lote no Existe", "Lote ya fue Procesado"); muestra producto, descripción, fecha programada y cantidad. Se puede capturar `000000` para dejar una línea vacía.
- Imprime el vale "ENVIO DE LOTES DE PRODUCCION A BODEGA" (`lprdesp`).
- **Defecto de datos:** `LOTE` mide 7 caracteres en la orden y **6** en el despacho, y la máscara de captura es de 6: con números de lote de 7 caracteres (todos los de disco) el `SEEK` encuentra por prefijo, de modo que el vale puede apuntar a la orden equivocada [V][D]. Solo existe 1 despacho con 1 línea.
- **No** mueve existencias, no costea, no genera movimientos ni partidas, y **no** se relaciona con facturas ni con rutas de reparto [V].

**Nueva plataforma:** no hay equivalente necesario. Si el negocio quiere el vale, es un reporte de "órdenes enviadas a bodega" con fecha y número, ligado a la orden por `id`. Pregunta 27.

## 17. Mes de trabajo y cierre

- Cada usuario trabaja en su mes (`MESACT.<usuario>`); fechas de captura (`FECHAP`, `FECHAF`) obligadas a ese mes [V].
- LOTE64 **no tiene cierre de mes propio**. Consulta `CIERRE` (en `INV64`) únicamente en "Recalcular Costos". Al crear, modificar, procesar, anular o transferir **no se revisa el cierre** (la verificación está comentada) [V]. Se pueden procesar o anular órdenes en meses ya cerrados, lo que cambia `BODMES`/`MESES`
  de un período cerrado.
- `CIERRE` (en el `INV64` de disco): 164 filas (`FECHA` C6, `CERRADO`, `TIEMPO`) [D].
- Las existencias y costos del mes siguiente se arrastran al crear una fila nueva de `BODMES`/`MESES`, tomando el saldo final de la fila anterior más cercana [V].

**Nueva plataforma:** períodos por empresa; ninguna operación de producción en un período cerrado (la regla que el sistema viejo se saltaba); la fecha de la orden define el período.

## 18. Reportes

| Opción | Pantalla / reporte | Filtro y contenido | Notas |
|---|---|---|---|
| Formulas de Productos | `lprform` → `dlprform`/`lprform` | Todas las líneas o rango de líneas; "Ver Costos" | Une `FORMULA`, `DETAFORM`, `ARTICULO`, `TABLA` |
| Formulas completas | `lprformt` → `lprform1` | Consumo por unidad = `cantidad / programa` | |
| Lotes Pendientes de Procesar | `lppend1` → `lppend1` | `!procesado AND !anulado`, todos o por `FECHAP`; muestra estatus | 50 pendientes en disco |
| Produccion y Programación | `lprprod1` → `lprprod1` | `FECHAP` en rango, `!anulado`, con detalle de insumos; "Ver costos" | Incluye procesadas y pendientes |
| Producción por Fecha | `lprprod2` | `FECHAF` en rango, procesadas | |
| Producción por Lineas | `lprproli` → `lprprol1..5`, `lprproli`, `lprproex` | Por línea; detallar producto o consolidado; "Ver costos"; "Solo Maquila" (`CMODM > 0`) | |
| Detalle de Consumo | `lprprodl` | Insumos por producto y línea, procesadas | |
| Producción Anual | `lpranual` → `lpranua*`, `lpranuap`, `lpranuav` | Año; unidades o costo unitario con/sin viñeta, por línea | |
| Consumo por Articulos | `lprprodp` | Consumo por insumo en el rango | |
| Impresion de Lotes | `lprlote2` → `lprlote3`; y `lprlote` por orden | Orden de maquilado (`lprmp`/`lprme`: firmas "ENTREGO/RECIBIO PRODUCTO SEMI TERMINADO", "REVISO CONTROL DE CALIDAD") u Hoja de producción | Formatos físicos |
| Produccion al costo Standar | `lprprost` → `dlrprol1..5` | Producción procesada por componente del costo | El nombre dice "costo estándar", pero usa **costos reales congelados** [V] |
| Movimientos de Maquila x Proveedor | `lpimaqui` → `lpimaqre` | Ver §11 | Sin datos aplicables |
| Rendimientos | `lprendi.spr` | — | Inconcluso (§13) |
| Estatus de Ordenes | `lprstatu` | `FECHAP` en rango, `!anulado` | |
| Desperdicio | `lprdespe` | `FECHAF` en rango por línea | |

"Ver costos" es una casilla del propio formulario: **no consulta `USUARIOS.VE_COSTO`** (el login lo carga en `COSTO` pero ninguna pantalla de LOTE64 lo lee) [V].
**Nueva plataforma:** los reportes son consultas sobre las órdenes y sus costos; la visibilidad de costos se controla con permiso (`reports` + permiso de ver costos); pregunta 29 sobre cuáles conservar.

## 19. Mensajes de validación y error (literales)

| Contexto | Mensaje |
|---|---|
| Permiso | "Lo siento no tiene Acceso a esta opción" |
| Número de lote | " Digite Número de Lote..!" / "Lote ya fue Ingresado..." |
| Producto | "Código de Articulo no Existe.." / "Digite [*] para ayuda" / "Producto no tiene Formula" |
| Cantidad | "Debe especificar la cantidad Programada" / "Cantidad Diferente a la Programada, Desea Recalcular Formula" |
| Fechas | "Año Incorrecto. Debe ser AAAA" / "Mes Incorrecto. Debe ser MM" / "Debe especificar la Fecha de Fabricación" |
| Bodega / estatus / maquilador | "!!Numero de Bodega no Existe!!" / "!!Maquilador no Existe!!" |
| Orden de compra | "Producto no Existen en la Orden de Compra" |
| Vencimientos | " Debe especificar el numero de lote" / " Debe especificar el vencimiento" / "No. de lote no existe, verifique..." |
| Procesar | "No existe Suficiente Existencia  <código>  <n>" / "NO HAY SUFICIENTE EXISTENCIA EN LOTE EN ESA BODEGA …" / "Lote no puede Procesarse" / "Seguro de Procesar Lote" / "PROCESANDO LOTE" / "Procesado Finalizado" |
| Modificar / eliminar / anular | "Lote NO Puede ser Modificado" / "Lote no puede Eliminarse, ya fue Procesado" / "Esta seguro de Eliminar este Lote" / "Seguro de Anular es  Lote" |
| Transferir | "Lote no puede ser Transferido" / "Seguro de Transferir Existencias" / "TRANSFIRIENDO EXISTENCIAS" / "PROCESO FINALIZADO" / "Lote ya fue procesado, no puede Transferir" |
| Entregas parciales | "LOTE NO EXISTE" / "Lote ya fue procesado, no puede hacer entregas parciales" / "Cantidad a Transfererir, supera la cantidad a Fabricar" / "Cantidad a cero, no puede descargar" / "Documento ya fue ingresado" |
| Fórmulas | "Producto no existe, verifique" / "Producto ya fue formulado" / "Producto no ha sido formulado" / "Debe especificar la Medida Base" / "Debe especificar la Cantidad Formulada" |
| Recalcular | "No puede reconstruir, mes ya fue cerrado" / "Reconstruyendo Saldos" |
| Partida | "Partida ya existe; Desea Eliminarla" / "No Existen Lotes Procesados" / "No hay movimiento" / "PROCESO FINALIZADO" |
| Despacho | "No. de Lote no Existe" / "Lote ya fue Procesado" / "No. de ruta ya existe" |
| Reportes | "Debe especificar la Fecha Inicial" / "Debe especificar la Fecha Final" / "La Fecha final debe ser mayor que la Inicial" / "No Existen Lotes Pendientes" / "No Existen Formulas" |

## 20. Defectos y riesgos del sistema anterior (para no copiarlos)

1. **Sin transacciones ni bitácora:** una falla a mitad de "Procesar" deja inventario sin cuadrar con la orden; nadie sabe quién procesó o anuló (§1).
2. **El costo del producto sale del promedio mensual por bodega** (`BODMES.COSTOF/FINAL`); si cambia el orden de captura de entradas y salidas dentro del mes, cambia el costo resultante (§7).
3. **Inconsistencia de la base de indirectos:** al procesar incluye la maquila; al recalcular y al anular, no. 170 órdenes con maquila quedan con `CIND` calculado con una base y recalculable con otra (§6.3, §8, §14) [D].
4. **Recalcular/Actualizar reescribe `MOVIMIEN` y `LOTE` pero no `BODMES`/`MESES`/`ARTICULO`:** el costo promedio del producto no se corrige (§14).
5. **"Actualizar Ordenes de Produccion" pone `MOD = 0`** si la orden no tiene horas (§14.1).
6. **"Actulizar Formulas"** usa solo la primera fórmula para decidir y actualiza `IND` solo en el registro actual.
7. **Fórmulas duplicadas** (47 productos) y cantidades de órdenes que ya no coinciden con la fórmula (§4.3).
8. **`VENCE2`/`SALDOLO` se alimentan siempre** al procesar, con lote en blanco para productos sin vencimiento (§6.3).
9. **Anular no es la inversa exacta** del proceso y borra los movimientos originales (§8).
10. **Mes cerrado sin protección** al procesar/anular/transferir (§17).
11. **Partida contable sin vínculo con las órdenes** y con riesgo de duplicar o reemplazar sin reversar saldos (§15); concepto "COSTO DE VENTA" erróneo; mes del libro = mes de la fecha inicial.
12. **Código y datos desfasados:** el código usa `TRANSF`, `TRANS`, `NLOTE`, `LOTEPADRE`, `ENTREGAP`, `CVINE`, que no existen en las tablas en disco (§9, §10); `lpmaqui` elimina de `MOBRA` en vez de `LABMAQUI`; `lpmlote.scx` "Modificar" reescribe la orden (miles de filas borradas).
13. **Bodega 17 y bodega 3 fijas en el código;** número de lote propuesto con `val()` que no sirve con lotes alfanuméricos.
14. **Despacho con claves de 6 caracteres sobre lotes de 7** (§16).
15. **Mensajes copiados** ("Numero de Bodega" en el estatus; "Esta seguro de Eliminar este Lote" en cualquier catálogo).
16. **Permisos grueso:** solo "abrir"; no se usan las banderas de agregar/modificar/eliminar/anular de `PERFIL`; "Ver costos" no se valida.

## 21. Resumen de reglas para la nueva plataforma

- Módulo propio `production` con contratos hacia `inventory` (movimientos valuados, `source = 'produccion'`) y hacia el libro mayor (partidas, `source = 'produccion'`); `production` **no escribe** en tablas de otros módulos.
- Orden de producción con estados explícitos, snapshot de la fórmula, cantidades y costos como decimales exactos, desglose de costos congelado al procesar, vínculos a los movimientos de inventario y a la partida creada.
- Una transacción por proceso/anulación; períodos cerrados bloquean; anulación con contra-asientos; sin borrado físico; auditoría con antes/después.
- Fórmulas con versiones y una sola vigente; importar eliminando duplicados con regla acordada.
- Existencias por movimientos (no columnas por bodega); valuación en `inventory`.
- Sin lo que no se usa: despacho, entregas parciales, transferencia a maquilador, actividades/mano de obra/maquinaria/indirectos, "costo estándar", hasta que el negocio lo confirme.
