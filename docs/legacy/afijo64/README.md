# AFIJO64 — Activo fijo y depreciación (legacy spec)

Extraído del sistema MCERP (Visual FoxPro 9), carpeta `MCERP/AFIJO64`.
Proyecto vivo: `afijo.pjx` (**115 entradas**, incluida la cabecera). Menú principal: `LPMENU.MPR` (generado de `LPMENU.MNX`).
Target en la nueva plataforma: módulo `fixed-assets` (hoy solo hay un scaffold con una tabla `fa_assets`; ver [data-model.md](data-model.md) §3).

Documentos:

- [business-rules.md](business-rules.md) — reglas de negocio extraídas del código (depreciación, partida contable, reportes)
- [data-model.md](data-model.md) — tablas legadas, modelo propuesto (`fa_`) y notas de migración
- [open-questions.md](open-questions.md) — decisiones pendientes para el negocio

> Este spec describe *qué hace* el sistema, no copia el código. No contiene datos de clientes
> (solo estructura, conteos de registros, textos de menú y lógica).
> **Marca:** **[V]** verificado en el código fuente, **[D]** verificado en los datos (estructura/conteos),
> **[I]** inferido (deducción mía, sin confirmar).

## 1. Qué hace el módulo

Módulo **pequeño** (4 catálogos, 1 proceso, 4 reportes). Lleva un registro de activos fijos y, **una vez al mes**,
calcula la cuota de depreciación en línea recta de cada activo y **genera una sola partida en la contabilidad**
(cargo a gasto de depreciación, abono a depreciación acumulada) escribiendo directamente en las tablas de CONTAC.

Lo que **hace** [V]:

- Catálogo de activos con costo, valor residual, vida útil en años, cuentas contables propias (activo, depreciación acumulada,
  gasto, "pérdida del activo"), centro de costo contable, área, clasificación, proveedor y responsable.
- "Generar Partida de Depreciación": para un mes y año, crea los movimientos de depreciación (`MOVDEPRE`) y la partida contable.
- Cuatro reportes: listado de activos (por centro de costo o por clasificación), listado por cuenta contable, "Cuadro de activo fijo"
  a una fecha (costo, depreciación acumulada, valor en libros) y detalle de depreciaciones por rango de meses.

Lo que **no existe** en este módulo (se busca explícitamente en el código y en los datos) [V][D]:

- **Bajas, ventas, descartes, ganancia o pérdida en venta.** El campo "Cta. Contable Perdida del Activo" se captura pero ningún programa lo usa;
  el indicador "Activo Depreciado" nunca se marca (143 de 143 en falso).
- **Revaluaciones, mejoras/adiciones, traslados** entre áreas o responsables (solo se edita el campo, sin historial).
- **Otros métodos** de depreciación (solo línea recta), **depreciación fiscal distinta de la financiera**, prorrateo por días o por
  mitad de mes, depreciación anual.
- **Cierre mensual o anual propio**, reverso o anulación de una corrida desde el menú, contabilización de la compra del activo.
- Bitácora de cambios y transacciones (no hay `BITACORA` ni `BEGIN TRANSACTION` en el código del módulo).

## 2. Uso real y época de los datos

- **La empresa en disco sí usa el módulo** [D]: 143 activos vivos, **14 corridas mensuales consecutivas (2022-01 a 2023-02)**,
  1,623 líneas de depreciación y 14 partidas de contabilidad (todas existen en la copia de `MCERP/CONTAC`, que es del mismo cliente).
  Compras entre 2021 y 2023-10 (dos activos de 2023-10 aún sin depreciar). Última corrida ejecutada el 2023-03-01.
- Solo hay **una empresa** (`EMPRESAS` tiene 1 fila) con rutas de producción (`AFIJO64`), inventario (`INV64`) y contabilidad (`CONTAC`);
  el módulo lee proveedores, catálogo de cuentas, tipos de partida y centros de costo de **CONTAC**, y escribe partidas y saldos en CONTAC.
