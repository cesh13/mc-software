# AFIJO64 — Reglas de negocio

Extraídas de los formularios `afmacti.scx` (+ `.spr`), `afmclasi.scx`, `afmccos.scx`, `afmempl.scx`, `ccpartco.scx` (+ `.spr`), `verpa.scx`, `aflista.scx`, `aflicta.scx`,
`aflistad.scx`, `afrdepre.scx`, `sbselmes.scx`, `reindex.scx`; los programas `access.prg`, `selemp.prg`, `cgadipar.prg`, `ultimo.prg`, `nomoros.prg`, `valibot.prg`,
`valicta.prg`, `proteger.prg`, `veracti.prg`, `vertipo.prg`, `vercos.prg`, `verpro.prg`, `verempl.prg`, `arregla.prg` (reparación manual, fuera del proyecto);
los reportes `afrlista.frx`, `afrlist2.frx`, `aflicta.frx`, `afrlistd.frx`, `afdepre.frx`, `afdepred.frx` (solo expresiones); el menú `LPMENU.MPR`; y el catálogo de índices
`ARCHIVOS.DBF`. Las cifras salen de una lectura de las tablas de `MCERP/AFIJO64/DBF` y `MCERP/AFIJO64/fuente`, y de la copia de `MCERP/CONTAC/dbf` (solo conteos y
patrones; no se copió ningún dato de cliente: ni nombres, ni descripciones de activos, ni números de serie, ni montos).

Convenciones: **[V]** verificado en el código; **[D]** verificado en los datos; **[I]** inferido.
"Nueva plataforma:" marca dónde el sistema nuevo debe diferir a propósito.

## 1. Cómo está armado el sistema (contexto)

- Aplicación VFP aparte, con login propio (`access.prg` → `intro.spr`), selección de empresa (`selemp.prg`) y menú (`LPMENU.MPR`) [V]. `access.prg` hace
  `SET PATH TO <camino>;<integra>;<conta>`: datos del módulo (`AFIJO64`), inventario (`INV64`) y contabilidad (`CONTAC`). Por eso las pantallas abren `provedor`,
  `catalogo`, `partidas`, `detapart`, `saldos`, `tipopar`, `ccosto` "sin ruta" y las encuentran en CONTAC. **Si las rutas no existen en la máquina, las pantallas fallan** [V].
  En la copia, `EMPRESAS` trae 1 empresa con las tres rutas [D].
- **Mes de trabajo** (`mesact`, `AAAAMM`): cada usuario guarda el suyo en `MESACT.<usuario>`. **La corrida de depreciación no lo usa para elegir el mes** (el mes se
  elige en su pantalla), pero la rutina de saldos de `cgadipar.prg` sí lo usa por error (§7.4) [V].
- Usuarios (`USUARIOS`: `USRLVL`, `USRTYPE`), permisos por pantalla (`PERFIL`, 11 pantallas en disco: `afmacti`, `afmccos`, `afmclasi`, `afmempl`, `ccpartco`, `aflista`, `aflicta`,
  `aflistad`, `afrdepre`, `reindex`, `sbmemp01`) y `EMPRESAS` son el sistema compartido [V][D]. 4 usuarios vivos (20 borrados). Utilidades "Usuarios" (nivel 1 abre `acceso`, los demás `acceso2`) y
  "Reindexar" (visible solo para niveles 1 a 3).
- **No hay bitácora de cambios** (no se escribe `BITACORA`) **ni transacciones** (`BEGIN TRANSACTION` no aparece) [V]. La única traza son `MOVDEPRE.USUARIOE` / `FECHAE` (quién y cuándo corrió
  la depreciación). Una falla a la mitad de la corrida deja `MOVDEPRE` escrito sin partida, o partida sin actualizar los activos (§5, §7).
- Borrar en VFP es una marca (`DELETE`) y `SET DELETED ON` oculta las filas marcadas [V]. En disco `ACTIVO` tiene 1,420 filas marcadas junto a 143 vivas (1,372 de ellas **en blanco**,
  del flujo "Agregar") y `MOVDEPRE` 239 marcadas (copia exacta de las líneas de 2022-01, 2022-02 y 2022-03, que se borraron fuera del programa y se regeneraron) [D].
- Dinero: `N(12,2)`. No hay redondeo explícito en el código; VFP redondea al guardar en el campo de 2 decimales (mitad hacia afuera). Una excepción: `VRESIDUAL` es `N(2,0)` (§3.3) [V][D].
- **Nueva plataforma:** `empresa_id` en toda tabla; importes como cadenas decimales exactas con dos decimales; sin borrado físico (`is_active`, estado `anulada`); períodos en tabla;
  auditoría con valores antes y después en `core_audit_log`; **cada operación que escriba más de una tabla (corrida + partida + activos) dentro de una sola transacción**.

## 2. Catálogos

Tres catálogos con la pantalla CRUD estándar (Anterior / Siguiente / Modificar / Eliminar / Agregar / Finalizar; Grabar / Ignorar; Buscar). Código obligatorio y único;
"Eliminar" pide "Seguro de Eliminar" (No / Si) y marca la fila como borrada, **sin verificar si algún activo la usa** [V].

