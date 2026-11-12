# plan64 — Reglas de negocio

Extraídas de `access.prg`, `calcula.prg` (cálculo de cada línea de planilla), `renta.prg`, `rentaag.prg`, `isss.prg`/`isss2.prg`/`desisss.prg`/`deafp.prg`
(rutinas antiguas), `vacacion.prg`, `cierre1.prg`, `cualdia.prg`, `ultimo.prg`, `por.prg`, `cgadipar.prg`; de los formularios `config.scx`, `plmemp01.scx`,
`plgplan1.scx`, `plcplan1.scx`, `plmplan0..9.scx`, `plmplani.scx`, `plmpres1.scx`, `plmndes1.scx`, `plmtipin.scx`, `plmausen.scx`, `plasisdi.scx`,
`plmvaca.scx`, `plmplava.scx`, `plmplavq.scx`, `plagui01.scx`, `plmindem.scx`, `plmaum1.scx`, `plgprec.scx`, `plgdisco.scx`, `pldisco.scx`, `plgisss1.scx`,
`plgafp1.scx`, `plreanu.scx`, `plrentaa.scx`, `ccpartab.scx`, `cgselmes.scx`, `plmllave.scx`; del menú `MENU.MNX`/`MENU.MPR`; y de los reportes
`recibo2.frx`, `recant01.frx`. Las cifras salen de leer las tablas de `MCERP/plan64/dbf` y `MCERP/plan64/fuente` **solo como conteos y agregados**;
no se copió ningún dato de empleados, empresas ni importes.

Convenciones: **[V]** verificado en el código fuente; **[D]** verificado en los datos (estructura, conteos, rangos); **[I]** inferido (deducción, sin confirmar).
"Nueva plataforma:" marca dónde el sistema nuevo debe diferir a propósito.

> **Aviso legal.** Este documento describe **lo que hace el código viejo**. Toda tasa, tope, tabla, plazo o fórmula legal (ISSS, AFP, IVM, IPFA,
> INSAFORP, FSV, renta, aguinaldo, vacaciones, indemnización, horas extras, procuraduría) está marcada **"verificar contra la normativa vigente"**: no se
> afirma aquí ningún valor legal actual. Las tasas y topes están en `CONFIG.MEM` (datos del cliente, no copiados); lo que sí se cita son las constantes
> que el programa trae escritas en el código.

## 1. Cómo está armado el sistema

- Aplicación VFP aparte, con login propio (`access.prg` → `intro.spr`), elección de empresa (`selemp.prg`) y menú (`MENU.MPR`, generado de `MENU.MNX`) [V].
  El programa principal es `access.prg` (la única marca de "programa principal" del proyecto). `MENU.PRG` existe pero **no** está en el proyecto [V].
- `access.prg` restaura `CONFIG.MEM` (parámetros legales y de cálculo), `EMPRESA.MEM` y `MESES.MEM`, abre `EMPRESAS` y hace
  `SET PATH TO <camino>;<camino2>;<caminoiva>`. Por eso las pantallas abren tablas "sin ruta" que viven en otras carpetas: `CATALOGO`, `PARTIDAS`,
  `DETAPART`, `TIPOPAR`, `SALDOS` (de CONTAC). Las columnas de `EMPRESAS` son `CAMINO`, `CAMINO2`, `CAMINOIVA` (más `ISSSPAT`, `NIT`, `MONEDA`…) [V].
  En la copia, `EMPRESAS` trae 1 fila y `plan64/dbf` **no** trae `CATALOGO` ni `PARTIDAS` (solo copias temporales `DPROVV*`/`PPROVV*`) [D].
- **Varios patronos en una misma base.** `CODEMP` (3 caracteres) identifica a la empresa-patrono (`EMPRESA2`: nombre, NIT, número patronal de ISSS, giro,
  póliza). `MAESTRO`, `PLANILLA`, `DIVISION`, `CCOSTOS`, `MOVDESC`… llevan `CODEMP`; `DIVISION` y `CCOSTOS` cuelgan de ella (`codemp+division+ccosto`) [V].
  En la copia hay 1 patrono [D].
- **Período de trabajo** (`mesact`): cadena de 7 caracteres `AAAAMMQ` (año, mes, quincena 1 o 2), elegida en "Seleccionar Mes de Trabajo"
  (`cgselmes`) y guardada en `MESACT.MEM`; `mesactp` es el código del período fiscal (tabla `PERIODO`, 1 fila). Ese mismo valor es la clave de la corrida:
  `PLANILLA.FECPLA = AAAAMMQ` [V][D]. Cada pantalla de proceso (generar, calcular, modificar, imprimir, cerrar, banco, contabilizar) trabaja sobre el
  `mesact` vigente.
- **Usuarios y permisos.** `USUARIOS` (con banderas `NIVEL1…NIVEL4`, `NIVELA`, `NIVELP1/2`, `PRESTA`, `INGRE`, `DPRES`, `IMPRECIBO`, `CODEMP`, `DIVISION`) y `PERFIL`
  (usuario + nombre de pantalla → `PERMISO` lógico). **Casi toda opción del menú consulta `PERFIL`** y, si no hay permiso, muestra
  "Lo siento no tiene Acceso a esta opción" (un par de variantes escriben "opción"). Las pantallas **no** distinguen agregar/modificar/eliminar: solo
  abrir [V]. En `fuente/PERFIL` hay 266 filas vivas, todas con permiso verdadero, de 2 usuarios [D]. Algunas opciones no revisan `PERFIL`
  en el menú ("Cierre", "Generación de Planilla Única" y "Autorización de Llaves", esta última revisa dentro de sus sub-pantallas) [V].
  Las banderas `PRESTA/INGRE/DPRES/IMPRECIBO` de `USUARIOS` controlan acceso a préstamos, ingresos, descuentos y recibo [I].
- **Datos de sueldos: sin protección especial.** No hay cifrado ni permiso distinto para ver salarios; `plmemp01` los muestra a quien pueda abrir la pantalla [V].
- **No hay transacciones** (`BEGIN TRANSACTION` no aparece): los procesos largos (generar, calcular, cerrar, contabilizar) recorren las tablas fila por fila; si se
  interrumpen, quedan a medias [V]. **No hay bitácora de auditoría** de cambios de planilla: `plbitaau` solo lista aumentos salariales (`AUMENTOS`), y las tablas
  llevan `USUARIOC/M/E` y `FECHACRE` en parte de los catálogos [V].
- **Borrado:** `DELETE` es una marca. Quedan filas "borradas" (por ejemplo `PLANILLA` 3 de 498, `PLISSS` 844 de 3,031 porque cada regeneración borra y recrea) [D].
- **Dinero:** los importes de `PLANILLA` son `N(12,2)`; los cálculos intermedios se hacen en coma flotante sin redondear (p. ej. `ganado = salario_m/30*dias`) y VFP
  redondea al guardar en el campo; los redondeos explícitos son `ROUND(x,2)` (mitad hacia afuera). El porcentaje se convierte con `por(x) = round(x/100, 4)`: **una tasa
  con más de 2 decimales en el porcentaje se trunca a 4 decimales de fracción** [V].
- **Nueva plataforma:** `empresa_id` en toda tabla; importes como cadenas decimales exactas con una regla de redondeo explícita por concepto (no
  coma flotante); sin borrado físico (`is_active`, estado `anulada`); cada corrida con transacción y bitácora con antes/después; **salarios y datos personales
  detrás de un permiso propio (`payroll.salary`)**, no solo "poder abrir la pantalla"; un patrono = una empresa de la plataforma (§2.3).

## 2. Catálogos y maestro

### 2.1 Maestro de empleados (`MAESTRO`, `plmemp01`)

Pantalla con pestañas: datos personales, "Información Salarial", "Beneficiarios", "Información Académica", "Datos para Contrato", "Afiliación"; botones Ctas.
Contables, Ver Descuentos, Ver Ingresos, Contrato, Finiquitos, Cotización AFP, Transferencia. Solo se describe la **estructura**; el contenido es dato personal (ver [data-model.md](data-model.md) §1).

Reglas verificadas [V]:

- Clave: `CODIGO` (C15, único: "Código ya Existe !!!"). **En comentarios del código el código de empleado aparece con aspecto de documento de identidad y también como correlativo corto**;
  no se verificó en los datos (no se imprimen filas). Tratarlo como dato personal.