- Época de los datos: **cliente de 2022–2023**, el mismo de la copia de CONTAC (libro 2020-03 a 2024-03).
- Hallazgo principal: **la depreciación acumulada guardada en la ficha del activo es incorrecta** (141 de 143 no cuadran con la suma de
  las líneas de depreciación). Los reportes sí la recalculan desde las líneas. Detalle en [business-rules.md](business-rules.md) §6.

## 3. Mapa de menú → destino

Cada opción revisa permiso en `PERFIL` (usuario + nombre de pantalla) antes de abrir; si no hay permiso, "Lo siento no tiene Acceso a esta opción" [V].
Antes de abrir, `nomoros()` exige que no haya ninguna tabla abierta (si la hay, muestra `simoros`).
Columna **Destino**: ✅ migrar · 🔁 migrar rediseñado · ❌ no migrar (técnico/obsoleto).

### Archivos

| Opción | Pantalla | Destino |
|---|---|---|
| A-Creación de Activos | `afmacti` | ✅ `fixed-assets`: ficha del activo (rediseñada: cuentas por categoría con excepción por activo, cuota calculada en el servidor) |
| B-Crear Centro Costos | `afmccos` | 🔁 `fixed-assets`: **áreas/ubicaciones** del activo (no son los centros de costo del libro mayor; ver [data-model.md](data-model.md)) |
| C-Clasificaciones del Activo | `afmclasi` | 🔁 `fixed-assets`: categorías (con cuentas y vida útil por omisión, nuevo) |
| D-Crear Responsables del Activo | `afmempl` | 🔁 `fixed-assets`: responsables (a enlazar con empleados de `payroll` cuando exista) |

### Movimientos

| Opción | Pantalla / programa | Destino |
|---|---|---|
| A-Generar Partida de Depreciación | `ccpartco` (+ `cgadipar.prg`, `verpa`) | ✅ `fixed-assets`: corrida mensual con vista previa, partida por contrato al libro mayor, anulable |
| D-Seleccionar Mes de Trabajo | `sbselmes` | ✅ plataforma (selector de período) |
| E-Seleccionar Empresa de Trabajo | `selemp` | ✅ plataforma (selector de empresa) |

### Impresiones

| Opción | Pantalla / reporte | Destino |
|---|---|---|
| A-Listado de Activos | `aflista` → `afrlista` / `afrlist2` | ✅ reporte "Registro de activos" (por área o por categoría) |
| Listado de Activo por Cuenta Contable | `aflicta` → `aflicta.frx` | ✅ reporte, con conciliación contra el libro mayor (nuevo) |
| Cuadro de Activo Fijo | `aflistad` → `afrlistd` | ✅ reporte "Cuadro de activo fijo" a una fecha (costo, depreciación acumulada, valor en libros) |
| B-Depreciaciones | `afrdepre` → `afdepre` / `afdepred` | ✅ reporte de depreciaciones por rango de meses (detallado/resumido) |

### Utilidades

| Opción | Pantalla | Destino |
|---|---|---|
| Reindexar Archivos | `reindex` | ❌ no aplica en SQLite |
| Usuarios | `acceso` / `acceso2` | ✅ plataforma (Better Auth + roles) |
| Mantenimiento de Empresas | `sbmemp01` | ✅ plataforma (empresas) |
| Buscar / Buscar otra vez / Cambiar ventana / Reloj | menú de FoxPro | ❌ |

El resto de los formularios del proyecto (`intro`, `sino`, `simoros`, `donde`, `empact`, `mcinfo`, `cnperfil`, `verpa`) son infraestructura
(login, diálogos, selector de salida a pantalla/impresora, perfiles, "ver detalle de la corrida"). `posteo.scx`, `posmov.prg` y `posteo.prg`
están en el proyecto pero son **sobrantes copiados de LOTE64** (recalculan costos de lotes sobre tablas de inventario); el menú no los invoca [V].

## 4. Proyecto vivo (`afijo.pjx`)

| Tipo | Cantidad |
|---|---|
| Formularios `.scx` | 24 |
| Programas `.prg` | 23 |
| Pantallas generadas `.spr` | 21 |
| Reportes `.frx` | 6 (`afrlista`, `afrlist2`, `aflicta`, `afrlistd`, `afdepre`, `afdepred`) |
| Menú `.mnx` | 1 |
| Imágenes / íconos | 38 |
| `foxypreviewer.app` (visor de reportes) | 1, marcado como excluido |