| Catálogo | Tabla (clave) | Campos | Notas |
|---|---|---|---|
| Clasificaciones del Activo | `CLASIFI` (`CODIGO` C10) | `NOMBRE` C70 | 23 vivas (46 borradas) [D]. **No lleva cuentas ni vida útil**: solo agrupa y ordena reportes |
| Centros de Costos (del módulo) | `CCOSTOa` (`CCOSTO` C10) | `NOMBRE` C70, `OBSERVA` memo (la etiqueta de la pantalla dice "Dirección") | 8 vivas (11 borradas) [D]. Es un **área/ubicación**, no un centro de costo contable (ver §3.4) |
| Responsables del Activo | `EMPLEADO` (`EMPLEADO` C10) | `NOMBRE` C50, `DIRECCION` C100, `TELEFONO` C25, `OBSERVA` C150 | 30 vivos (2 borrados) [D]. Tabla propia; **no es la planilla** (`plan64`) |

Mensajes literales: "Codigo no puede quedar en blanco"; al teclear un código repetido muestra el registro existente ("Centro de Costo ya existe" en clasificaciones y centros;
"Empleado ya existe"; "Activo ya Registrado" en activos) y pasa a modo consulta [V]. "Es el primer código!" / "Es el último codigo!" al recorrer. "no existe" al buscar.
Los mensajes de clasificación reutilizan el texto de centro de costo (copia y pega) [V].

**Nueva plataforma:** categorías y áreas se desactivan, no se borran, y no se pueden desactivar si tienen activos vigentes; las categorías ganan cuentas y vida útil por omisión
(§3.5) para no teclear cuatro cuentas por activo.

## 3. La ficha del activo (`afmacti`, tabla `ACTIVO`)

### 3.1 Campos y qué hace cada uno

| Campo legado | Etiqueta | Regla [V] | Uso real en datos [D] |
|---|---|---|---|
| `CODIGOA` C10 | Código | Obligatorio; máscara de 10 caracteres; llave de `ACTIVO` | 143 únicos; forma `AAAAAA999` en 139 |
| `DESCRIP` C50 | Nombre | Mayúsculas | siempre |
| `ACTIVOD` N10 | Tipo de Activo | Combo "Activo Depreciable" (1) / "Activo No Depreciable" (2) | 129 con 1, 13 con 2, 1 con 0 |
| `CCOSTO` C10 | Centro de Costo (área) | Existe en `CCOSTOa`; `*` abre la lista (`vercos`) | 143 válidos (7 distintos) |
| `CODIGOC` C10 | Clasificación del Activo | Existe en `CLASIFI` | 143 válidos (23 distintos) |
| `PROVEEDOR` C10 | Proveedor | Opcional; existe en `PROVEDOR` **de CONTAC**; `*` abre la lista | 128 llenos, 128 válidos |
| `MODELO`, `SERIE` C40 | Modelo, Serie | Texto libre, sin validar duplicados | 66 y 50 llenos |
| `FECHACOM` D | Fecha de Compra | Sin validación. **Es la fecha que decide desde cuándo se deprecia** (§4.2) | 2021 a 2023-10 |
| `GARANTIA` C35 | Garantía | Texto libre | 3 llenos |
| `VCOMPRA` N12.2 | Valor de la Compra | Al salir recalcula `VDEPRE = VCOMPRA - VRESIDUAL` y `CUOTADEP = VDEPRE / NCUOTAS` | > 0 en 143 |
| `VRESIDUAL` N2 | Valor Residual | Idem. **Campo de 2 dígitos sin decimales** | 142 en cero, 1 desbordado (`**`) [D] |
| `VDEPRE` N12.2 | Valor a Depreciar | Calculado: costo menos residual | 142 de 143 = costo − residual |
| `NANOS` N12.2 | No. de Años | Al salir: `NCUOTAS = NANOS × 12` y recalcula `VDEPRE`, `CUOTADEP` | 140 con 2 años, 1 con 3, 1 con 4, 1 con 8 |
| `NCUOTAS` N12 | No. de Cuotas | Solo lectura (= años × 12) | 143 = años × 12 |
| `CUOTADEP` N12.2 | Depre. Mensual | `VDEPRE / NCUOTAS`; al salir también fija `CUOTAANU = CUOTADEP × 12` y vuelve a calcular `CUOTADEP` (**lo que el usuario teclee se pisa**) | 142 de 143 coinciden con `(costo − residual)/cuotas` a 2 decimales |
| `CUOTAANU` N12.2 | Depre Anual | Solo lectura (= mensual × 12) | 143 |
| `PORCEN` N5.2 | Porcentaje | **Se teclea; ningún cálculo lo usa** | 132 de 143 = 100 / años; 9 en cero |
| `CTAACTIVO`, `CTADEPRE`, `CTAGASTO`, `CTAPERAF` C14 | Cta. Contable del Activo / de Depreciación / del Gasto / Pérdida del Activo | Editables **solo si `CFG_CONTA`** (de `BANCOCFG.MEM`) es verdadero; validan contra `CATALOGO` de CONTAC (§3.2) | 143 llenos los tres primeros; `CTAPERAF` en 3 |
| `CCOSTOC` C3 | Centro de Costo Contable | Existe en `CCOSTO` **de CONTAC**; `*` abre búsqueda; en blanco se permite | 143 válidos (5 distintos) |
| `EMPLEADO` C10 | Responsable del Activo | Opcional; existe en `EMPLEADO`; `*` abre la lista | 105 llenos, 105 válidos |
| `OBSERVACIO` memo | Observaciones | Texto libre | — |
| `VACUMULA` N12.2 | Depreciación Acumulado | Solo lectura; **lo actualiza la corrida** (§6) | **no confiable** (§6.2) |
| `DEANTACUM` N12.2 | Depreciación Acumulado Anterior | Solo lectura; en realidad guarda **la última cuota aplicada**, no un acumulado anterior | = última cuota en 131 de 143 |
| `SALDODEPRE` N12.2 | Saldo a Depreciar | Solo lectura; `VDEPRE − VACUMULA` al correr | no cuadra con las líneas en 143 de 143 |
| `NCUOTADE` N10 | (sin etiqueta) | Contador de cuotas aplicadas (+1 por corrida) | no cuadra con las líneas (§6.2) |
| `DEPRE` L | Activo Depreciado | Solo lectura. **Ningún programa lo pone en verdadero** | 143 en falso |
| `FACTURA`, `DPREANUAL`, `VACTUAL`, `TDEPRE`, `DEPREACUM` | — | No aparecen en pantalla ni en ningún programa | vacíos / cero en los 143 |

