# plan64 — Planilla (legacy spec)

Extraído del sistema MCERP (Visual FoxPro 9), carpeta `MCERP/plan64`.
Proyecto vivo: `PLANILLA.PJX` (el más completo; `}.PJX` está vacío). Programa principal: `access.prg`. Menú principal: `MENU.MPR` (generado de `MENU.MNX`).
Target en la nueva plataforma: módulo `payroll` (hoy un esqueleto sin `empresa_id`), que publica la partida de costos al libro mayor mediante contrato y,
si se decide, pide los pagos a `banking`. Piezas que van a la plataforma: empresas, usuarios, permisos, período de trabajo.

Documentos:

- [business-rules.md](business-rules.md) — reglas de negocio extraídas del código (cálculo de ISSS, pensiones, renta, aguinaldo, vacaciones, liquidación, cierre, contabilización, archivos oficiales)
- [data-model.md](data-model.md) — tablas legadas, modelo propuesto (`pay_`), cambios al esqueleto y notas de migración
- [open-questions.md](open-questions.md) — decisiones pendientes para el negocio y lista de tablas legales por verificar

> Este spec describe *qué hace* el sistema, no copia el código. **No contiene datos de empleados, de empresas ni importes** (solo estructura, conteos de registros, textos de menú y lógica).
> Los valores de `CONFIG.MEM` (tasas y topes del cliente) no se copiaron: se nombra cada parámetro, no su valor. Las constantes que el programa trae escritas en el código sí se citan, siempre marcadas
> "verificar contra la normativa vigente". **Marca:** **[V]** verificado en el código, **[D]** verificado en los datos (estructura/conteos), **[I]** inferido.

## 1. Qué hace el módulo y para qué negocio

**Planilla (nómina) de El Salvador por quincenas**, para una o varias empresas-patrono en la misma base [V]. Cubre:

- Maestro de empleados con salario mensual (o por hora), régimen de pensión (AFP, ISSS-IVM, IPFA, IVM o ninguno), AFP elegida y cuentas de banco; catálogos de patronos, divisiones, centros de costo, puestos y tipos de ingreso y descuento.
- La **corrida quincenal**: generar → capturar novedades (días, horas extras, vacaciones, ingresos y descuentos) → calcular (ISSS, IVM, FSV, AFP, INSAFORP, renta con regularización de junio y diciembre) → imprimir boletas → cerrar.
- **Aguinaldo anual, vacaciones, indemnización/liquidación (con pago en cuotas) y planilla de recibos de honorarios.**
- **Salidas oficiales y bancarias:** planilla de ISSS en archivo ASCII de 102 posiciones, archivo de renta mensual y F910 anual (Excel o texto de ancho fijo), constancias, archivo de depósito bancario en Excel.
- **Contabilización**: una partida resumen por mes escrita directo en el libro mayor de CONTAC.
- Adicionalmente un conjunto de funciones de **recursos humanos** (contratos y finiquitos, capacitaciones, amonestaciones, permisos, asistencia, horarios, cumpleaños, análisis de gastos y premios) que no intervienen en el cálculo.

**¿La empresa en disco lo usa? Sí.** 20 empleados mensualizados de 1 patrono; **48 quincenas, de 2021-07 (1.ª) a 2023-07 (2.ª)**, la última sin cerrar; ISSS generado hasta 2023-07; todos cotizan a AFP; sin eventuales, comisionistas, extranjeros ni empleados por hora [D].
Las liquidaciones de la copia son de 2016–2017 y el aguinaldo solo de 2021. **No contabiliza desde el módulo** (ninguna cuenta contable configurada) ni paga con cheque [D]. Otros clientes pueden usar lo que esta copia no ejercita (horas extras, vacaciones, préstamos, eventuales, honorarios).