Fuera del proyecto (código muerto): `lpmafijo.scx`/`.spr`, `afractiv.scx`/`.spr`, `confcta.scx` (la configuración de cuentas que sí existe en CONTAC/LOTE64;
sin ella `CFG_CONTA` no se puede cambiar desde este módulo), `acmempl.scx` (copia de una pantalla de centros de costo), `xx.scx`, `espe.scx`, y `arregla.prg`
(reparación manual de acumulados, ver business-rules §6). Los `.exe`, `.fxp`, `.spx` y las `*.BAK` se ignoran. No se leyó el contenido de `afractiv`, `lpmafijo`, `xx` ni `espe`: se dan por muertos porque no están en el proyecto [V].

## 5. Pantallas clave (descritas a partir de las posiciones de `render_scx.py`)

**`afmacti` — Creación de Activo Fijo** (922 × 603). Barra superior: Anterior, Siguiente, Modificar, Eliminar, Agregar, Finalizar; a la derecha
Grabar, Ignorar, Buscar y **Ver Depre** (abre un browse con las líneas de depreciación del activo). Tres columnas:

- *Izquierda (identidad):* Código, Nombre, Tipo de Activo (combo "Activo Depreciable / Activo No Depreciable"), Centro de Costo (área),
  Clasificación del Activo, Proveedor, Modelo, Serie, Fecha de Compra, Garantía, Responsable del Activo, Observaciones (memo).
- *Centro (dinero):* Valor de la Compra, Valor Residual, Valor a Depreciar, Depreciación Acumulado, Porcentaje, No. de Años, Depre. Mensual,
  No. de Cuotas, Depre Anual, Depreciación Acumulado Anterior, Saldo a Depreciar. Varios son de solo lectura.
- *Derecha (contabilidad):* Cta. Contable del Activo, de Depreciación, del Gasto, Pérdida del Activo, Centro de Costo Contable y la casilla
  de solo lectura "Activo Depreciado". Las cuentas solo se pueden editar si la configuración de la empresa `CFG_CONTA` está activa.

**`ccpartco` — Generar Partida Contable** (534 × 502). Año (numérico) y Mes (combo ENERO…DICIEMBRE) arriba; Tipo de partida (código de 2 caracteres,
`*` abre la lista) y Num. (se propone el siguiente); Concepto General de la Partida (se llena solo); Fecha de la Partida (último día del mes);
botones Proceder / Ignorar y "Ver Detalle" (abre `verpa` con las líneas del mes).

**`aflistad` — Cuadro de Activo Fijo** (474 × 478): opción "Todo el Activo" / "Por Clasificación del Activo" (rango de clasificaciones),
"Fecha de Depreciación" (por omisión hoy), Tipo de Activo (Todos / Depreciable / No Depreciable), Continuar / Salir; luego `donde` pregunta
pantalla o impresora.

**`afrdepre` — Cuadro de Depreciaciones** (463 × 400): mes y año "desde" y "hasta", opción Detallado / Resumido, Continuar / Salir.

Los demás catálogos (`afmclasi`, `afmccos`, `afmempl`) son la pantalla CRUD estándar de la familia (Anterior / Siguiente / Modificar / Eliminar /
Agregar / Finalizar, Grabar / Ignorar, Buscar).

## 6. Fuera de alcance de este spec

- Cualquier cambio a la contabilidad de CONTAC más allá de lo que la corrida de depreciación escribe (ver el spec de [CONTAC](../contac/README.md)).
- Contabilización de la **compra** de activos (se hace a mano en CONTAC: hay partidas que tocan las cuentas de activo y no vienen del módulo).
- `dbf/DBF.rar` (75 KB) no se abrió.
- Los reportes `.frx` se leyeron por sus expresiones (campos, totales, títulos), no por su diseño visual.
- Cálculo fiscal: el módulo no distingue depreciación fiscal; **no se afirma aquí ninguna regla tributaria** (ver preguntas abiertas).