### 3.2 Validaciones (todas "blandas")

Las validaciones muestran un aviso y mueven el cursor, **pero no impiden grabar** (el `Valid` no devuelve falso, salvo las cuentas):

| Campo | Mensaje literal [V] |
|---|---|
| Código vacío | "Codigo no puede quedar en blanco" |
| Código repetido | "Activo ya Registrado" (carga el existente) |
| Área inexistente | "Centro de Costo no existe" |
| Clasificación inexistente | "Centro de Costo no existe" (mismo texto, copiado) |
| Proveedor inexistente | "Código de proveedor no Existe.." / "Digite [*] para ayuda" |
| Responsable inexistente | "Empleado no existe" |
| Cuenta inexistente | "Cuenta No Existe!" (bloquea) |
| Cuenta que no es de detalle | "Cuenta no es de detalle!" (bloquea) |
| Cuenta vacía | "Debe Especificar la Cuenta Contable" (**no bloquea**: el `Valid` devuelve verdadero) |
| Centro de costo contable inexistente | "Centro de Costo no Existe" (limpia el campo); el texto de error de la caja es "Tipo de comprobante ya existe!" (copia) |

No se valida: costo mayor que cero, años mayor que cero (con `NANOS = 0` la fórmula divide por cero), fecha de compra, residual menor que costo, ni que las cuentas estén llenas.
Entonces un activo puede quedar **sin cuentas** y la corrida genera igual una línea con cuenta en blanco. En los datos no pasó: los 143 tienen cuentas existentes y de detalle [V][D].

### 3.3 Valor residual

`VRESIDUAL` está definido como `N(2,0)`: **no cabe un residual con centavos ni uno de 100 o más** (se guarda `**`). El cálculo en pantalla usa la variable en memoria (correcta), así que
`VDEPRE` y `CUOTADEP` sí quedan bien, pero el residual guardado no es confiable [V][D]: 142 en cero y 1 desbordado, cuya cuota guardada corresponde a un residual real distinto de cero.
**Nueva plataforma:** residual como dinero con dos decimales; al migrar, `salvage = costo − VDEPRE` (no `VRESIDUAL`).

### 3.4 Dos "centros de costo"

El activo tiene **dos** campos de centro de costo [V][D]:
`CCOSTO` (C10) es un catálogo propio del módulo (`CCOSTOa`, 8 vivos): sirve de **área o ubicación** y es el eje de los reportes. `CCOSTOC` (C3) es el centro de costo **contable** de CONTAC (`CCOSTO`, 5 filas)
y es el que se escribe en la línea de gasto de la partida. **Nueva plataforma:** `fa_locations` (áreas) y `cost_center_id` → `gl_cost_centers`.

### 3.5 Cuentas por activo, no por clasificación

Las cuatro cuentas se capturan **activo por activo** (la clasificación no las trae). En datos hay 7 cuentas de activo, 7 de depreciación acumulada y 10 de gasto distintas para 143 activos.
Además, una de las 7 cuentas de activo y una de las 7 de depreciación acumulada son de tipo gasto en el catálogo (`TIPOCTA` 4) [D]; puede ser una convención del cliente (¿activos que se llevan a gasto y se controlan aparte?).
**Nueva plataforma:** cuentas por omisión en la categoría; el activo las copia al crearse y puede cambiarlas (pregunta 24); la corrida **congela** las cuentas usadas en cada línea (así lo hace `MOVDEPRE.CTACARGO/CTAABONO`).

### 3.6 Cambios y eliminación