- Obligatorios: nombre; "Debe Digitar el Nombre del Empleado"; nombre según tarjeta del NIT y según tarjeta del ISSS (texto de error: "Debe Digitar el Nombre del Empleado
  Según Tarjeta del NIT" / "…del ISSS"); sexo "Debe ser (F) o (M)".
- Combos: estado civil (casado, soltero, acompañado, divorciado, viudo); **"Cotizar a:" `AFP, ISSS, IPFA, IVM, Ninguna` → `COTIZAR` 1…5** (§5.4); tipo de vacación (1 o 3 períodos).
- Banderas que cambian el cálculo: `EVENTUAL` (honorarios / eventual: sin ISSS ni pensión y renta plana, §6.6), `EXTRANJERO` (renta eventual con otra tasa), `COMI` (sueldo por
  comisión: promedios para vacación/aguinaldo/indemnización), `NOISSS` ("No calcular ISSS"), `NOAFP` ("No calcular AFP": **se lee pero el cálculo nunca la usa; no tiene efecto** [V]), `NORECAL`
  ("No hacer Recalculo" de renta semestral), `PJUBILADO` (usa otra tasa patronal de AFP: "Empleado en edad máxima para pensionar"), `PROCU` (retención de procuraduría del 30 %, §9.3),
  `PLAN_JUV` (descuento de "jubilación"/plan, §6.7), `SEGURO` y `SEG_FAM` (seguro médico y familiar), `OFICIAL`, `EJECUTIVO`, `NOAGUINALD`, `MCOMITE` (comité de seguridad: no se
  le puede generar indemnización), `USARDUI` (usar DUI en vez de NIT para declarar renta), `HORAPLAN`, `IMPCON`/`IMPRECIBO`.
- Pago: `TIPO_SAL` (1 = salario mensual, otro = por hora), `SALARIO_M`, `SALARIO_H`, `ESCALA`; cuenta y banco (`CUENTA`, `FBANCO`) para el depósito; `ANTICIPO`/`PANTICIPO` (% de anticipo).
- Cuentas contables **por empleado** (`CTAEMPL`, `CTAEXTRA`, `CTAVACA`, `CTAAGUI`, `CTARENTA`, `CTAISSS`, `CTAANTI`, `CTAAFP`, `PISSS`, `PAFP`, `PINSA`, `PPRISSS`, `PPRAFP`, `PPRINSA`, `CTACOSTO`) [V].
  **En la copia están todas vacías** (0 de 20) [D]: la empresa en disco no contabiliza desde este módulo (§11).
- Eliminar: bloqueado si hay historial ("No puede Eliminar, tiene record").
- Los 20 empleados de la copia son todos de salario mensual (`TIPO_SAL=1`, `SALARIO_H=0`), cotizan a AFP (`COTIZAR=1`, 2 AFP distintas), no hay eventuales, comisionistas, extranjeros ni
  con `PROCU`; 6 están liquidados (`FECHALI`); ingresos entre 2018-12 y 2023-07; 3 filas de `MAESTRO` están en blanco (sin código) [D].
- **Nueva plataforma:** un solo empleado por empresa, sin banderas redundantes; `NOAFP` no se migra como regla; las cuentas por empleado se reemplazan por un mapa de cuentas
  por concepto y centro de costo (§11); datos sensibles (documentos, cuentas, salud: `HIPERTEN`, `DIABETES`, `ALERGIA`, `OTRAENFER`) fuera del alcance de la primera versión
  o con permiso propio (pregunta 6.1).

### 2.2 Catálogos

| Catálogo | Tabla | Notas |
|---|---|---|
| Puestos | `CARGOS` (`CARGO` C2) | nombre, `GERENTE`, `IDEAL` y `MAXIMO` (rango salarial), funciones y herramientas (memos) [V]; 1 fila [D] |
| Agrupaciones de puestos | `AGRUPA` (`CODA` C3) | 3 filas [D] |
| Profesiones | `PROFESIO` | 9 filas [D] |
| Divisiones (departamentos) | `DIVISION` (`codemp+division`) | con cuentas de anticipos y de liquidación (`CTASANTICI`, `CTASLIQUID`); 2 filas, cuentas vacías [D] |
| Centros de costo | `CCOSTOS` (`codemp+division+ccosto` C6) | con 7 cuentas (`CUENTA`, `CTAVACA`, `CTAAGUI`, `CTAINDEM`, `CTAANTI`, `CTAAGUII`, `CTAANVACA`); 2 filas, cuentas vacías [D]. **No es el centro de costo del libro mayor** (C3, `ctacosto` del maestro) |
| AFP | `AFP` (`CODIGO` C2) | `COMISION` (% propio de cada AFP, se suma a la tasa del empleado), `CODSUPER` (código para el archivo de cotización), `CUENTA`; 4 filas, con cuenta y código [D] |
| Tipos de ingreso | `TIPOING` (`INGRESO` C2) | `CODIGOI` = **nombre de columna de `PLANILLA`** donde se acumula (§4.2); `CUENTA`; `CONSOLID` (consolidar en otro tipo). 8 filas, con 2 columnas distintas [D] |
| Tipos de descuento | `NOMDESC` (`CODDES` C2) | `CODIGOD` = nombre de columna de `PLANILLA`; `CODCTA`; `TIPODES`. 12 filas, con 3 columnas distintas [D] |
| Tablas de códigos (para el archivo de renta) | `TABLAI`, `TABLAD` | descripciones de `CODIGOI`/`CODIGOD`; 8 y 4 filas [D] |
| Estatus, bancos, alcaldías, capacitaciones, instituciones, funciones, firmas | `ESTATUS`, `BANCOS`, `ALCALDIA` (70), `CAPACITA`, `INSTITU`, `FUNCION`, `FIRMAS`, `FIRMAFI` | catálogos simples |
| Ingresos previos | `RECORI` (`empleado+ano`) | ingreso y renta del empleado en empleos anteriores (`INGRESOG`, `RENTAG`) y acumulado en este (`INGRESOSJ`, `RENTAJ`) para la renta semestral; 37 filas, 2021–2023 [D] |

Todos son CRUD "Anterior/Siguiente/Modificar/Eliminar/Agregar" con códigos obligatorios y únicos ("Código ya existe !!!", "Debe Digitar el Código!!!") [V].

### 2.3 Patronos

`EMPRESA2` guarda por patrono: razón social, nombre comercial y de correspondencia, NIT, giro, registro, **número patronal de ISSS** (`ISSSPAT`), póliza de seguro, y cuentas (`CTAISSS`, `CTARENTA`,
`CTARENTA10`, `CTAISSSS`, `CTAPAGUI`) [V]. `ISSSPAT` y `NIT` están llenos; las cuentas, vacías [D]. **Nueva plataforma:** cada patrono es una `core_empresas`; el número patronal y NIT son datos de la empresa
(pregunta 1.3).

## 3. Parámetros del cálculo (`CONFIG.MEM`, pantalla Configuración)

Pantalla `config` ("Configuraciones", menú Utilidades → Configuración → Sistema). Los valores viven en `CONFIG.MEM` (archivo de memoria por instalación, no por patrono ni por vigencia) y se cargan como
variables `cfg_*` al arrancar [V]. **No se copian los valores.** Lista de parámetros por nombre [V]:

| Grupo | Variables | Uso |
|---|---|---|
| Salario | `cfg_salmin` | "Salario Mínimo": identifica a quienes ganan exactamente el mínimo (días del mes en 2.ª quincena, §4.3) y fija topes de indemnización |
| Incapacidad | `cfg_incap`, `cfg_porcen` | "Calcular incapacidad a partir de día N" y "Porcentaje" a pagar después de ese día (§6.3) |
| ISSS (salud) | `cfg_tope`, `cfg_isssem`, `cfg_issspa` | tope y tasas empleado/patrono |
| IVM | `cfg_ivm`, `cfg_ivmem`, `cfg_ivmpa` | tope y tasas (pensión por ISSS) |
| FSV | `cfg_fsv`, `cfg_fsvem`, `cfg_fsvpa` | monto fijo mensual y tasas |
| AFP | `cfg_max` (tope), `cfg_afpemp`, `cfg_afppat`, `cfg_afppaj` (patronal de pensionado) | la comisión de cada AFP se suma al `cfg_afpemp` |
| IPFA | `cfg_ipfa` (tope), `cfg_ipfemp`, `cfg_ipfpat` | régimen alterno |
| INSAFORP | `cfg_insafo` | tasa patronal |
| Renta (mensual/quincena) | `cfg_rent1a…cfg_rent7d` | 7 tramos × (desde, hasta, cuota fija, %) |
| Renta 1.er semestre | `cfg_ren1as…cfg_ren7ds` | misma forma, para la regularización de junio |
| Renta 2.º semestre | `cfg_ren1aa…cfg_ren7da` | misma forma, para diciembre |
| Otras rentas | `cfg_rentae`, `cfg_rentaex` (eventual / extranjero, %), `cfg_rentag` (monto exento de aguinaldo) | |
| Otros | `cfg_jub` (% plan juvenil), `cfg_seguro`, `cfg_segfam` (montos fijos), `cfg_maxi` ("Máximo a indemnizar"), `cfg_hextdi`, `cfg_hextno` (declaradas, **sin uso** en el cálculo [V]) | |
| Modo | `cfg_q` ("Generar Planilla": quincenal / mensual), `cfg_color` | |

- Cualquier usuario con permiso a la pantalla `config` cambia los valores y **afecta a todas las planillas** futuras y a las recalculadas; no hay vigencia ni historial [V].
- Los **topes se multiplican por 2** en el código (`cfg_tope*2`, `cfg_ivm*2`, `cfg_max*2`, `cfg_ipfa*2`) para obtener el tope del mes completo; por eso los valores configurados parecen ser
  **topes de media quincena** y la tabla de renta se aplica **a la base de cada quincena**; `rentaag.prg` la multiplica por 2 para aplicarla a un salario mensual. **[I]**, no se verificó contra los valores del cliente (pregunta 3.1).
- Constantes **escritas en el código** (no configurables), todas "verificar contra la normativa vigente": mes de **30 días**; **240 horas** al mes para la hora ordinaria; multiplicadores de horas extras (§5.2);
  **30 %** de prima de vacaciones; **30 %** de retención de procuraduría; **10 %** de renta de honorarios en recibos; días de aguinaldo **15 / 19 / 21** (y **10 / 15 / 18 / 21** en recibos);
  **730 días** y **365 días** en indemnización; **305 días** mínimos entre vacaciones; código de país `9300` para "domiciliado" en el archivo de renta mensual; **8 horas** diarias en descuentos por tardanza.
- **Nueva plataforma:** todo esto pasa a tablas con **vigencia** (`effective_from`), por empresa, con bitácora y con versión inmutable aplicada a cada corrida (§5.4, [data-model.md](data-model.md) §3).

## 4. Tipos de pago y períodos

### 4.1 Lo que existe y lo que no

- **Mensual / quincenal [V]:** salario mensual fijo (`TIPO_SAL=1`), pagado **por quincenas** (1–15 y 16–fin de mes). `cfg_q` verdadero = 2 pagos completos al mes; falso = modo "mensual": la 1.ª quincena
  se genera ya calculada como **anticipo de 15 días** (`anticipado`, `calculo`) y la 2.ª paga el resto (`plgplan1`, rama `else` de `cfg_q`) [V]. Existe además "Modificar Planilla de Anticipo" (`anticipo`) y `ANTICIPO` en `MAESTRO`/`PLANILLA`.
- **Por hora [V]:** `TIPO_SAL` distinto de 1 usa `SALARIO_H`; `sueldo_m = sueldo_h × horas_t` (`horas_t` viene del campo `MAESTRO.VALOR`) y la pantalla "Horas Trabajadas" (`plmplan2`) captura horas en vez de días. **Sin uso en la copia** [D].
- **No existen** pago semanal, diario ni a destajo (piece-rate): no hay campo ni pantalla [V]. El pago "por horas" es el único alterno.
- La planilla corre **por patrono**, por división o centro de costo, por empleado o general (opciones General / C.Costo / Empleado / Empresa en generar, calcular, banco) [V].
- Hay otra planilla aparte, de **recibos de honorarios** (`EMPLREC`, `RECIBOE`, §10).

### 4.2 Estructura de una línea de planilla

`PLANILLA` guarda **una fila por empleado y por quincena** (clave `fecpla + codemp + codigo`), con ~130 columnas fijas: días trabajados, incapacidad, permisos, horas extras de 6 clases y su valor, vacaciones, ingresos
adicionales, ISSS/IVM/FSV/AFP/renta del empleado y del patrono, descuentos, `TOTINGRESO`, `TOTDES`, `SALNETO`, indicadores de estado (`CALCULO`, `IMPRESO`, `MODIFICADO`) y **unas 45 columnas con nombres de cuatro letras
(`DIA7`, `DIAE`, `COMS`, `REIN`, `FCAJ`, `EXAM`, `PTMO`…)** donde se acumula cada tipo de ingreso o descuento: el tipo apunta a su columna con `TIPOING.CODIGOI` / `NOMDESC.CODIGOD`, y el cálculo hace `REPLACE &columna WITH &columna + valor` [V].
**Dar de alta un tipo nuevo exige agregar una columna a la tabla** y, si el nombre no existe, el cálculo falla. En la copia solo se usan `COMS`, `REIN`, `EXAM`, `FCAJ` y `PTMO` [D].

**Nueva plataforma:** líneas de concepto normalizadas (`pay_run_items`), un renglón por concepto y empleado; los totales se derivan, no se almacenan en columnas fijas.

### 4.3 Días y fechas

- `cualdia(mes, 1|2, año)` da el primer y el último día del mes; `ultimo(AAAAMM)` el último día; el rango de la 1.ª quincena va del 1 al 15 y el de la 2.ª del 16 al fin de mes [V].
- Al generar: `sueldo_m = round(salario_m/30 × días, 2)` con **días = 15** para cualquier salario distinto del mínimo. Para quien gana **exactamente `cfg_salmin`**, en la 2.ª quincena los días siguen la longitud del mes:
  31 días → 16; si no, `longitud − 16`. **La pantalla de días trabajados (`plmplan3`) da otro resultado**: 28 → 13, 29 → 14, 30 → 15, 31 → 16. Las dos rutas no coinciden para meses de 30 días
  (14 vs 15) [V]. Inconsistencia a resolver (pregunta 4.2).
- `dias_trab = días del período − días de ausencia` (las ausencias de la quincena de `AUSENCIA.NDIAS`, §7); `dia_s_per` guarda los días sin permiso.
- Desglose manual de días (`plmplan3`): trabajados + incapacidad + permisos sin pago + permisos con pago + sin trabajar **debe sumar los días del período** o se bloquea Grabar: "NO CUADRAN LOS DIAS !!!" / "LOS DIAS NO CUADRAN" [V].
  `DASUETO` = días pagados por asueto.
- En `calcula`: `ganado = salario_m / 30 × dias_trab` (**el salario mensual del maestro, no el de la fila**, así que cambiar el salario del maestro después de generar cambia el cálculo al recalcular) y `sueldo_m = ganado`. Si la fila tiene
  vacación (`vac1` o `vac2` > 0) el sueldo ordinario de la quincena se pone en 0 y se paga la vacación [V].

## 5. Ingresos

### 5.1 Sueldo
Ver §4.3. `totingreso` suma todos los ingresos de la quincena (fórmula en §6.1).

### 5.2 Horas extras (`plmplan4`, "Horas Extras")
`hora` = `round(salario_m/240, 2)` (o `sueldo_h` si es por hora); el valor es `round(hora × horas × multiplicador, 2)`, calculado **al capturar en la pantalla** (no se recalcula en `calcula`; las líneas equivalentes están comentadas) [V]:

| Campo de horas | Pantalla dice | Multiplicador en el código |
|---|---|---|
| `h_ext_di` | Diurnas ("100 %") | × 2 |
| `h_ext_no` | Nocturnas ("125 %") | × 2.5 |
| `h_ext_50` | "50 %" | × 1.5 |
| `h_ext_75` | "75 %" | × 1.75 |
| `h_sext_1` | H. diurna descanso semanal | × 2.0 |
| `h_sextr_12` | H. extra nocturna descanso semanal | × 2.5 |

Verificar contra la normativa vigente (los rótulos "100 %/125 %" y los multiplicadores no son coherentes entre sí). En la copia: 8 filas con horas diurnas y 3 con nocturnas [D]; las otras 4 clases no se usan.
Todas las horas extras entran en el ingreso total, en la base de ISSS y en la de renta. **Nueva plataforma:** multiplicadores como parámetro con vigencia por tipo de hora; recálculo automático al cambiar el salario.

### 5.3 Otros ingresos
- **Ingresos adicionales** (`INGRESOS`, pantallas "Individuales" `plming01` y "Generales" `plgingg1`): por empleado, tipo (`TIPOING`), valor, `RENTA` y `ISSS` (¿es gravable para renta / base de ISSS?), cuenta contable. Se aplican en **cada** planilla mientras existan;
  los de `TIPO = 1` se **borran al cerrar** la planilla (§8.4) [V]. Cada aplicación genera una fila en `MOVING` (`tipoplan`, `fecpla`, valor, cuenta) y suma a la columna del tipo.
- Comisiones (`COMS`) y reintegros (`REIN`) son los dos tipos usados en la copia (`INGRESOS` 10 filas, `MOVING` 282) [D]. **No existen** viáticos, bonos ni comisiones como concepto propio: son tipos de ingreso que el cliente crea.
- `ING_ADI` es el total de ingresos adicionales de la fila; `INGRESO` el acumulado de la quincena [V].
- **Nueva plataforma:** `pay_concepts` con tipo (ingreso/descuento), bandera "sujeto a ISSS/AFP", "sujeto a renta", cuenta contable y orden; recurrencia explícita (una vez / cada quincena / hasta N veces).

## 6. Deducciones legales y aportes del patrono (tal como las calcula el código)

### 6.1 Bases
Para cada fila (`calcula.prg`) [V]:

```
dia           = round(sueldo_m_fila / 30, 2)        (sueldo_m_fila = lo que trae la fila al empezar; ver duda abajo)
ganado        = salario_m(maestro) / 30 × dias_trab
totingreso    = vacindem + indemni + aguindem + ganado + remvac + horas extras (6 clases)
                + vac1 + vac2 + rem_per + ing_adi + rem_inca + aguinaldo
                (después: totingreso = totingreso + ingreso   # otros ingresos de INGRESOS)
masisss       = ingresos con bandera ISSS − descuentos con bandera ISSS      (los de tardanza/ausencia llevan ISSS y RENTA)
masrenta      = ingresos con bandera RENTA − descuentos con bandera RENTA
base_ISSS     = totingreso + masisss − (aguinaldo + indemni + aguindem)
```

**Duda [I]:** `dia = round(m.sueldo_m/30, 2)` usa el `sueldo_m` de la fila, que al generar vale el sueldo de **15 días**; dividir ese monto entre 30 daría medio día. Eso afectaría la remuneración de incapacidad y permisos (`rem_inca`, `rem_per`).
En la copia `DIA_INCAP` ≠ 0 en 3 filas y `REM_INCA` es 0 en todas; `DI_C_PERNP` ≠ 0 en 1 fila [D]. No se pudo confirmar cuál era la intención (pregunta 4.3).

### 6.2 ISSS (salud), IVM, FSV e INSAFORP
No se calculan si el empleado es eventual (todo el bloque) ni si `NOISSS`. Con `T2 = cfg_tope × 2` [V]:

- **1.ª quincena (o modo mensual):** si `base_ISSS ≤ T2`: `isss = round(base × tasa_emp, 2)`, `isss_pat = round(base × tasa_pat, 2)`, `insa = round(base × cfg_insafo, 2)`; si no, lo mismo sobre `T2`.
- **2.ª quincena (acumulado del mes):** `misss1`, `renisss1`, `issspatq1`, `insaq1` son la base y los importes de la 1.ª quincena, copiados al generar. Sea `acum = base_ISSS + misss1`:
  si `acum ≤ T2` el aporte es `tasa × base de esta quincena`; si `acum > T2` el aporte es `round(T2 × tasa, 2) − lo retenido en la 1.ª quincena` (0 si la base de la 1.ª ya alcanzó el tope). Así el mes nunca supera el tope aunque cada quincena se calcule por separado.
- `siisss` = base de ISSS de la fila (para el archivo/planilla de ISSS). Si `base_ISSS ≤ 0` todo es 0.
- **FSV:** `fsv = round(cfg_fsv/30 × cfg_fsvem % × dias_trab, 2)` y `fsv_pat` igual con la tasa patronal; **no depende de los ingresos**, solo de los días; con `dias_trab = 0` es 0. Se descuenta del empleado (`totdes`) [V].
- En el caso del régimen que cotiza a IVM por el ISSS (`COTIZAR = 2`) la retención de pensión es `isssivm` (empleado) e `isssivmp` (patrono) con tope `cfg_ivm × 2` (§6.4).
- Las rutinas viejas `isss.prg`/`isss2.prg`/`desisss.prg` están fuera de uso (no se llaman desde `calcula`) [V].

### 6.3 Incapacidad (`rem_inca`)
Con `dia` de §6.1 [V]:

- Si `dia_incap < cfg_incap`: continua (`inca_cont`) → `round(dia × cfg_porcen % × dia_incap, 2)`; si no → `round(dia × dia_incap, 2)` (100 %).
- Si `dia_incap ≥ cfg_incap`: continua → `round(dia × (cfg_incap − 1), 2)`; si no → `round((cfg_incap − 1) × dia, 2) + round(dia × cfg_porcen % × (dia_incap − cfg_incap + 1), 2)`.
- La remuneración de incapacidad entra en el ingreso total y en la base de renta y de ISSS. "Permisos remunerados" (`rem_per = round(dia × di_c_perpg, 2)`) también.
Qué parte de la incapacidad la paga el ISSS y cuál el patrono, y los días de carencia: **verificar contra la normativa vigente**.

### 6.4 Pensiones (`COTIZAR`) [V]
Base: la misma `base_ISSS`. Topes: `cfg_max × 2` (AFP), `cfg_ipfa × 2` (IPFA), `cfg_ivm × 2` (IVM). Redondeo `round(…,2)` en cada importe.

| `COTIZAR` | Régimen | Empleado | Patrono |
|---|---|---|---|
| 1 AFP | AFP | `afp_empl = base × (cfg_afpemp + AFP.comision)`; `comision` se guarda aparte | `afp_pat = base × cfg_afppat` (o `cfg_afppaj` si `PJUBILADO`) |
| 2 ISSS | IVM por ISSS | `isssivm = base × cfg_ivmem` (tope `cfg_ivm×2`) | `isssivmp = base × cfg_ivmpa` |
| 3 IPFA | IPFA | `afp_empl = base × (cfg_ipfemp + comisión)` (tope `cfg_ipfa×2`) | `afp_pat = base × cfg_ipfpat` |
| 4 IVM | IVM con tasas IVM guardadas en campos de AFP | `afp_empl = base × (cfg_ivmem + comisión)` | `afp_pat = base × cfg_ivmpa` |
| 5 Ninguna | — | — | — |

Notas [V]: el caso 4 compara el tope con `cfg_ipfa2` pero calcula con `cfg_max2`; el caso 3 en modo no-`RENTATO` duplica `cfg_ipfa` antes de calcular `cfg_ipfa2` (posible doble escala). Estos detalles solo importan si algún cliente usa IPFA/IVM (en la copia todos son AFP).

### 6.5 Renta (retención) [V]
`pa_renta` (base de renta de la fila) =
`vacindem + aguindemv + ganado + remvac + rem_inca + horas extras (6) + rem_per + vac1 + vac2 + ing_adi + aguinaldov + masrenta − afp_empl − isssivm − isss`,
donde `aguinaldov = max(0, aguinaldo − cfg_rentag)` (la parte exenta no entra) salvo eventuales (todo el aguinaldo). **El FSV no se resta** de la base. (`aguindemv` tiene una línea escrita como resta sin asignación: nunca toma valor [V].)

**Tabla:** siete tramos `cfg_rentNa` (desde) ≤ base ≤ `cfg_rentNb` (hasta); `renta = cuota fija (c) + round((base − desde) × % (d), 2)`; el tramo 1 es exento (renta 0). Si la base no cae en ningún tramo, la renta es 0.
Los límites se comparan con `>=` y `<=` sobre un valor **sin redondear**; si los tramos configurados dejan un hueco (p. ej. entre 472.00 y 472.01), una base intermedia queda sin tramo y paga 0 [I].
La tabla se aplica **a la base de la quincena** (§3). `renta.prg` es la misma tabla como función (usada fuera de `calcula`).

**Recalculo semestral (junio y diciembre, 2.ª quincena, salvo `NORECAL`)** [V][I]:
- Al generar la 2.ª quincena de junio o diciembre, `plgplan1` pone a cero y vuelve a sumar en `RECORI` (`INGRESOSJ`, `RENTAJ`) el acumulado del año (suma de `p_renta` y `renta` de todas las filas anteriores del año, sin eventuales).
- En `calcula`, si hay ingresos acumulados (propios o de empleos anteriores: `INGRESOG + INGRESOSJ ≠ 0`), la renta de esa quincena es `tabla_semestral(base + ingresos acumulados) − (rentas acumuladas)`, nunca negativa;
  junio usa la tabla "1.er semestre" (`cfg_ren…s`) y diciembre la "2.º semestre" (`cfg_ren…a`) y además resta `renagui` (renta del aguinaldo). Sin acumulado se usa la tabla normal.
- **Defectos del código [V]:** en el tramo 7 de junio se usa `cfg_rent7c` (tabla mensual) en lugar de `cfg_ren7cs`; en el tramo 7 de diciembre se usa `cfg_rent7a` como cuota fija y `planilla.renagui` en vez de `m.renagui`; el tramo 1 de diciembre no asigna cero.
- La intención de "regularizar" a mitad y a fin de año (en vez de un ajuste anual único) y el significado exacto de los campos `g`/`j` de `RECORI` están **inferidos**; confirmar con el contador (pregunta 3.4).

**Eventuales (honorarios/eventual)** [V]: `renta = pa_renta × cfg_rentae %` (o `cfg_rentaex %` si extranjero) `− renagui`; sin ISSS ni pensión; se marca `RENEXT`/`REVENE`.
**Nueva plataforma:** tablas de renta con **vigencia** y período (mensual, quincenal, semestral), versionadas; el cálculo guarda con la corrida la tabla usada; el ajuste de fin de año se modela explícitamente (acumulado anual, no tres tablas); las rentas retenidas son por empleado y año en una tabla propia.

### 6.6 Aguinaldo, vacaciones e indemnización dentro de la quincena
`aguinaldo`, `renagui`, `liquidoa`, `vprocua` se cargan de `AGUINALD` solo en la 2.ª quincena de **diciembre** (`mex=12`, `q=2`); `indemni`, `vacindem`, `aguindem`, `antindem` de `INDEMNI` en la 2.ª quincena del mes de la liquidación [V].
Esos montos entran en `totingreso` pero **se restan otra vez en `totdes`** (`renagui + vprocua + liquidoa` y `antindem`) porque se pagan por la planilla de aguinaldo / el finiquito, no con el sueldo [I].
Detalle de cálculo en §9.

### 6.7 Otras deducciones de ley o de empresa dentro de `totdes` [V]
`totdes = antindem + isss + fsv + renta + descuento (tipos de DESCUENT) + desc_adi + prestamos + interes + coperativa + afp_empl + isssivm + renagui + vprocua + liquidoa`
`+ jubilacion (si PLAN_JUV: round((totingreso − rem_inca) × cfg_jub/100 con cfg_jub/100 redondeado a 2 decimales, 2))`
`+ seguro (cfg_seguro, no se cobra cuando el mes de la planilla es julio) + seguro familiar (cfg_segfam, igual) + anticipo + ava1 + ava2`.
`salneto = totingreso − totdes − horasdes`. `horasdes` es el descuento por tardanza (§7.2): **resta del neto pero no está dentro de `totdes`**, y las filas de reporte lo muestran aparte [V].
En la copia, 2 filas no cumplen la identidad `totingreso − totdes − horasdes = salneto` por más de un centavo [D].

## 7. Ausencias, permisos, incapacidades y asistencia

- **Ausencias** (`AUSENCIA`, `plmausen`): concepto Permiso / Incapacidad / Ausencia / Suspensión / Retiro, fechas inicial y final, quincena, `NDIAS = fecha final − inicial + 1`, y dos formas de descuento: por **días** `sueldod = salario_m/30 × ndias` o por **minutos de tardanza**
  `deshorat = (salario_m/30)/8/60 × minutos`. Mensajes: "EMPLEADO NO EXISTE !!!", "EMPLEADO NO PERTENECE A ESA DIVISION !!!", "Fechas Incorrectas", "CODIGO DE DESCUENTO NO EXISTE" [V]. Tabla vacía en la copia [D].
- Al generar la planilla, las ausencias de la quincena con `ndias > 0` bajan `dias_trab`; las que traen `deshorat > 0` crean (o actualizan) un **descuento** en `DESCUENT` de un solo uso para esa quincena con `RENTA` e `ISSS` verdaderos y `valor1 = deshorat` [V].
- **Asistencia diaria** (`CONTROLD`, `plasisdi`): banderas por empleado y día (ausencia, permiso, día libre, incapacidad, trabajó, almuerzo, cena, vacación) y minutos de llegada tarde. Registra, no calcula la planilla [V]; 4 filas [D].
- **Incapacidad**: ver §6.3. **Permisos** (`PERMI`), **amonestaciones** (`AMONESTA`), **capacitaciones** (`CAPACITA`, `MOVCAPA`…), contratos y finiquitos son módulos de RR. HH. sin efecto en el cálculo; todos vacíos o casi [D].
- **Nueva plataforma:** ausencias con tipo (con/sin pago, incapacidad ISSS, suspensión) que alimentan la corrida; la asistencia diaria y RR. HH. quedan fuera del alcance inicial (pregunta 1.2).

## 8. Ciclo de vida de una corrida (planilla)

Todo se hace sobre el `mesact` (7 caracteres) y por quincena. Estados implícitos en banderas de cada fila: **generada** (existe) → **modificada** (`MODIFICADO`) → **calculada** (`CALCULO`) → **cerrada** (`IMPRESO`) [V].

### 8.1 Generar (`plgplan1`, "Generación")
Por General / Centro de costo / Empleado / Empresa. Crea una fila por cada empleado activo: `FECHALI` vacía y `FINACTIVO` vacío o posterior al inicio del período [V]. Copia del maestro: centro de costo, división, patrono, seguro, plan juvenil,
seguro familiar, horas (`VALOR`), ejecutivo, "oficial" (1 o 2). Si ya existe y **no** está cerrada pregunta "YA EXISTEN DATOS PARA LA FECHA SELECCIONADA" (`verifica.spr`) y, si se acepta, **borra y recrea**; si está cerrada: "NO PUEDE GENERAR PLANILLA, YA FUE CERRADA" [V].
Además: trae vacaciones de la quincena (`vac1`/`vac2`, `ava2`), la indemnización (2.ª quincena), el aguinaldo (diciembre 2.ª), los valores de la 1.ª quincena para el tope de ISSS (2.ª quincena), el recalculo semestral de `RECORI` (junio/diciembre) y las ausencias (§7).

### 8.2 Novedades (`plmplan1`, "Modificación de Planilla")
Menú de transacciones: **Ingresos** (Días/Horas trabajadas, Horas extras, Vacación, Otros ingresos, Salarios, Indemnizaciones) y **Descuentos** (Cooperativa, Otros descuentos, Anticipos, Ausencias). Cada captura valida que el empleado exista y esté en la planilla:
"Código de Empleado no Existe !!!", "Empleado no Registrado en Planilla !!!" [V]. Los descuentos de cooperativa (`coperativa`), otros (`desc_adi`), anticipos (`anticipo`) se escriben directo en la fila.

### 8.3 Calcular (`plcplan1`, `calcula.prg`)
Reglas de §4–§7. Por cada fila: **borra y reconstruye** las filas de `MOVDESC` y `MOVING` de la quincena (restablece los `aplicado` de descuentos/ingresos/préstamos), vuelve a aplicar todo y regraba la fila. Se puede repetir las veces que haga falta mientras no esté cerrada: si está cerrada,
"No puede Calcular, Planilla ya Cerrada"; si no existen filas: "NO EXISTEN DATOS PARA LA FECHA SELECCIONADA" [V]. Muestra el avance ("Calculando Planilla . . .") y termina con "PROCESO FINALIZADO!".

### 8.4 Cerrar ("Cierre")
Confirmación "Seguro de Cerrar Planilla". Si hay filas sin calcular: "PLANILLA NO HA SIDO CALCULADA". Si no, por cada fila (`cierre1.prg`) [V]:
1. **Préstamos** (`PRESTAMO`): `saldo −= valor`; si la cuota que sigue es la última (`cuotas = prox_cuota + 1`) la cuota pasa a `ult_cuota` y `prox_cuota = 0`, si no `valor = cuota` y `prox_cuota += 1`; `fecades = ffinpag`; `aplicada` verdadera.
2. **Descuentos** (`DESCUENT`): `numdee += 1` y `aplicado` verdadero.
3. **Ingresos** (`MOVING`): `aplicado` verdadero.
4. La fila queda `IMPRESO = verdadero` (cerrada).
Después: actualiza `MAESTRO.ULTVACA` (próximo aniversario de vacaciones) para las vacaciones de ese mes; recorre `DESCUENT` y, cuando `numdee ≥ numdes`, **desactiva** el descuento si es "programado" o lo **borra**; **borra todos los ingresos adicionales de `TIPO = 1`**;
e imprime los listados de revisión salarial y de vacaciones programadas del mes siguiente [V]. No avanza el mes de trabajo.

- **No existe "reabrir"** ni en el menú ni en el código: una planilla cerrada solo se puede cambiar editando las tablas a mano o reabriendo la bandera `IMPRESO` por fuera del sistema [V]. **Nueva plataforma:** corrida **inmutable** una vez cerrada; correcciones por una corrida de ajuste que referencia a la original; reapertura solo con permiso de supervisor y bitácora.
- Los cálculos del cierre no están en transacción (§1). En la copia, la única quincena abierta es la última (2023-07, 2.ª) con 14 filas; las 47 anteriores están cerradas [D].
- **Qué se guarda por corrida:** solo `PLANILLA` (resultado final) más `MOVDESC`/`MOVING` (movimientos aplicados). No se guarda la tabla de renta ni las tasas usadas, ni el usuario que calculó o cerró.

### 8.5 Impresión y reportes de la corrida
"Impresión" (`pliplan1`, planilla por centro de costo), "Planilla Mensual" (`pliplanm`), "Planilla con Prestaciones" (`pliplapr`), "Planilla de Cotización" (`pliplanp`), "Planilla Ingresos Excel" (`pliplaex`), "Verificar…" (`consulta`, `activas`). **Boleta de pago** (`recibo2.frx`, "RECIBO DE PAGO"):
período, días, ingresos (sueldo, horas extras, otros), descuentos (ISSS salud + FSV, AFP, ISSS-IVM, renta, cooperativa, seguro médico, anticipos, descuentos adicionales), subtotales, "Líquido a Recibir", firma "RECIBI CONFORME" [V]. Para eventuales los rótulos cambian a "Honorarios".

## 9. Aguinaldo, vacaciones, indemnización y provisiones

> Todas las fórmulas de esta sección son **lo que hace el código**; la normativa (días por antigüedad, prima, base de cálculo, topes) debe confirmarse ("verificar contra la normativa vigente").

### 9.1 Vacaciones (`vacacion.prg`, `plmvaca`, `plmplava`, `plmplavq`)
- Fórmula `vacacion(fec_propor, fecha_ult, fecha_ini, salario_m, %, días)`: si el ingreso es anterior a la fecha de proporcionalidad, `round(salario_m/15 × días × %, 2)`; si no, `(salario_m/15 × días × %) / 365 × (fecha_ult − fecha_ini)` redondeado. El % por defecto está en `PORVACA.MEM`.
- "Generar Planilla de Vacaciones" (`plmvaca`, tabla `VACACION`): período de vacación = año posterior a `ULTVACA`; mensajes "No puede Generarle vacacion a ese Empleado, ya fue pagada" (si el año pedido ≤ año de `ULTVACA`) y "No puede Generarle vacacion, no ha cumplido el año" (si faltan más de 305 días: `fecha − ULTVACA < 305`).
  Guarda sueldo de medio mes, días, %, remuneración y `SUELDOA` (anticipo de vacaciones). La fecha final no puede ser menor que la inicial: "LA FECHA FINAL NO PUEDE SER MENOR QUE LA INICIAL".
- En la planilla, la vacación reemplaza el sueldo de la quincena (`vac1`/`vac2`), con `remv` (prima) y `ava2` (anticipo ya pagado) que se descuenta.
- "Cálculo de vacaciones en 1 período / en 3 períodos" (`plmplavq`/`plmplava`): para los empleados con `TIPOVACA` y aniversario en el mes, calcula `mvaca = salario_m/30 × 7 × 30 %` (la pantalla asigna 7 días pero graba 15 en la planilla: incoherente [V]). Para comisionistas, el salario base es el promedio de los últimos hasta 12 registros de ingresos variables:
  `round(suma(ing_adi + ingreso) / (13 × n) × 30, 2) + salario_m`, con `n` = quincenas disponibles (la tabla del código usa 13 días por quincena) [V]; el porqué de 13 está **inferido** (15 menos dos días de descanso).
- Otros: "Generar Depósito de Vacaciones" (`plicarva`), "Imprimir Planilla de Vacaciones", "Programación de Vacaciones" (`PVACA`), reporte de proyección de vacaciones. Tabla `VACACION` vacía en la copia [D].

### 9.2 Aguinaldo (`plagui01`, tabla `AGUINALD`, año)
- Se genera una fila por empleado activo que no tenga `NOAGUINALD` ("Generar Planilla"; pasos aparte: imprimir planilla, recibos, carta, exentos/gravados). Si ya existen filas del año, **las borra y regenera** [V].
- Antigüedad a la fecha de corte **12 de diciembre**, contada desde `FECHAAG` (+1 día): menos de 1 año → `salario_m/30 × 15 / 365 × días`; 1 a <3 años → **15** días de salario; 3 a <10 años → **19** días; 10 años o más → **21** días (`aguinaldo = round(salario_m/30 × días, 2)`) [V]. (En los recibos de honorarios los tramos son 10/15/18/21: no coincide, pregunta 5.3.)
- `PROCU`: retención de procuraduría del **30 %** del aguinaldo (`vprocu`) [V].
- Para comisionistas el salario base es el promedio de junio a noviembre con la misma tabla de 13 días por quincena (§9.1).
- Renta del aguinaldo (si se marca "Aplicar Renta" y `aguinaldo ≥ cfg_rentag`): base = salario mensual menos ISSS (con su tope ×2) y menos la pensión del régimen que cotiza; `renta = rentaag(base)` (tabla × 2), `rentaa = rentaag(base + aguinaldo − cfg_rentag)`;
  `renagui = rentaa − renta`; `liquido = aguinaldo − renagui − vprocu`. Eventuales: `rentaa = aguinaldo × cfg_rentae %`. Si no, renta 0 [V].
- Se puede **editar el monto** del aguinaldo por empleado ("Editar Aguinaldo") y recalcular renta. En la copia hay 7 filas, solo del año 2021 [D].

### 9.3 Indemnización / liquidación (`plmindem`, tabla `INDEMNI`, cuotas `PINDEMNI`)
- No se puede generar a un empleado del comité de seguridad: "No puede generar Indemnizacion,Empleado pertenece al comite de Seguridad". Se llega por `CODIGO + año + mes`; puede calcularse **solo indemnización**, **solo vacación proporcional** o ambas [V].
- Tiempo laborado `tlaboral = fechali − fechaind + 1` (días). Sueldo base `sueldom`: `salario_m`; para comisionistas, el promedio variable de §9.1 sumado al salario.
- **Indemnización:** *retiro voluntario* (`retvolunta`): si `tlaboral ≥ 730` días: según el sueldo respecto al mínimo (`cfg_salmin`): ≤ mínimo → `round(cfg_salmin/2, 2) × round(tlaboral/365, 2)`; entre 1× y 2× el mínimo → `round(sueldom/2, 2) × años`; > 2× el mínimo → `cfg_salmin × años`; si no llega a 730 días → 0.
  *Despido / otros:* `inder = min(sueldom, cfg_maxi)`; `indemi = round(tlaboral/365 × inder, 2)`; si trabajó menos de un año y `sueldom < cfg_maxi`, el mínimo es medio sueldo [V].
- **Vacación proporcional:** `diasv = fechali − ultvaca + 1`; `montova = (sueldom/2 + sueldom/2 × 30 %) × diasv/365` [V]. **Aguinaldo proporcional:** días por antigüedad 15/19/21 (o `15/365` si menos de un año, con mínimo 15); en diciembre (12-dic a 31-dic) la proporción se cuenta desde el 12 de diciembre, si no desde el 1 de enero; `montoa = (round(sueldom/30 × días, 2) × días_proporcionales) / 365` [V].
- ISSS y pensión sobre `montova + sueldop` con los mismos topes; renta: base `montova + (montoa − afp_empl) + sueldop`, mismas tablas (o tasa plana para eventuales). `procu` = 30 % del total si `PROCU`. `totalin = indemi + montova + montoa`; `totalde = isss + afp_empl + renta + …` [V].
- Estados de cada liquidación (`AUTORIZADA`, `GENERADA`, `APROBADAR`, `APLICADAP`) y **pago en cuotas** (`PINDEMNI`: número de cuota, valor, fecha, cheque) con reportes de cuotas, carta y cálculo. Se imprime constancia con fecha obligatoria: "Debe digitar la Fecha de la impresion de constancia".
  Las 16 liquidaciones de la copia son de 2016–2017, ninguna autorizada ni generada ni aplicada [D]. La planilla trae el monto en la 2.ª quincena del mes y lo "paga" aparte (§6.6).
- **Nueva plataforma:** liquidación como corrida propia con causa de terminación (renuncia, despido, mutuo acuerdo…), fórmulas parametrizadas con vigencia, estado y aprobación.

### 9.4 Provisiones
**El código no calcula provisiones mensuales** de aguinaldo, vacaciones o indemnización: no hay tabla ni proceso que acumule el devengado. Lo más cercano son cuentas contables en el maestro y en `CCOSTOS` (`CTAAGUI`, `CTAVACA`, `CTAINDEM`, `CTAAGUII`, `CTAANVACA`) que **la partida de planilla no usa** (solo usa las del maestro), y las provisiones patronales de ISSS, AFP e INSAFORP
que sí se contabilizan (§11) [V]. Pregunta 5.5.

## 10. Planilla de recibos (honorarios)

`plgprec` genera, para los registros de `EMPLREC` (empleados "por recibo", sin liquidar), un recibo mensual (`RECIBOE`, correlativo propio): monto = salario mensual; prima de vacaciones en el mes de vacaciones (`salario/2 × 30 %`); en diciembre, aguinaldo con tramos 10/15/18/21 días;
**renta = 10 % de (monto + vacación + aguinaldo)**, líquido = lo demás [V]. `plmrecib` captura/edita recibos y `plicarec` imprime la "Carta de recibo de honorarios". Ambas tablas de la copia: `EMPLREC` 2 filas, `RECIBOE` 0 [D]. **Nueva plataforma:** modelarlo como empleado de tipo honorarios (retención configurable) dentro de la misma corrida.

## 11. Contabilización (partida contable)

Opción "Generar Partida Contable" (`ccpartab`) [V]:

- Escribe **directo** en las tablas del libro mayor de CONTAC (`PARTIDAS`, `DETAPART`, `SALDOS`) mediante la rutina compartida `CGADIPAR.PRG` (modo 1 = adición). No pasa por contrato: copia estructuras temporales (`pprov<usuario>`, `dprov<usuario>`) y las anexa.
- Parámetros que digita el usuario: quincena, mes y año, **cuenta de pago neto** (`ctag`), cuentas de ISSS y AFP (se piden pero las líneas usan las del maestro), **tipo y número de partida**. El número lo escribe el usuario; si ya existe: "Partida ya existe; Desea Eliminarla" y la **borra físicamente** con todas sus líneas.
  Fecha de la partida: último día del mes. Concepto: "PLANILLA DE SUELDOS CORRESPONDIENTE AL MES DE <mes> <año>" (no menciona la quincena). Líneas por empleado (cuentas del **maestro**) y por tipo de ingreso/descuento (cuenta del tipo o del movimiento):

| Concepto | Cargo | Abono |
|---|---|---|
| Sueldo (`sueldo_m − horasdes`) | `ctaempl` | |
| Horas extras diurnas + nocturnas | `ctaextra` | |
| Vacación (`remvac`) | `ctavaca` | |
| Anticipo | | `ctaanti` |
| AFP empleado | | `ctaafp` |
| ISSS empleado + IVM | | `ctaisss` |
| Renta | | `ctarenta` |
| Provisión ISSS patronal | `pisss` | `pprisss` |
| Provisión AFP patronal | `pafp` | `pprafp` |
| Provisión INSAFORP | `pinsa` | `pprinsa` |
| Descuentos (por tipo/movimiento) | | cuenta del descuento |
| Otros ingresos (por tipo) | cuenta del ingreso | |
| Neto a pagar | | `ctag` (la que digita el usuario) |

- Si la cuenta exige centro de costo (`catalogo.pcosto`) se pone el `ctacosto` del maestro (3 caracteres, el del libro mayor).
- **Lo que no se contabiliza [V]:** FSV (se descuenta pero no tiene línea), horas extras de las otras cuatro clases, incapacidad y permisos remunerados, vacaciones `vac1`/`vac2`, aguinaldo, indemnización, préstamos aplicados desde `PRESTAMO`. Por eso **la partida puede salir descuadrada** y el programa no lo valida [I]. Sí se contabilizan las provisiones patronales de ISSS, AFP e INSAFORP.
- La llamada pasa `sistema = 0`: la partida **no queda marcada** como generada por Planilla; no hay vínculo entre la corrida y la partida (ni número en `PLANILLA`) [V]. Se contabiliza por mes y quincena a pedido; nada impide contabilizar dos veces ni dejar quincenas sin contabilizar.
- **En la copia no se usa:** las cuentas del maestro, de `CCOSTOS`, de `DIVISION`, de `TIPOING`, de `EMPRESA2` están vacías (solo `AFP.CUENTA` y 2 de 31 descuentos traen cuenta) y `plan64/dbf` no trae partidas [D].
- **Nueva plataforma:** la corrida **cerrada** publica una partida (`source = 'nomina'`, `source_ref = run_id`) mediante el contrato del libro mayor; el vínculo corrida ↔ partida es real (`pay_runs.journal_entry_id` o tabla de publicaciones), único e idempotente; el mapa de cuentas es por **concepto × centro de costo × empresa** (no por empleado); la partida debe cuadrar al publicarse, con una línea de diferencia por redondeo rechazada; las provisiones (aguinaldo, vacaciones, indemnización) son una decisión pendiente (pregunta 5.5).

## 12. Pagos

- **Depósito bancario** ("Subir al Banco", `plgdisco`): genera un **archivo Excel (.xls)** con una fila por empleado de la planilla que tenga cuenta (`CUENTA` del maestro): `cuenta`, `nombre`, `salneto`, `concepto`, `email`, `eeventual`. El concepto es
  "SALARIO PRIMERA QUINCENA MM-AAAA" o "SALARIO SEGUNDA QUINCENA MM-AAAA". Filtros: completa / fijos / eventuales. El usuario elige carpeta y nombre. Dos listados: empleados **sin** cuenta y empleados **con** depósito [V].
  Archivos de muestra `BAC.TXT`, `PCBACQ.TXT`, `PLANOV.TXT` en `fuente` son de un formato anterior de texto con `;` y 6 campos (cuenta de 10–11 dígitos; nombre; vacío; monto con 2 decimales; código de 3 dígitos; texto de concepto con quincena y año); el código vivo no los genera [D].
  **El layout exacto de cada banco no está en el código**: la copia solo produce Excel genérico.
- **Efectivo / cheque:** no existe pago con cheque ni integración con Bancos: el módulo no abre tablas de Bancos (`MOVIBAN`, `DETABANK`) ni emite cheques [V]. El único dato de cheque es `PINDEMNI.NCHEQUE` (texto libre).
- **Boletas:** §8.5. **Recibo de anticipo** (`recant01.frx`): "Por : <monto>", "San Salvador, <fecha en letras>".
- **Nueva plataforma:** archivos de transferencia por banco (formato configurable, pregunta 8.1) y/o orden de pago al módulo de Bancos mediante contrato (`source = 'nomina'`), con el estado de pago por empleado.

## 13. Archivos y reportes oficiales

### 13.1 Planilla de ISSS (archivo ASCII)
`plgisss1` ("Generación de Planilla") llena `PLISSS` (una fila por empleado y mes: `CODIGO` C10, `SALARIO`, `HORAST` 8, `DIAST`, `CODOBSV`, `SALFEC` AAAAMM, `MONTOVAC`, `DIASVAC`, `PADICION`, `CODEMP`) a partir de las dos quincenas del mes, sin eventuales:
`salario` = suma de `sueldo_m`; `padicion` = (`siisss` − (`sueldo_m` + vacaciones)) cuando la base de ISSS supera el sueldo (ingresos extra); `montovac` = vacaciones; `diast` = días trabajados (30 → días reales del mes; con vacación se restan los 15/16 días de vacación); `diasvac` = 15 o 16; `codobsv` = "00".
Si ya existe el mes pregunta "PLANILLA YA FUE GENERADA, DESEA HACERLO DE NUEVO" y borra la anterior [V]. Los códigos de observación no se documentan en el código (pregunta 8.2).

`pldisco` ("Generar Disco para ISSS") escribe `LCisss.txt` y lo copia al destino elegido. **Layout verificado en el código y contra los archivos de muestra de la carpeta (longitud fija 102, líneas sin separador)** [V][D]:

| Posición | Largo | Contenido |
|---|---|---|
| 1 | 9 | número patronal de ISSS del patrono (`EMPRESA2.ISSSPAT`, primeros 9) |
| 10 | 6 | período `AAAAMM` |
| 16 | 3 | correlativo de planilla, fijo `001` |
| 19 | 9 | número de ISSS del empleado (`000000000` si no tiene) |
| 28 | 40 | nombre según tarjeta del ISSS (`ISSSNAME`) |
| 68 | 9 | salario ordinario × 100 = `salario − (padicion + montovac)`, ceros a la izquierda |
| 77 | 9 | ingresos adicionales × 100 (`padicion`) |
| 86 | 9 | vacaciones × 100 (`montovac`) |
| 95 | 2 | días de cotización |
| 97 | 2 | horas (8) |
| 99 | 2 | días de vacación |
| 101 | 2 | código de observación |

`pldisco2` ("Generación de Planilla Única") es otra variante sin revisión de permisos [V]. `plmisss`/`plmisss2` permiten agregar o corregir empleados a mano en `PLISSS`; `plriss01` imprime la planilla. **Nueva plataforma:** validar este layout con el formato vigente del ISSS antes de implementarlo (pregunta 8.2).

### 13.2 AFP
- `plgafp1` ("Transferir Planilla AFP"): no genera archivo de entrega; **vuelca a tablas externas** (`F:\wspplan\planilla` y `planafil`, unidad fija) con `cod_admini` (código de la AFP o "ISSS"), `cod_afilia` (número de afiliado), `cod_emplea` (NIT del patrono), año, mes, `mon_plaafi` (suma de `totingreso`), `dia_plaafi`, `hor_plaafi` = 8 [V]. Depende de un sistema externo (SEPP u otro) que no está en el código ni en la carpeta; flujo **obsoleto o por confirmar** (pregunta 8.3).
- `plrafp` ("Descuentos de AFP's") y `plrafp2` ("Impresión de Planillas AFP's") son reportes impresos; `deafp.prg` es una rutina vieja sin uso [V]. No se encontró un archivo de cotización AFP con layout fijo producido por el código vivo.

### 13.3 Renta anual (F910) y archivo de renta mensual
- **`plreanu` "Generar F910"** (año): por empleado acumula 12 meses de `p_renta + afp_empl + isss` (base mensual), `afp_empl` y `renagui + renta` (retenciones), más aguinaldo exento y gravado (por `cfg_rentag`), `isss`, `afp`, IPSFA/CEFAFA/bienestar, y lo graba en `RENTAPL` (una fila por año y NIT/DUI según `USARDUI`);
  código de tipo de renta: `01` permanente, `11` eventual, `33` eventual extranjero, `60` sin renta retenida, `70` indemnizaciones (solo con la opción "Indemnizaciones") [V]. Salida: **Excel** o **texto de ancho fijo (SDF)** con nombre por defecto `f910.txt`. Layout del texto [V]:

| Campo | Largo | Nota |
|---|---|---|
| nombre | 40 | nombre según tarjeta del NIT/ISSS |
| NIT | 14 | |
| código de renta | 2 | |
| monto sujeto (base de renta) | 15 | importe × 100, ceros a la izquierda |
| otros ingresos / bonificaciones | 15 | **error:** se calcula con el valor de `cefafa` en vez de `iboni` |
| renta retenida | 15 | |
| aguinaldo exento, aguinaldo gravado | 15 + 15 | |
| ISSS, AFP, IPSFA, CEFAFA, bienestar magisterial | 15 × 5 | |
| 12 meses × (gravado, retenido, AFP) | 15 × 36 | orden enero…diciembre: gravado, retención, AFP |
| período (año) | 4 | |

  Total 40 + 14 + 2 + 15 × 46 + 4 = 750 caracteres por línea (46 campos numéricos de 15). Las cifras se arman con `STR(x*100)`; con coma flotante puede haber desvíos de 1 centavo. En la copia `RENTAPL` guarda 339 filas de los años 2013–2019 (no del período de planilla actual) y `RENTA` 14 filas de 2023-07 [D].
- **`plrentaa` "Archivo de renta mensual"** (Excel): por empleado y mes: domicilio (1 = país, 2 = otro), código de país (`9300` si está vacío, escrito en el código), nombre, NIT/DUI, tipo (`01/11/33`), ingresos, otros, renta retenida (incluye `renagui`), aguinaldo exento/gravado, AFP, ISSS, INPEP, IPSFA, CEFAFA, bienestar, IVM, período `MMAAAA` [V]. Se llena `RENTA` y se exporta a `.XLS`.
- **Constancias** (`plrcon1…4`): "Constancia Anual" de retención, de salario, de trabajo y para el Ministerio de Trabajo; texto en letras (`enletra.prg`, `fechalet.prg`).
- Otros reportes: ISSS descuentos, Renta mensual/anual, ingresos gravados y renta retenida, renta original y retenida, horas extras, descuentos digitados, sueldos por género, "Listado para aseguradora", "Reporte de Vialidad" (descuento a vialidad), "Empleados sin cuentas contables", cumpleaños, etc. (unos 50 reportes en el menú; solo se leyeron a fondo la boleta, el anticipo y el listado de cargos; el resto se describe por su título).
- **Nueva plataforma:** estos archivos se generan **por demanda** desde las corridas cerradas (no se almacenan en tablas intermedias como `RENTA`/`RENTAPL`), con una versión de layout por año; cada archivo generado queda registrado con huella (fecha, usuario, corrida de origen).

## 14. Descuentos y préstamos

- **Descuentos individuales / generales** (`plmdesc1`, `plgdesg1`, tabla `DESCUENT`): por empleado, tipo, `numdes` (cuotas totales), `numdee` (cuotas descontadas), `valor1` (monto por planilla), `qi1`/`qi2` (se aplica en la 1.ª y/o 2.ª quincena), `programado` (queda inactivo al terminar en vez de borrarse),
  `desactivar`, `isss`/`renta` (afecta bases), `referencia` (20 caracteres: parte de la clave), cuenta [V]. El cálculo los aplica mientras `numdes ≠ numdee` y `desactivar` sea falso. 31 filas vivas en la copia; `MOVDESC` 216 [D].
- **Préstamos** (`plmpres1`, tabla `PRESTAMO`, vacía): código de empleado, tipo de descuento, número, monto, cuotas, interés (`INTERES`), fechas de otorgamiento/vencimiento/primer pago, forma, razón, cuota, última cuota, saldo, próxima cuota, cuenta. Cuota por defecto `monto / cuotas`; última cuota `monto − cuota × (cuotas − 1)`.
  Validaciones: "NUMERO DE  PRESTAMO NO ES VALIDO !!!", "EL MONTO DEBE SER MAYOR QUE CERO (¢0.00)" (el símbolo es el del colón, de otra época), "Cuota establecida no es correcta" (si `(cuotas − 1) × cuota > monto`). **El interés se captura pero el cálculo siempre lo toma como 0** [V].
- **Embargos judiciales, pensión alimenticia, sindicato, órdenes bancarias:** **no existen** como concepto propio; si hacen falta se crean como tipos de descuento (`NOMDESC`) y se asocian a una columna fija. `PROCU` (30 %) solo aplica a aguinaldo e indemnización; "Reporte de Vialidad" lista un descuento específico [V].
- Saldos: se llevan en el propio registro (`saldo`, `numdee`), no hay tabla de abonos; la historia de aplicaciones está en `MOVDESC` (borrada y recreada en cada cálculo hasta el cierre).
- **Nueva plataforma:** instrucciones de descuento con saldo derivado de aplicaciones (`pay_deduction_applications` por corrida), prioridades y topes (por ejemplo, embargos), y préstamos con tabla de amortización que respeta el interés si se usa.

## 15. Aumentos salariales, llaves de autorización y mantenimiento

- **Aumentos** (`plmaum1`, tabla `AUMENTOS`, vacía): por empleado, fecha, porcentaje o valor, efectivo desde; aplicar cambia `MAESTRO.SALARIO_M` y guarda `SAL_ANT` y `FECHAAU`. Mensajes: "Empleado no existe", "Fecha no puede quedar en blanco", "Salario no puede quedar a Cero" [V]. "Actualizar salarios" (`actu`) es un `BROWSE` libre que permite editar `SALARIO_M` sin bitácora [V]. Existe "Programación de Revisión Salarial" (`PAUMENTO`) y la "Bitácora de Aumentos Salariales".
- **Llaves de autorización** (`LLAVE` 10 filas, `plmllave`, y las columnas `ULLAVE1/2/A/3`, `LLAVE1/2/A/3`, `FECHA1/2/A/3` de `DESCUENT`, `INGRESOS`, `AUMENTOS`, `VACACION`, `INDEMNI`): esquema de firmas (dos llaves + autorización + tercera llave) con pantallas para "Descuentos, Ingresos, Aumentos, Vacaciones, Indemnización" [V].
  **El cálculo de planilla no exige las llaves** (la condición `ingresos.llave3` está comentada); sólo registran quién y cuándo [V]. Pregunta 6.2.
- Cambiar código de empleado (`plchgcd`), transferir empleados entre patronos (`plmtremp`, `TRASLADO`), reindexar (`reindex`): utilidades técnicas o de mantenimiento.

## 16. Controles de integridad que hoy no existen

- Sin llaves foráneas: división, centro de costo, AFP, banco, cargo y tipos pueden quedar huérfanos; en la copia hay 1 código en `PLANILLA` que no está en `MAESTRO` (filas de la planilla de empleados borrados o sin código) y 33 filas de `PLANILLA` sin código de empleado (3 por quincena, en 11 quincenas entre 2023-02 y 2023-07, sin importes) [D].
- Sin validación de que `salneto` ≥ 0 ni de que los topes no se excedan en total del año.
- Doble "verdad" del acumulado de renta: `RENTA`, `RENTAPL` y `RECORI` se llenan por procesos distintos.
- Sin validación de cuadre de la partida de planilla (§11).