### Dónde están los datos
`MCERP/plan64/dbf` (262 archivos) trae las tablas del módulo; `MCERP/plan64/fuente` trae el código, las tablas del sistema (`EMPRESAS`, `USUARIOS`, `USREMP`, `PERFIL`) y los `.MEM` (`CONFIG.MEM` con tasas, topes y tablas de renta; `MESACT.MEM` con el período de trabajo).
`EMPRESAS` trae las rutas `CAMINO`, `CAMINO2` y `CAMINOIVA` y `access.prg` hace `SET PATH` con ellas, así que el código abre sin ruta tablas de CONTAC (`CATALOGO`, `PARTIDAS`, `DETAPART`, `TIPOPAR`, `SALDOS`) [V]. En la copia **no hay datos de CONTAC dentro de `plan64`**;
la paridad de la contabilización necesita una copia consistente de `CONTAC` del mismo cliente y fecha (ver [REPORTE](../REPORTE.md)). Detalle en [data-model.md](data-model.md).

## 2. Proyecto vivo

Proyecto: `PLANILLA.PJX`. Entradas leídas con `vfp.py`: **182 formularios `.scx`** (de 243 en la carpeta), **149 reportes `.frx`** (de 203), **62 programas `.prg`** (de 113), **8 consultas `.qpr`**, **3 menús** (`menu.mnx`, `menun.mnx`, `menunew.mnx`; `plintro3` hace `DO menu.MPR` y deja comentados `menun` y `menu2`), 172 `.spr` (casi todos *stubs* que llaman `DO FORM`), íconos e imágenes.

**Código muerto** (en `fuente` pero no en el proyecto): 61 formularios (versiones viejas de pantallas principales: `plgplan1old`, `plgplan2`, `plmemp1`, `plmbak02`; pruebas: `prueba`, `pp`; arrastres de CONTAC: `cgmpar01`, `partida`, `arcban01`), 51 programas (versiones de cálculo `calcula2`, `calculaold`, `calculaback`, `calcula09092025`, `rescalcula`; `rentapl`, `contrato`, `etiqueta`, `menu`…), 54 reportes.
Dos cosas importantes de los programas muertos: **conviven varias versiones del cálculo** (la viva es `calcula.prg`) y `calcula09092025.prg` difiere de la viva en ~960 líneas de diferencia textual (la viva tiene la lógica de segunda quincena y de `NOISSS`/`NORECAL`), lo que sugiere **[I]** que el cálculo se modificó después de esa fecha: **confirmar con el cliente que `calcula.prg` es la versión que cuadra con lo que pagan hoy** (pregunta 3.5).
Además hay unas 60 tablas de trabajo en `fuente` (una con 100,000 filas) y exportes `.XLS`/`.TXT` con datos reales: no se migran.

## 3. Mapa de menú → funcionalidad

La barra tiene 7 menús: Mantenimiento, Movimientos de Empleados, Planilla, Reportes, Utilidades, ISSS y AFP, Llaves. **Casi cada opción verifica `PERFIL`** (usuario + nombre de pantalla; si no hay permiso: "Lo siento no tiene Acceso a esta opción") y llama antes a `nomoros()` (no abre otra si hay una tabla abierta). No revisan permiso en el menú: "Cierre", "Generación de Planilla Única" y la cabecera "Autorización de Llaves".
Columna **Destino** (`payroll`, `GL` = libro mayor, `banking`, PL = plataforma, RH = futuro módulo de recursos humanos): ✅ migrar · 🔁 migrar rediseñado · ⏸ diferir · ❌ no migrar.

### Mantenimiento (22)