- "Modificar" copia la fila a memoria y "Grabar" la reescribe con `GATHER`. Cambiar el costo, los años, el residual o las cuentas de un activo **ya depreciado** no recalcula nada del pasado, y la cuota nueva se aplica
  a la siguiente corrida; como el control de término usa `VDEPRE − VACUMULA` (§4.3), el efecto es que **la vida restante cambia** [V].
- "Eliminar" marca la fila y **no mira si tiene líneas en `MOVDEPRE`** [V]. Las líneas quedarían huérfanas (en datos hay 0 huérfanas; los 143 activos vivos tienen sus líneas, salvo 2 de 2023-10 aún sin corrida).
- **Nueva plataforma:** sin borrado; un activo con depreciación solo se da de baja (§9). Al cambiar costo, vida o residual de un activo con líneas, se pide confirmar y se recalcula la cuota
  restante como `(valor depreciable − acumulado hasta el período) / cuotas restantes` (decisión a validar, pregunta 12); queda en bitácora.

## 4. Depreciación: la fórmula

### 4.1 Método

**Una sola: línea recta, mensual, por cuotas iguales** [V]. No hay otros métodos, ni por unidades de producción, ni saldo decreciente, ni factor, ni depreciación anual, ni tabla de tasas.
El "Porcentaje" y la "Depre Anual" son informativos [V].

```
valor a depreciar (VDEPRE)  = costo (VCOMPRA) − residual
cuotas totales (NCUOTAS)    = años (NANOS) × 12
cuota mensual (CUOTADEP)    = VDEPRE / NCUOTAS            (guardada con 2 decimales)
```

No hay prorrateo por días ni por mitad de mes [V].

### 4.2 Cuándo empieza

Un activo entra en la corrida de un mes si `FECHACOM <=` **último día de ese mes** (función `ultimo(AAAAMM)`) [V]. Por lo tanto:

- Un activo comprado **cualquier día del mes** deprecia **la cuota completa de ese mes** (no hay prorrateo). En datos: de los activos que ya depreciaron, 112 empezaron en el mes de compra, 25 un mes después y 4 dos meses después
  (porque se registraron tarde o su mes ya estaba corrido) [D].
- **No hay "puesta en servicio"**: la fecha de compra hace de fecha de inicio.
- **Un activo registrado tarde no recupera cuotas atrasadas**: en la primera corrida en que califica recibe **una** cuota. En datos, las 27 compras de 2021 (4 de 2021-11 y 23 de 2021-12) empezaron a depreciar en 2022-01, la primera
  corrida, sin las cuotas de 2021, y no hay forma de capturar la "depreciación acumulada anterior" porque el campo está bloqueado [V][D]. (Pregunta 5.)

### 4.3 Cuándo termina

La condición de entrada exige `VDEPRE − VACUMULA > 0` y `DEPRE` en falso [V]. En cada corrida:

```
restante = VDEPRE − VACUMULA
si restante >= CUOTADEP  →  cuota = CUOTADEP
si no, si restante > 0   →  cuota = restante            (la última cuota absorbe el redondeo)
si no                    →  cuota = 0                   (no genera línea)
```

Así que **termina por saldo, no por conteo de cuotas ni por fecha**; si la cuota tiene redondeo (por ejemplo 100 / 36), la última cuota queda distinta. Nunca se llega a depreciar más de `VDEPRE` [V].
En los datos ningún activo ha terminado (el menor plazo es de 24 meses y la primera corrida es 2022-01) [D], así que **la rama de la última cuota no se ha ejercido en producción**.
El indicador `DEPRE` ("Activo Depreciado") **no se actualiza nunca**; un activo terminado simplemente deja de aparecer en las corridas [V][D].

### 4.4 Qué pasa con meses no corridos y con activos que no deberían depreciar

- Las corridas pueden hacerse **en cualquier orden y con huecos**: el sistema solo prohíbe repetir el mismo mes. Como el término se controla por saldo, saltarse un mes **alarga la vida del activo en un mes** (no hay catch-up) [V].
  En datos, las 14 corridas son consecutivas, pero 2022-01 a 2022-09 se ejecutaron entre 2022-10 y 2022-11 (fecha de ejecución posterior al mes) [D].
- **Los activos "No Depreciables" (`ACTIVOD = 2`) no se excluyen** de la corrida (la consulta no mira `ACTIVOD`) [V]. En datos, **11 de los 13 activos no depreciables fueron depreciados** y el activo con tipo 0 también [D].
  Probablemente el cliente los marcó así para el reporte, no para la corrida. (Pregunta 9.) **Nueva plataforma:** el tipo se respeta (los no depreciables no entran).
- Un activo que se **vende o se da de baja** no tiene forma de salir salvo borrarlo o marcar `DEPRE` a mano: ver §9.

### 4.5 Redondeo

No hay `ROUND` en el código; todo se guarda en campos de 2 decimales [V]. `CUOTADEP` queda redondeada a centavos, de modo que `cuota × n` puede diferir de `VDEPRE` en unos centavos y la diferencia
la absorbe la última cuota (§4.3). **Nueva plataforma:** misma regla, con aritmética decimal exacta y redondeo "mitad hacia afuera" a 2 decimales; la última cuota es el saldo.

## 5. La corrida mensual ("Generar Partida de Depreciación", `ccpartco`)

### 5.1 Entradas

Año (por omisión el actual), mes (combo ENERO…DICIEMBRE, por omisión el actual), tipo de partida (2 caracteres; `*` abre la lista de `TIPOPAR`), número de partida (se propone; editable)
y fecha de la partida. Concepto general fijo: **"DEPRECIACION ACUMULADA DEL MES DE <MES> DEL <AÑO>"**. [V]

- Fecha por omisión = último día del mes; debe caer en el mes y año elegidos o responde "Digite la fecha Correcta"; vacía: "Debe especificar la fecha de la partida".
- Número propuesto (`signum`): el último número del tipo de partida en ese mes + 1, con ancho `@L 999999` (6 dígitos). Si no hay partidas, `000001`. La numeración es **por mes y tipo**, como en CONTAC (los 14 números de la
  corrida en disco se repiten entre meses) [V][D].
- El botón "Proceder" solo se habilita con tipo y número llenos.

### 5.2 Controles previos (mensajes literales)

| Control | Mensaje | Efecto |
|---|---|---|
| Año vacío | "Debe especificar el año a Consultar" | bloquea |
| Ya hay líneas en `MOVDEPRE` para ese mes (cualquier activo) | "DEPRECIACION YA FUE GENERADA, NO PUEDE GENERARLA DE NUEVO" | bloquea (se revisa al elegir año/mes y de nuevo al "Proceder") |
| El tipo de partida no existe | "TIPO DE PARTIDA NO EXISTE" | bloquea |
| El mes está cerrado en contabilidad (la primera partida del mes tiene `CERRADO`) | " MES CERRADO EN CONTABILIDAD..." | bloquea |
| Ya existe una partida con ese mes, tipo y número | "Partida ya existe; Desea Eliminarla" (No/Si) | Si: **borra la partida y sus líneas** en CONTAC (sin importar quién la creó) y sigue; No: vuelve |

El control "ya fue generada" mira `MOVDEPRE`, **no la partida**: si la corrida se interrumpió después de escribir `MOVDEPRE`, el mes queda bloqueado aunque no exista partida; si alguien borró `MOVDEPRE` a mano (como pasó con
2022-01, 02 y 03), el sistema deja correr otra vez [V][D]. **No existe anulación ni reverso desde el menú.**

### 5.3 Qué lee y qué escribe, en orden [V]

1. Lee `ACTIVO` con la selección de §4 (cuotas por activo).
2. **Escribe `MOVDEPRE`** una línea por activo con cuota > 0: `CODIGOA`, `SALFEC` (AAAAMM), `VALORDEP` (la cuota), `NUMERO`/`TIPOPAR` (la partida), `CONCEPTO`, `CTACARGO` = cuenta del gasto del activo,
   `CTAABONO` = cuenta de depreciación acumulada del activo, `FECHAD` = fecha de la partida, `USUARIOE`, `FECHAE` (hoy), `NCUOTA` (= `NCUOTADE` antes de sumar; **siempre 0 en los datos**), `CCOSTO` = centro de costo contable del activo.
   `ACTIVOA` nunca se llena (aunque el índice `salfec` es `salfec+activoa`).
3. Arma una partida de trabajo en dos tablas temporales **por usuario**, `pprov<usuario>` y `dprov<usuario>`, dentro de la carpeta de datos (se quedan ahí: hay dos pares en disco) (§7).
4. Llama a `cgadipar.prg` en modo 1 (agregar) con "sistema = 0" (§7.4). Eso escribe `PARTIDAS`, `DETAPART` y `SALDOS` de CONTAC.
5. **Actualiza cada `ACTIVO`** (§6.1).
6. "PROCESO FINALIZADO".

Si ningún activo califica, muestra "No Existen Lotes Procesados" y sale (texto copiado de otro módulo) sin tocar nada [V].
Ningún paso está dentro de una transacción; los pasos 2, 4 y 5 son independientes [V].

**Nueva plataforma:**
- Vista previa antes de grabar (lista de activos, cuota y total; mismo cálculo).
- Un registro de corrida por período (`fa_depreciation_runs`), único por empresa y período mientras esté vigente; líneas por activo.
- Todo (corrida, líneas, partida contable por contrato, actualización) en **una transacción**.
- **Anular** una corrida (reverso del libro mayor y marca `anulada`) solo si es la última del activo y el período está abierto; regenerar crea otra corrida. En el sistema viejo esto se hacía borrando filas a mano.
- No dejar correr un mes si hay un mes anterior sin corrida, salvo confirmación explícita (pregunta 6).

## 6. Depreciación acumulada: guardada vs recalculada

### 6.1 Cómo se actualiza el acumulado guardado [V]

Al terminar el posteo, el código recorre las líneas del mes y, para cada una, hace en `ACTIVO`: `DEANTACUM = cuota`, `NCUOTADE = NCUOTADE + 1`, `VACUMULA = VACUMULA + cuota`,
`SALDODEPRE = VDEPRE − VACUMULA`. **El `SEEK` al código del activo está comentado**: el `REPLACE` cae sobre el registro que esté activo en ese momento en `ACTIVO` (el mismo para todas las líneas), no sobre el activo de la línea.
`arregla.prg` (fuera del proyecto) es el script que lo repara: pone `DEANTACUM`, `NCUOTADE` y `VACUMULA` en cero, `SALDODEPRE = VDEPRE`, y reconstruye todo recorriendo `MOVDEPRE` **con el `SEEK` puesto**.