| Opción | Pantalla | Destino |
|---|---|---|
| Maestro de Empleados | `plmemp01` (+ `plmemp02..06`, `plmper`, `plafil01`) | ✅ payroll — Empleados (datos laborales y de pago; el resto con permiso propio, preg. 6.1) |
| AFP | `plmafi01` | ✅ payroll — catálogo de AFP (comisión con vigencia) |
| Puestos | `plmcar01` | ✅ payroll |
| Profesiones | `plmpro01` | ⏸ RH |
| Crear Agrupaciones de Puestos | `plmagru` | ⏸ RH |
| Divisiones | `plmdiv01` | ✅ payroll — departamentos |
| Centros de Costo | `plmcosto` | 🔁 se usan los `gl_cost_centers` (preg. 1.4) |
| Tipos de Descuentos | `plmndes1` | 🔁 payroll — conceptos (sin columna fija en la tabla) |
| Tipos de Ingresos | `plmtipin` | 🔁 payroll — conceptos |
| Crear Instituciones de Capacitación, Capacitaciones | `plminsti`, `plmcapa` | ⏸ RH |
| Crear Bancos | `ccmbanco` | ✅ payroll/banking — catálogo de bancos |
| Crear Estatus de Empleados | `plmesta` | 🔁 estados de empleado fijos |
| Crear Ingresos Previos | `plmingre` | ✅ payroll — ingresos y renta de empleos anteriores |
| Crear Alcaldías | `plalcald` | ⏸ (solo documentos personales) |
| Crear Empresas | `plmemp2` | ❌ PL — cada patrono es una empresa de la plataforma (preg. 1.3) |
| Transferir Empleados | `plmtremp` | 🔁 traslado entre departamentos/empresas, con historial |
| Firmas para Contrato, Funciones del Contrato, Impresión del Contrato, Firma para Finiquitos | `plmfirma`, `plmfun`, `plimpcon`, `plmfirfi` | ⏸ RH (contratos y finiquitos) |
| Activar Recibo de Empleados | `plmempre` | 🔁 tipo de empleado "honorarios" |

### Movimientos de Empleados (16)

| Opción | Pantalla | Destino |
|---|---|---|
| Asistencia Diaria | `plasisdi` | ⏸ RH (solo registra; sin efecto en el pago) |
| Especificar Horarios | `plmhora` | ⏸ RH |
| Capacitaciones, Creación/Asignación de Capacitaciones, Chequear/Imprimir Capacitaciones | `ccmttra`, `plmcapap`, `plcapa`, `plrecapa`, `plrecapr` | ⏸ RH |
| Permisos | `plmper` | 🔁 payroll — ausencias/permisos que afectan la planilla |
| Amonestaciones | `plmamone` | ⏸ RH |
| Establecer Ventas, Análisis de Gastos (Mensuales, Consolidados, Restaurantes) | `plmven`, `plipesta`, `plipestc`, `plipest2` | ⏸ (análisis de gasto por venta; vacíos o específicos de un giro) |
| Generación de Premios | `plmgpre` | ⏸ (premios por antigüedad; tabla vacía) |
| Programación de Revisión Salarial | `plmpaume` | 🔁 recordatorio de revisión salarial |
| Programación de Vacaciones | `plmpvaca` | ✅ payroll — plan de vacaciones |

### Planilla (≈35)