### 6.2 Lo que muestran los datos [D]

- **141 de los 143 activos tienen `VACUMULA` distinto de la suma de sus líneas de `MOVDEPRE`**. Los dos que coinciden son los dos sin líneas.
- La suma de `VACUMULA` de todos los activos **sí** es igual a la suma de todas las líneas: el total no se pierde, se reparte mal.
- El patrón es consistente con esto [I]: el defecto está en cada corrida; alguien ejecutó `arregla.prg` después de la corrida de 2022-10 (reconstruyendo todo desde `MOVDEPRE`: la mayoría de los activos quedó con ~10 de 14 cuotas
  y `NCUOTADE` 4 por debajo del número de líneas en 136 activos) y **las cuatro corridas de 2022-11 a 2023-02 cargaron su incremento completo sobre un solo activo** (el primero en el orden del índice por código), que ahora tiene un
  acumulado ~27 veces la suma de sus propias líneas, **9 veces su valor a depreciar** y `NCUOTADE` ~552 por encima de sus líneas.
- **Efecto real verificado:** ese activo **dejó de depreciarse después de la corrida de 2022-11** (tiene 8 líneas, la última de 2022-11, y no aparece en 2022-12 ni después), porque `VDEPRE − VACUMULA` quedó negativo. Los demás activos
  siguen con un acumulado guardado inferior al real, así que en el último tramo de su vida **depreciarían de más** (la cuota final los llevaría a un acumulado real mayor al valor a depreciar si nadie corre `arregla.prg`).
  Esto último es consecuencia lógica de la regla, no se observó en datos.
- `SALDODEPRE` tampoco coincide con `VDEPRE − suma de líneas` en ningún activo, y `DEANTACUM` (que por su etiqueta debería ser el acumulado anterior) guarda la última cuota.

### 6.3 Qué usan los reportes [V]

El reporte "Cuadro de Activo Fijo" **ignora `VACUMULA`**: calcula el acumulado a la fecha como `SUM(MOVDEPRE.VALORDEP)` de las líneas con `FECHAD <= fecha`, por activo, y el valor en libros como `VCOMPRA − acumulado`. Los otros
reportes no muestran acumulado. Por eso el contador no ha causado diferencias visibles en los reportes, solo en el término de la depreciación (§4.3).

**Nueva plataforma:** el acumulado **nunca se guarda**; es `SUM(fa_depreciation_lines.amount)` de corridas vigentes hasta el período (más un saldo inicial de migración si se acuerda, pregunta 5). La cuota restante y el término
se calculan con esa suma. No se migran `VACUMULA`, `DEANTACUM`, `SALDODEPRE` ni `NCUOTADE` (se recalculan). Prueba de paridad: valor en libros por activo y por grupo a cada fin de mes = costo − suma de líneas.

## 7. Contabilización (partida de depreciación)

### 7.1 Forma de la partida [V][D]

- **Una partida por mes** (tipo elegido por el usuario; en datos el mismo tipo en las 14), fecha = fin de mes (editable dentro del mes), concepto fijo.
- **Dos líneas por activo, sin agrupar**: (1) cargo a la **cuenta de gasto** del activo (`CTAGASTO`) con el **centro de costo contable** del activo; (2) abono a la **cuenta de depreciación acumulada** (`CTADEPRE`), **sin** centro de costo.
  Detalle de cada línea: "DEPRECIACION DE ACTIVOS <código> <MES> DEL <AÑO>". La versión agrupada por cuenta y mes está **comentada** en el código [V].
  En disco, 63 a 140 activos por mes → 126 a 280 líneas por partida [D].
- Las dos líneas llevan `TIPOMOV = 1`; en CONTAC 1 es cargo y 2 abono, así que **las líneas de abono quedan mal marcadas** (el importe sí va en la columna de abono) [V][D]. El importador no debe fiarse de `TIPOMOV`.
- La partida es cuadrada por construcción (el mismo importe a cargo y abono por activo). No hay verificación posterior.

### 7.2 Cómo se escribe

`cgadipar.prg` (rutina compartida con los demás módulos, parámetros: tabla de encabezado, tabla de detalle, modo, sistema) [V]:

1. Modo 1 (agregar): abre las dos tablas de trabajo, **borra de `PARTIDAS`/`DETAPART` cualquier partida con el mismo mes, tipo y número** (sin revertir `SALDOS`), anexa el encabezado y las líneas.
2. **Marca el origen** con `REPLACE generado WITH sistema`. El módulo pasa `sistema = 0`; el valor por omisión de la rutina sería 9. **Resultado en datos: `GENERADO = 0` en las 14 partidas** [V][D]. Es decir, **CONTAC no sabe que vienen de activo fijo
   y no las bloquea** (CONTAC bloquea las que tienen `GENERADO = 1`, de Bancos). Cualquier contador puede editarlas a mano.
3. Actualiza `SALDOS` por cada línea y por **toda la cadena de cuentas padre** (`CATALOGO.ANTERIOR`), con signo según tipo (activo, gasto y orden suben con cargo; el resto con abono).

### 7.3 Enlace entre corrida y partida

La única relación entre `MOVDEPRE` y la partida es la **llave natural** `SALFEC + TIPOPAR + NUMERO` (las tres columnas están en `MOVDEPRE`) [V]. No hay llave foránea, ni se guarda un identificador en la partida.
En datos las 14 combinaciones existen en `PARTIDAS` de CONTAC [D]. Si alguien cambia el número de la partida en CONTAC (`Cambiar número a un comprobante`) el vínculo se rompe sin avisar.

### 7.4 Defecto en la actualización de saldos [V]

`cgadipar.prg` busca y actualiza la fila de `SALDOS` con la variable **`mesact`** (el mes de trabajo del usuario) y no con el mes de la partida. Si la corrida del mes X se hace trabajando en el mes Y, el saldo se suma a Y. Como el sistema nuevo no guarda saldos
(se calculan desde las líneas), este defecto **no se reproduce**, pero explica diferencias de `SALDOS` contra el cálculo (ver `REPORTE.md`).

### 7.5 Datos: el libro no cuadra con la corrida en los dos últimos meses [D]

Para 12 de las 14 corridas (2022-01 a 2022-12) las líneas de la partida suman **exactamente** el total de `MOVDEPRE` (cargo y abono). En **2023-01 y 2023-02 el cargo y el abono de la partida son el doble** del total de `MOVDEPRE`, con unas 15 líneas más con
`TIPOMOV = 2` (captura manual) en cada una. Hipótesis [I]: el contador agregó o duplicó líneas a mano en CONTAC, o la corrida corrió dos veces contra la misma partida. Hay que preguntarlo (pregunta 21): la paridad contra el libro de esos dos meses no puede darse por buena.

### 7.6 Cuentas

- `MOVDEPRE.CTACARGO/CTAABONO` guardan **las cuentas usadas ese mes**, no las que el activo tiene hoy: en 6 de las 1,623 líneas la cuenta de abono ya no es la del activo (cambió después) [D]. Es lo correcto y se conserva.
- Todas las cuentas de los 143 activos existen en `CATALOGO` y son de detalle [D].
- La compra del activo, las mejoras y las bajas **no se contabilizan** desde el módulo; en CONTAC hay partidas manuales que tocan las cuentas de activo [D].

**Nueva plataforma (contrato con el libro mayor):**
- `gl.postEntry({ empresaId, source: 'activo_fijo', sourceRef: <id de la corrida>, period, entryTypeId, date, concept, lines })`. Hay que añadir `activo_fijo` a `GL_ENTRY_SOURCES` (hoy: `manual`, `bancos`, `iva`, `cierre`, `importado`).
- El tipo de partida sale de la configuración del módulo (no se teclea cada mes); el número lo asigna el libro mayor por tipo y período.
- Líneas **agrupadas** por (cuenta de gasto, centro de costo) y por cuenta de depreciación acumulada, con el detalle por activo en las líneas de la corrida (decisión abierta, pregunta 20); si el negocio quiere una línea por activo, se mantiene.
- El enlace es real: `fa_depreciation_runs.gl_entry_id` y `gl_journal_entries.source_ref`. Anular la corrida anula la partida (reverso) en la misma transacción.
- El período debe estar abierto en el libro mayor; la partida de origen `activo_fijo` no se edita a mano en el libro (solo se anula desde el módulo).

## 8. Reportes y consultas

Todos preguntan al final "pantalla o impresora" (`donde.spr`) y usan `foxypreviewer.app` como visor [V]. Todos filtran **activos vivos** (`SET DELETED ON`).

| Reporte | Filtros | Contenido | Observaciones [V] |
|---|---|---|---|
| **Listado de Activos** (`aflista` → `afrlista` si "Por Centro de Costo", `afrlist2` si "Por Clasificación del Activo") | Rango de áreas (`CCOSTO`), rango de clasificaciones, tipo (Todos / Depreciable / No Depreciable) | Código, nombre, modelo, fecha y valor de compra; cuentas de activo/depreciación/gasto y centro de costo contable (solo `afrlista`); responsable (solo `afrlist2`); totales por grupo y general | Con "Todos los Activos" el filtro es `... AND activod=1 OR activod=2`: por precedencia de operadores **ignora los rangos y trae todos los activos con tipo 2 y deja fuera los de tipo 0** |
| **Listado de Activo por Cuenta Contable** (`aflicta`) | Igual que el anterior | Agrupa por cuenta de activo con el nombre de `CATALOGO`; código, nombre, modelo, fecha, valor; subtotales por cuenta | Mismo defecto de precedencia. Al elegir impresora usa `afrlista` en lugar de `aflicta` |
| **Cuadro de Activo Fijo** (`aflistad` → `afrlistd`) | Fecha de corte (por omisión hoy); "Todo el Activo" o "Por Clasificación" (rango); tipo | Por área/clasificación: código, nombre, fecha de compra, valor de compra, residual, valor a depreciar, años (vida útil), **depreciación acumulada** y **valor neto en libros**; totales por grupo | Activos con `FECHACOM <= corte`. Acumulado = suma de `MOVDEPRE` con `FECHAD <= corte` (§6.3); el valor en libros = costo − acumulado (no resta el residual). Mismo defecto de precedencia. Las dos opciones usan el mismo diseño `afrlistd` |
| **Depreciaciones** (`afrdepre` → `afdepred` "Detallado" / `afdepre` "Resumido") | Mes y año "desde" y "hasta" (por omisión el mes actual) | Líneas de `MOVDEPRE` en el rango: fecha, tipo y número de partida, activo y nombre, cuenta de cargo, cuenta de abono, valor | Los selectores de área y clasificación se cargan pero no se usan. Ordena por activo |
| **Ver Depre** (botón en `afmacti`) | El activo en pantalla | Browse de sus líneas: código, fecha, valor, tipo y número de partida, cuentas | Solo lectura |
| **Ver Detalle** (botón en `ccpartco`, `verpa`) | Mes elegido; filtro por tipo de partida | Líneas del mes con activo y partida | Solo lectura |