| Opción | Pantalla | Destino |
|---|---|---|
| **Generación** | `plgplan1` | ✅ payroll — Corrida: generar (arma líneas por empleado) |
| Generación Planilla de Recibo | `plgprec` | 🔁 payroll — corrida de honorarios |
| **Modificaciones** (Días/Horas, Horas extras, Vacación, Otros ingresos, Salarios, Indemnizaciones; Cooperativa, Otros descuentos, Anticipos, Ausencias) | `plmplan1` → `plmplan0/2/3/4/5/6/7/8/9`, `plmplani`, `plmausen` | ✅ payroll — Corrida: novedades |
| Modificar Planilla de Anticipo | `anticipo` | 🔁 anticipos (modo "mensual" y recibo de anticipo) |
| **Cálculo** | `plcplan1` → `calcula.prg` | ✅ payroll — Corrida: calcular (servicio de cálculo versionado) |
| **Impresión** | `pliplan1` | ✅ payroll — planilla impresa |
| Imprimir Planilla Mensual | `pliplanm` | ✅ |
| Planilla Ingresos Excel, Planilla con Prestaciones, Planilla de Cotización | `pliplaex`, `pliplapr`, `pliplanp` | ✅ reportes / exportes |
| **Cierre** | `cierre1.prg` | ✅ payroll — Corrida: cerrar (inmutable) |
| Descuentos → Desc. Individuales, Desc. Generales | `plmdesc1`, `plgdesg1` | ✅ payroll — descuentos recurrentes |
| Préstamos | `plmpres1` | ✅ payroll — préstamos con amortización |
| Ingresos Adicionales Individuales / Generales | `plming01`, `plgingg1` | ✅ payroll — ingresos recurrentes |
| **Subir al Banco** | `plgdisco` | 🔁 payroll — archivo de pago / orden a `banking` (hoy Excel genérico) |
| Verificar… → Planilla, Qué Imprimir | `consulta`, `activas` | 🔁 consulta de corrida |
| **Generar Planilla de Aguinaldos** | `plagui01` (+ `plicarag`) | ✅ payroll — corrida de aguinaldo |
| Vacaciones → Cálculo en 3 períodos / en 1 período, Generar/Imprimir Planilla, Generar Depósito | `plmplava`, `plmplavq`, `plmvaca`, `plinvaca`, `plicarva` | ✅ payroll — vacaciones |
| **Indemnizaciones → Generar Indemnización** | `plmindem` | ✅ payroll — liquidación |
| Recibo de Pago | `plmrecib` | 🔁 recibos de honorarios |
| **Generar F910** | `plreanu` | ✅ payroll — declaración anual (por demanda) |
| Carta de Recibo de Honorarios | `plicarec` | 🔁 documento |
| **Generar Partida Contable** | `ccpartab` → `cgadipar.prg` | 🔁 payroll → `GL` — publicar la corrida cerrada (contrato `source = 'nomina'`) |

### Reportes (≈50)

| Opción | Pantalla | Destino |
|---|---|---|
| Empleados → Activos / Inactivos / Datos generales / Eventuales / Liquidados / Cumpleaños | `plrepm01`, `plrepm03`, `plrgene1`, `plrepmev`, `plminac`, `plcumpl` | ✅ listados de empleados |
| Empleados → Ingresos por fechas / Ingresos por fechas y contratos / Historial y Bitácora de aumentos | `record`, `plrinepm`, `plraum01`, `plbitaau` | ✅ |
| Empleados → Listado para ISSS | `plisss` | ✅ |
| Tablas, Listado de empleados para descuentos | `plltab01`, `plrdes1` | 🔁 catálogos / descuentos |
| Recibos (boletas), Detalle de Monedas, Detalle de Ingresos/Descuentos, Horas Extras | `plirec01`, `plmone01`, `plingres`, `pldesc`, `plhextra` | ✅ boleta (`recibo2.frx`) y detalles |
| Descuentos ISSS | `pliss01` | ✅ |
| **Descuentos Renta → Mensual, Anual, Constancia anual, Ingresos Gravados y Renta Retenida** | `plrenta`, `plrentat`, `plrcon1`, `plrrenta` | ✅ |
| **Descuentos AFP → Descuentos, Impresión de planillas AFP** | `plrafp`, `plrafp2` | ✅ |
| Vacaciones, Proyección de Aguinaldos, Vacaciones Pagadas | `plrvaca1`, `plraguin`, `plrvaca` | ✅ |
| Constancias (salario, trabajo, Ministerio de Trabajo) | `plrcon2..4` | ✅ documentos |
| Tabla de Ingresos, Reporte de Vialidad, Renta Original y Retenida, Descuentos Digitados, Sueldos por Género, Listado Empleados para ISSS, Ausencias Mensuales, Listado para Aseguradora, Empleados sin Cuentas Contables | `plingre`, `pldescvi`, `plingac`, `plrdesc2`, `plrgene`, `plreiss`, `plmausm`, `plraltba`, `plrcata` | 🔁 los que se confirmen (preg. 8.4) |
| **Archivo de renta mensual** | `plrentaa` | ✅ salida oficial (por demanda) |