**Nueva plataforma:** los cuatro reportes con los mismos filtros pero con el filtro de tipo corregido; el "Cuadro de activo fijo" a una fecha (con acumulado por suma de líneas, valor en libros =
costo − acumulado) más un renglón de **conciliación contra el libro mayor** por cuenta (activo y depreciación acumulada), que el sistema viejo no tiene.

## 9. Lo que no existe y habría que construir (o decidir que no)

Todo lo siguiente se buscó en el código y en los datos y **no existe** [V][D]. La fila indica qué propone el spec.

| Función | Estado en el legado | Propuesta |
|---|---|---|
| Baja / retiro / descarte | No existe. `CTAPERAF` (Cta. Contable Perdida del Activo) está en la ficha y en 3 activos, **sin uso** | `fa_disposals` con fecha, tipo (`baja`/`venta`/`siniestro`), importe de venta, acumulado al corte, valor en libros, ganancia/pérdida y partida por contrato. El activo deja de entrar en corridas desde el mes siguiente (o el mes de la baja: pregunta 14) |
| Venta con ganancia o pérdida | No existe | Ídem; las cuentas de ganancia/pérdida salen de la configuración |
| Revaluación | No existe | No se construye hasta que el negocio lo pida |
| Mejoras / adiciones | No existe (se registraría como otro activo o editando el costo) | Pregunta 15 |
| Traslado entre áreas o responsables | Solo se edita el campo, sin historial ni usuario | Registro de cambios en auditoría; historial de traslados opcional (pregunta 16) |
| Depreciación fiscal vs financiera | No existe: un solo plan por activo | Pregunta 7 |
| Cierre mensual/anual del módulo | No existe; solo se respeta el cierre de CONTAC (`CERRADO` de la partida del mes) | La corrida exige período abierto; el período lo cierra el libro mayor |
| Reverso de una corrida | No existe en el menú (se borraban filas a mano) | Anulación (§5.3) |
| Alta de activo con su asiento de compra | No existe | Fuera de alcance hasta decidir (pregunta 17) |
| Inventario físico / etiquetas | No existe | Fuera de alcance |

## 10. Programas y pantallas sobrantes (no migrar)

- `posteo.scx`, `posmov.prg`, `posteo.prg`: recalculan costos de **lotes de producción** con tablas de inventario (`lote`, `detalote`, `movimien`...) que **no existen en este módulo**. Copia de LOTE64; el menú no los invoca [V].
- `genxtab.prg` (indicador de avance), `valida.prg`/`intro` (login), `chg_colo`, `alerta`, `sino`, `simoros`, `nomoros`: infraestructura.
- Tablas sobrantes en `fuente`: `ADEPRE.DBF` (3 filas, forma de `MOVDEPRE` sin las últimas columnas), `DETA.DBF` (30), `LOT.DBF` (1), `FORMU.DBF` (1), `DTEMPB06.DBF` (vacía), `ERROR.DBF`, `FOXUSER.DBF`: ignorar.
- `pprov<usuario>`/`dprov<usuario>` (`B06`, `B25`) en `dbf`: restos de la última corrida de cada usuario (una partida de 1 fila y su detalle); no se migran.

## 11. Resumen de decisiones de la nueva plataforma

1. **Acumulado calculado**, nunca almacenado (§6.3).
2. **Corrida con vista previa, transacción única, anulable** (§5.3).
3. **Partida al libro mayor por contrato** con `source`/`source_ref` y enlace real; cuentas congeladas en las líneas (§7).
4. **Tipo "no depreciable" se respeta** en la corrida (§4.4).
5. **Cuentas por categoría** con excepción por activo; residual en dinero (§3.3, §3.5).
6. **Sin borrado**: baja con asiento, desactivación de catálogos (§3.6, §9).
7. **`empresa_id`** en todo; catálogos de áreas y responsables propios del módulo.
8. Mantener la regla de inicio (cuota completa en el mes de compra) y de término por saldo **hasta que el negocio decida otra cosa** (preguntas 4 a 7).