### Utilidades, ISSS y AFP, Llaves

| Opción | Pantalla | Destino |
|---|---|---|
| Seleccionar Mes de Trabajo (año, mes, quincena) | `cgselmes` | ❌ PL — selector de período; la corrida se elige por período |
| **Configuración → Sistema** (tasas, topes, tablas de renta) | `config` | 🔁 payroll — **Parámetros legales con vigencia** |
| Configuración → Usuarios | `acceso` | ❌ PL |
| Mantenimiento de Período | `periodo` | ❌ PL/payroll — períodos |
| Procedimientos Especiales → Aumentos Salariales / Cambiar Código de Empleado | `plmaum1`, `plchgcd` | ✅ historial salarial / 🔁 cambio de código con bitácora |
| Reindexar Archivos | `reindex` | ❌ no aplica en SQLite |
| Actualizar salarios | `actu` | ❌ edición libre de sueldos sin bitácora; reemplazada por historial salarial |
| Calculadora, Apuntes, Rompecabezas, Buscar, Copiar, Pegar (barras estándar de VFP) | — | ❌ |
| **ISSS y AFP → Generación de Planilla** | `plgisss1` | ✅ payroll — armar la planilla del ISSS del mes |
| ISSS y AFP → Agregar / Modificar Empleados | `plmisss`, `plmisss2` | 🔁 ajustes manuales con bitácora |
| ISSS y AFP → Imprimir Planilla | `plriss01` | ✅ |
| **ISSS y AFP → Generar Disco para ISSS** | `pldisco` | ✅ salida oficial (layout de 102 posiciones; preg. 8.2) |
| ISSS y AFP → Generación de Planilla Única | `pldisco2` | ⏸ confirmar uso |
| ISSS y AFP → Transferir Planilla AFP | `plgafp1` | ❌ vuelca a un sistema externo en `F:\`; sustituir por el archivo de cotización vigente (preg. 8.3) |
| Llaves → Autorización de Llaves (Descuentos, Ingresos, Aumentos, Vacaciones, Indemnización) | `plmllave` → `plmdesll`, `plmingl`, `plmauml`, `plmvacal`, `plmindl` | 🔁 aprobación en dos pasos (preg. 6.2) |

## 4. Pantallas nuevas propuestas (módulo `payroll`)

Empleados · Catálogos (puestos, departamentos, AFP, bancos) · Conceptos de ingreso y descuento · **Parámetros legales con vigencia** (tasas, topes, tablas de renta, multiplicadores de horas extras) · **Corridas** (generar, novedades, calcular, revisar, cerrar, reabrir con permiso) ·
Descuentos e ingresos recurrentes y préstamos · Ausencias, incapacidades y permisos · Vacaciones · Aguinaldo · Liquidaciones · Archivos oficiales y bancarios (ISSS, AFP, renta mensual, F910, banco) · Boletas y constancias · Publicación contable · Reportes.

## 5. Pantallas clave (qué se ve)

Descripción hecha leyendo las posiciones de `render_scx.py` y el código (no se vieron capturas).

**Maestro de Empleados (`plmemp01`).** Formulario grande con barra de botones (Grabar, Ignorar, Anterior, Siguiente, Modificar, Eliminar, Agregar, Finalizar, Buscar). Pestañas: *Información Salarial*, *Beneficiarios*, *Información Académica*, *Datos para Contrato*, *Afiliación*.
Campos: código, nombre (según documento), sexo, estado civil, dirección, teléfono, ISSS, NIT, DUI, licencia, carnet, tipo de sangre, fecha de nacimiento, división, departamento, ficha, nacionalidad, % de anticipo, **"Cotizar a" (AFP/ISSS/IPFA/IVM/Ninguna)**, nombre según NIT, celular, alergias, cargo, jefe inmediato, estatus, empresa, dirección en el DUI, alcaldía.
Casillas: sueldo por comisión, eventual, hipertensión, diabetes, capacitación programada, edad máxima para pensionar, cargo ejecutivo, contrato impreso, recibo de honorarios, habitación, horario de planta, no calcular ISSS, extranjero, usar DUI para renta, no hacer recálculo, tipo de vacación, no calcular AFP. Botones laterales: Ctas. contables, Ver descuentos, Ver ingresos, Cotización AFP, Transferencia, Contrato, Finiquitos, Subir/Bajar ficha.

**Generar Planilla (`plgplan1`).** Diálogo pequeño: Mes (lista), Año, selector 1.ª/2.ª quincena (bloqueados: toman el período de trabajo), Desde/Hasta (fechas del rango), opción General / C. Costo / Empleado / Empresa, código del objetivo y botones Generar / Cancelar. Avanza con una barra "Procesando Planilla…".

**Cálculo (`plcplan1`).** Mismo diálogo (Mes, Año, quincena, opciones, código) con Proceder / Cancelar y la barra "Calculando Planilla . . .".

**Modificación de Planilla (`plmplan1`).** Selector de "Transacciones": Ingresos o Descuentos y una lista (Días Trabajados, Horas Extras, Vacación, Otros Ingresos, Salarios, Indemnizaciones; o Cooperativa, Otros Descuentos, Anticipos, Ausencias) con Proceder / Finalizar. Cada opción abre una pantalla chica por empleado.
*Días trabajados* (`plmplan3`): empleado, días del período, **trabajados, incapacidad, permisos sin pago, permisos con pago, sin trabajar, días pagados por asueto, total**, casilla "Continuos"; Grabar queda bloqueado mientras los días no cuadren.

**Configuración (`config`).** Grupos: salario mínimo, incapacidad (día de inicio y %), tablas Empleado/Patrono para ISSS, IVM y FSV, AFPs, INSAFORP, IPFA, renta eventual y de extranjeros, renta gravada del aguinaldo, tres tablas de renta de siete tramos (mensual, 1.er semestre, 2.º semestre; mínimo, máximo, fijo, %), "Máximo a indemnizar", opción **Quincenal / Mensual** para generar planilla, y botones Modificar / Finalizar.

**Boleta de pago (`recibo2.frx`, "RECIBO DE PAGO").** Encabezado con empleado, código, departamento y período; columnas de ingresos (sueldo, horas extras diurnas y nocturnas, otros) y descuentos (ISSS salud, AFP, ISSS-IVM, renta, cooperativa, seguro, anticipos), subtotales, "Líquido a Recibir" y espacio "RECIBI CONFORME".

## 6. Fuera de alcance de este spec

- **Módulos de RR. HH.** (contratos, finiquitos, capacitaciones, amonestaciones, permisos como trámite, asistencia, horarios, premios, análisis de gasto): se listan por menú, no se especifican; decisión en la pregunta 1.2.
- **Usuarios, permisos por pantalla, empresas, período de trabajo, reindexado:** plataforma.
- **El libro mayor** (cómo `CGADIPAR` actualiza `SALDOS`): ya especificado en [CONTAC](../contac/README.md); aquí solo se describe qué escribe planilla.
- **Pagos con cheque o transferencia vía Bancos:** no existen en este módulo (ver [bancoc](../bancoc/README.md) para el lado de Bancos).
- **Reportes `.frx`:** solo se leyeron `recibo2`, `recant01` y `plrtab01`; el resto se describe por título.
- **Valores legales vigentes:** este spec no afirma ninguna tasa ni fórmula legal; ver la lista de verificación en [open-questions.md](open-questions.md) §9.
