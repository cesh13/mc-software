# Preguntas para el negocio: lista única y priorizada

Fecha: 2026-11-11. Reúne las preguntas abiertas de los ocho módulos del sistema anterior (Contabilidad, Bancos y Cuentas por pagar, IVA, Cuentas por cobrar, Inventario y facturación, Lotes, Activo fijo y Planilla).

## 1. Cómo usar este documento

- Es una sola ronda de preguntas para quien administra el sistema anterior y para el contador. No hace falta conocer el sistema nuevo.
- Cada pregunta trae **nuestra propuesta**. Responder "de acuerdo" es una respuesta válida: es con lo que avanzaremos si no hay objeción.
- Orden sugerido: sección 2 (cosas por conseguir), sección 3 (las 30 más importantes) y, si hay tiempo, sección 4. Las marcas **(norma)** indican que el valor debe confirmarse contra la normativa vigente; este documento no afirma ninguna regla legal.
- Las listas completas, con el contexto de cada pregunta, están en `docs/legacy/<módulo>/open-questions.md` (enlaces en cada fila). El estado general está en [REPORTE.md](REPORTE.md) y el proceso en [README.md](README.md).

## 2. Lo que necesitamos conseguir (no son preguntas)

- **Una copia completa de un solo cliente, de la misma fecha, de todos los módulos.** Hoy cada módulo en disco es de un cliente y una fecha distintos; sin esto no se puede comprobar que los reportes cuadren entre módulos. (Bloqueos; [LOTE 2](lote64/open-questions.md), [INV 51](inv64/open-questions.md))
- **El libro mayor al día** (el de disco termina en 2024-03 y las cobranzas llegan a 2026-10): para verificar cómo se contabiliza y comparar al centavo. ([CXC 13](cxc64/open-questions.md))
- **Copias de al menos un cliente más**, idealmente con varias empresas: todo lo revisado viene de una sola empresa por módulo. ([BANCOC 32](bancoc/open-questions.md), [IVA 34](iva64/open-questions.md), [CXC 31](cxc64/open-questions.md), [INV 50](inv64/open-questions.md), [AFIJO 2](afijo64/open-questions.md))
- **Contenido de los archivos comprimidos que no se abrieron** (contabilidad, activo fijo y dos de planilla): pueden traer datos de otros clientes. ([AFIJO 2](afijo64/open-questions.md), [PLAN 2.1](plan64/open-questions.md))
- **Reportes impresos de un mes cerrado**: balance de comprobación y balance general (Bloqueos); antigüedad de saldos, estado de cuenta y "Ventas y Bancos" ([CXC 32](cxc64/open-questions.md)); planilla de ISSS y renta mensual de un mes cerrado y de una quincena de junio o diciembre ([PLAN 2.1](plan64/open-questions.md)). Son lo que el negocio da por correcto contra lo que calculará el sistema nuevo.
- **El programa externo de factura electrónica** (nombre, versión, quién lo mantiene, dónde corre), la tabla de resoluciones y la copia viva de compras con sus campos fiscales: no están en lo recibido y sin ellos no se puede especificar firma, transmisión ni anulación. (Bloqueos; [INV 42](inv64/open-questions.md); ver P3)
- **Un ejemplo de anexo aceptado por Hacienda** y los instructivos vigentes de anexos, factura electrónica, planilla de ISSS y renta mensual, para comparar columna a columna. ([IVA 22](iva64/open-questions.md); ver P29)
- **Valores legales vigentes con su fecha** (tasas y topes de ISSS, AFP, INSAFORP y FSV, tablas de renta, salario mínimo, horas extras, vacaciones, aguinaldo, indemnización, depreciación): el contador los entrega o confirma. ([PLAN sección 9](plan64/open-questions.md))
- **Formatos de impresión reales** de cheque, quedan, recibo y notas de crédito y de débito de cada cliente. ([BANCOC 31](bancoc/open-questions.md), [CXC 33](cxc64/open-questions.md))
- **Un archivo de ejemplo de "Subir Partida Contable" e "Importar Catálogo"**: para saber el formato que hay que aceptar. ([CONTAC 10](contac/open-questions.md))

## 3. Las 30 preguntas que más importan

| # | Pregunta | Nuestra propuesta | Qué cambia según la respuesta | Quién responde | Fuente |
|---|---|---|---|---|---|
| P1 | ¿Las ventas se contabilizan hoy desde Inventario, desde Cuentas por cobrar o desde ambos? ¿Alguna vez se contabilizó dos veces un mismo período o quedó un hueco? | Un solo flujo: cada venta y su costo se contabilizan una vez, sin rangos de fechas a mano. Con producción, Inventario contabiliza las existencias y Producción solo su absorción de costos. | Si ya hay duplicados, hay que depurar antes de migrar. Define qué módulo es dueño de la partida de ventas y de costo. | contador | [INV 44, 45, 48](inv64/open-questions.md); [CXC 16](cxc64/open-questions.md) |
| P2 | ¿Aprueban que las partidas creadas por Bancos, Cobros, Producción, Activo fijo y Planilla queden marcadas con su origen, enlazadas a su documento y sin edición manual (se corrigen anulando y regenerando)? ¿Se editó alguna a propósito en Contabilidad? | Sí: origen y enlace en cada partida; corrección por anulación; las partidas viejas se importan con el origen deducido. | Si hay ediciones legítimas, hará falta un ajuste manual aparte. Cambia cómo se importa el historial. | contador y administrador del sistema | [BANCOC 14, 16, 21](bancoc/open-questions.md); [CXC 12, 14](cxc64/open-questions.md); [AFIJO 23](afijo64/open-questions.md); [LOTE 21](lote64/open-questions.md); [PLAN 7.1](plan64/open-questions.md); [CONTAC 14, 16](contac/open-questions.md) |
| P3 | ¿Qué programa firma y transmite hoy las facturas electrónicas, quién lo mantiene y dónde corre? ¿Desde qué fecha los documentos son de producción? ¿Se reemplaza por un módulo nuestro? | Que nos den nombre, proveedor y configuración; proponemos reemplazarlo con un módulo propio y mantener el actual en paralelo mientras tanto. | Sin esto no se puede diseñar firma, transmisión ni contingencia. Define la prioridad del módulo de facturación electrónica. | proveedor externo y administrador | [INV 1, 2](inv64/open-questions.md); [IVA 18](iva64/open-questions.md); [CXC 34](cxc64/open-questions.md) |
| P4 | El IVA percibido, ¿debe calcularse con la misma tasa que el retenido o con una tasa propia? ¿Y en las notas de crédito de consumidor final, el valor se resta o se suma? | Dos tasas separadas, cada una confirmada por el contador (norma). Valor inicial: Bancos propone el actual, IVA propone corregir a la tasa de percepción. Nota de crédito como reverso de la factura. | Cambia el IVA de libros y partidas. Hoy podría estar mal calculado. | contador | [BANCOC 23](bancoc/open-questions.md); [IVA 8](iva64/open-questions.md); [CXC 9](cxc64/open-questions.md); [INV 12](inv64/open-questions.md) |
| P5 | ¿A partir de qué monto se retiene o percibe el IVA (ventas, compras, consumidor final) y desde qué fecha rige cada tasa? ¿Algún cliente usa una tasa distinta (zona franca, régimen especial)? | Tasas y montos mínimos por empresa, con fecha de vigencia (norma). Mientras tanto, sin mínimo para retener en compras, como hoy. | Qué documentos retienen o no; cuadre de libros y anexos. | contador | [BANCOC 24](bancoc/open-questions.md); [IVA 7, 9](iva64/open-questions.md) |
| P6 | ¿Prefieren una partida por cada documento o una partida resumen por lote o período? ¿Cada cuánto se genera, y con qué detalle la espera el contador (por activo, por empleado, por concepto)? | Resumen por lote o corrida con el detalle consultable; opción de una partida por documento; sin rangos libres de fechas. | Cantidad de partidas, facilidad de auditar y de conciliar. | contador | [BANCOC 26](bancoc/open-questions.md); [CXC 16](cxc64/open-questions.md); [LOTE 21](lote64/open-questions.md); [AFIJO 19, 20](afijo64/open-questions.md); [PLAN 7.2](plan64/open-questions.md); [INV 47](inv64/open-questions.md) |
| P7 | ¿Quién puede reabrir un mes cerrado (contabilidad, cartera, inventario, IVA, planilla), con qué motivo y con qué rastro? ¿Debe prohibirse siempre procesar, anular o depreciar en un mes cerrado? ¿Cómo se corrige algo ya presentado? | Solo el supervisor, con motivo y bitácora; el cierre contable manda; correcciones como ajuste en el período abierto. | Hoy se reabre sin rastro. Define el flujo de correcciones. Si algún cliente depende de procesar en meses cerrados, cambia. | dueño del negocio y contador | [CXC 15](cxc64/open-questions.md); [IVA 26, 27](iva64/open-questions.md); [INV 31, 32](inv64/open-questions.md); [LOTE 16](lote64/open-questions.md); [AFIJO 6, 33](afijo64/open-questions.md); [PLAN 6.3](plan64/open-questions.md) |
| P8 | Al anular un documento, ¿se conserva su número y se anula también su partida (en vez de dejarla en ceros)? ¿Quién puede anular y se exige un motivo? | Número conservado y partida anulada; motivo obligatorio; solo el supervisor anula cheques impresos, corridas procesadas y documentos con pagos. | Reportes de documentos emitidos y control de numeración. | contador | [BANCOC 19](bancoc/open-questions.md); [LOTE 13](lote64/open-questions.md); [AFIJO 32](afijo64/open-questions.md) |
| P9 | ¿Qué puede hacer cada tipo de usuario? En concreto: ¿el digitador debe ver reportes? ¿Quién anula, reabre, contabiliza, cierra planilla, cambia códigos, ve costos y ve sueldos? ¿Se necesita mantener permisos pantalla por pantalla? | Tres permisos (capturar, ver reportes, supervisar), más "ver costos" y "ver sueldos" por separado; acciones sensibles solo para supervisor y todo con bitácora. | Define los roles y qué queda registrado. | dueño del negocio y administrador | [CONTAC 12](contac/open-questions.md); [BANCOC 30](bancoc/open-questions.md); [IVA 37, 38](iva64/open-questions.md); [CXC 6, 36](cxc64/open-questions.md); [INV 33, 49](inv64/open-questions.md); [LOTE 32](lote64/open-questions.md); [AFIJO 31](afijo64/open-questions.md); [PLAN 6.1, 6.2, 6.4](plan64/open-questions.md); [REPORTE Q5](REPORTE.md#preguntas-para-el-negocio) |
| P10 | ¿El costo aceptado es el promedio por producto (todas las bodegas)? ¿El costo de una venta debe quedar fijo al facturar aunque el cierre de mes vuelva a valuar? ¿Las devoluciones reingresan al costo de la venta original y se limitan a lo vendido? | Promedio por producto, fijo al emitir, con ajustes explícitos; devoluciones al costo original y validadas contra el documento (salvo permiso). | Costo de ventas, valor del inventario y paridad de reportes. | contador | [INV 14, 15, 27, 28](inv64/open-questions.md); [LOTE 14](lote64/open-questions.md) |
| P11 | ¿Debe impedirse vender o producir sin existencia suficiente? | Bloquear por omisión, configurable por empresa, con permiso del supervisor para casos especiales. | Flujo de facturación y de producción. | dueño del negocio | [INV 29](inv64/open-questions.md); [LOTE 15](lote64/open-questions.md) |
| P12 | Cuando las existencias guardadas no coinciden con los movimientos, ¿cuál cifra es la correcta? ¿Se corrigen antes de migrar los productos sin costo? | Calcular las existencias desde los movimientos; entregarles la lista de productos con diferencia; corregir costos en cero antes de migrar. | Cifras de inventario migradas. | contador | [INV 30, 37](inv64/open-questions.md) |
| P13 | Los activos marcados "no depreciables" se han depreciado igual (mes tras mes). ¿Están mal clasificados o mal calculados (terrenos, obras en proceso)? ¿Deben revertirse esas depreciaciones? | Respetar el tipo; resolver caso por caso antes de la primera corrida en el sistema nuevo. | Gasto por depreciación y depreciación acumulada. | contador | [AFIJO 9](afijo64/open-questions.md) |
| P14 | En dos meses (2023-01 y 2023-02) la partida de depreciación en Contabilidad tiene el doble del total de la corrida de activo fijo. ¿Se editaron a mano, se corrió dos veces? ¿Cuál cifra es la correcta? | Importar esas dos partidas como "importadas", reportar la diferencia y no usarlas para comparar hasta tener respuesta. | Saldo de depreciación acumulada. | contador | [AFIJO 21](afijo64/open-questions.md) |
| P15 | El libro mayor no tiene partidas de 2020-04 a 2021-10. ¿Se depuraron o están en otro respaldo? ¿Qué cifra vale en las partidas con líneas repetidas o desactualizadas, y qué se hace con saldos de meses sin partidas (2012-12 y 2021-09)? | Importar lo que existe, informar las diferencias y no inventar partidas; apertura con una sola partida donde falte historial (decidido en CONTAC 4). | Saldos de apertura y cuadre de balances. | administrador y contador | [REPORTE Q1, Q2, Q3](REPORTE.md#preguntas-para-el-negocio) |
| P16 | ¿Qué versión del cálculo de planilla es la que se usa para pagar hoy (existen varias, una de 2025 fuera del proyecto)? ¿Qué tasas y topes regían en cada quincena anterior? | Comparar el cálculo contra las 48 quincenas cerradas; conservar los importes históricos; cargar parámetros desde la primera corrida actual. | Base de todo el cálculo y de la comprobación. | contador y administrador | [PLAN 2.4, 3.5](plan64/open-questions.md) |
| P17 | Retención de renta: ¿los topes y la tabla del sistema corresponden a mes o a quincena? ¿Cómo se regulariza en junio y diciembre? ¿Qué se hace con quien entra a mitad de año o viene de otro empleo? ¿Se resta el FSV de la base? (norma) | Cada tabla con su período explícito; ajuste anual explícito en lugar de la regularización actual; tabla sin huecos; el contador confirma cada concepto. | Retención de cada empleado. | contador | [PLAN 3.1, 3.2, 3.3, 3.4](plan64/open-questions.md) |
| P18 | Incapacidades, horas extras y días: ¿cómo se pagan las incapacidades (ISSS, patrono, ambos)? ¿Cuál es el valor correcto del día? ¿Qué clases de horas extra usan y con qué recargo? ¿Cuántos días tiene la 2.ª quincena para quien gana el mínimo? (norma) | Día = salario mensual entre 30; catálogo de recargos con vigencia; un solo criterio de días. | Montos de pago. | contador | [PLAN 4.1, 4.2, 4.3](plan64/open-questions.md) |
| P19 | Vacaciones, aguinaldo, indemnización y retención de procuraduría: ¿las fórmulas del sistema anterior (prima, días por antigüedad, fecha de corte, pago en cuotas) son las que se aplican? (norma) | Todo parametrizado con vigencia; el contador revisa cada fórmula antes de que la construyamos. | Liquidaciones y prestaciones. | contador | [PLAN 5.1, 5.2, 5.3, 5.4, 5.6](plan64/open-questions.md) |
| P20 | La partida de planilla actual omite varios conceptos y puede salir descuadrada. ¿Qué hace hoy el contador con la diferencia? ¿Se contabilizan mes a mes las provisiones de aguinaldo, vacaciones e indemnización o al pagar? ¿Contra qué cuenta sale el pago neto? | Partida generada desde los conceptos (cuadra por construcción); provisiones patronales por concepto; cuenta de pago por empresa. | Contabilización de planilla. | contador | [PLAN 5.5, 7.3, 7.4, 7.5](plan64/open-questions.md) |
| P21 | Exportaciones: ¿van sin IVA y con destino propio en el libro? ¿Cómo se contabiliza el flete de exportación? ¿El IVA se redondea por línea o sobre el total, y el consumidor final se calcula una vez al mes? (norma) | Exportación sin IVA; redondeo por línea con total igual a la suma (a elegir por el contador); mantener la fórmula mensual del libro para cuadrar al centavo. | Cálculo de IVA en facturas y libros. | contador | [CXC 10](cxc64/open-questions.md); [INV 11, 13, 23](inv64/open-questions.md); [IVA 11](iva64/open-questions.md) |
| P22 | Impuesto a las operaciones financieras: ¿a qué documentos se aplica (cheques, transferencias, ambos) y siempre sobre el monto del documento? ¿El umbral de 1,000 es el vigente? (norma) | Tasa y umbral configurables; aplicar a cheques y transferencias de salida de cuentas no exentas. | Impuesto que se genera o no. | contador | [BANCOC 13](bancoc/open-questions.md) |
| P23 | ¿Quién es el dueño del documento de compra: Cuentas por pagar e IVA, o Inventario? | Cuentas por pagar e IVA son dueños del documento; Inventario recibe la mercadería y lo referencia; el libro de IVA se arma desde los documentos, con captura manual para gastos. | Cómo se capturan y enlazan las compras. | administrador y contador | [IVA 1](iva64/open-questions.md); [INV 41](inv64/open-questions.md); [BANCOC 29](bancoc/open-questions.md) |
| P24 | Depreciación: ¿cuenta la fecha de compra o la de puesta en servicio? ¿Los 2 años de vida útil obedecen a la norma, a una política o a ambas? ¿Un plan por activo o dos libros (financiero y fiscal)? ¿Algún cliente usa otro método? ¿Cómo se ajusta la cuota si cambia el costo o la vida? (norma) | Línea recta; fecha de servicio igual a la de compra por omisión; un plan por activo; saldo inicial acumulado permitido; recalcular la cuota restante con confirmación. | Cuota mensual y gasto del período. | contador | [AFIJO 4, 5, 7, 12](afijo64/open-questions.md) |
| P25 | ¿Cómo se registra hoy la baja o venta de un activo (partida manual)? ¿Se deprecia el mes de la baja? ¿Qué cuentas de ganancia y pérdida se usan? | Construir bajas con su partida; mientras no haya respuesta, desactivar el activo y avisar. | Falta una función completa del módulo. | contador | [AFIJO 14](afijo64/open-questions.md) |
| P26 | Cuentas y centros de costo: ¿pueden confirmar la cuenta contable de cada tipo de operación (ventas, IVA, cobros, inventario, absorción de producción, activos, planilla)? ¿Se completan antes de migrar los productos sin cuenta? ¿Cómo se relacionan los dos centros de costo (planilla y activo fijo contra contabilidad), y el abono de depreciación debe llevar centro? | Un solo catálogo de centros de costo (el de contabilidad) con correspondencia al migrar; cuentas por omisión en la categoría o la empresa; validar contra el plan de cuentas vigente. | Dónde cae cada importe en los reportes. | contador | [CXC 13](cxc64/open-questions.md); [INV 46](inv64/open-questions.md); [AFIJO 22, 24, 25](afijo64/open-questions.md); [LOTE 22](lote64/open-questions.md); [PLAN 1.4](plan64/open-questions.md) |
| P27 | Datos inconsistentes (documentos repetidos, terceros inexistentes, totales que no cuadran, filas sin código, órdenes pendientes antiguas): ¿se corrigen en el sistema anterior antes de migrar o se importan tal cual con un reporte? ¿Quién decide caso por caso? | Importar tal cual, reportar, y que el negocio decida cuáles corregir. | Cuánta limpieza previa hay que hacer. | administrador y contador | [IVA 16, 28, 29](iva64/open-questions.md); [CXC 30](cxc64/open-questions.md); [LOTE 31](lote64/open-questions.md); [PLAN 2.3](plan64/open-questions.md) |
| P28 | Antigüedad de saldos: ¿se cuenta desde la fecha del documento o desde el vencimiento? ¿Qué tramos usan (cobrar y pagar)? | Una antigüedad con base elegible y tramos configurables. | Reporte que debe cuadrar al centavo. | contador | [CXC 27](cxc64/open-questions.md); [BANCOC 28](bancoc/open-questions.md) |
| P29 | Archivos de planilla: ¿qué formatos presentan hoy (planilla de ISSS, AFP, renta mensual, F910) y qué bancos usan para pagar? ¿Qué códigos de observación se usan? (norma) | Exportador configurable por banco; validar cada archivo contra el formato vigente; no repetir un error conocido en un campo del F910. | Si el archivo es aceptado o rechazado. | contador y administrador | [PLAN 8.1, 8.2, 8.3, 8.5](plan64/open-questions.md) |
| P30 | ¿Cuáles son los 15 reportes que realmente se usan en cada módulo y cuáles ya no? ¿Cuáles archivos para Hacienda presentan hoy? | Migrar los exigidos por ley y los 15 más usados; el resto bajo demanda. | Alcance y plazo de cada módulo. | administrador | [CONTAC 7](contac/open-questions.md); [BANCOC 3](bancoc/open-questions.md); [CXC 2](cxc64/open-questions.md); [INV 54](inv64/open-questions.md); [LOTE 29](lote64/open-questions.md); [AFIJO 30](afijo64/open-questions.md); [PLAN 8.4](plan64/open-questions.md); [IVA 20, 21](iva64/open-questions.md) |

## 4. Preguntas por módulo, segunda ronda

Cada línea: número en la lista del módulo, pregunta y nuestra propuesta. "Sin propuesta" significa que necesitamos su criterio.

### Contabilidad general (CONTAC y preguntas de REPORTE) — [lista](contac/open-questions.md)
- (3) Cuentas "de orden" y "contra": ¿cómo deben presentarse en el balance general? *Propuesta:* aparte y fuera de la ecuación del balance.
- (6) La fecha de cobro en las líneas de partida, ¿para qué se usa? *Propuesta:* conservar el dato; sin pantalla por ahora.
- (8) Estados de resultados (comercial, industrial, mensual, definido, comparativos): ¿les sirve un solo motor con plantillas? *Propuesta:* sí.
- (9) ¿Imprimen libros legales foliados (Diario, Mayor)? ¿Con qué formato? (norma) *Sin propuesta.*
- (11) ¿Algún cliente consolida empresas hoy? *Propuesta:* consolidar como consulta entre empresas.
- (15) "Ingresar al IVA" e "Ingresar Renta" desde una partida: ¿se siguen usando? *Propuesta:* llegan con el módulo de IVA.
- (1, pendiente) ¿Por qué quedan grabadas partidas descuadradas: trabajo a medias, o vienen de "Subir Partida Contable" o de Bancos? *Sin propuesta.*
- (R4) ¿El código de moneda 2 corresponde a dólares? *Propuesta:* sí.
- (R6) ¿Se permite cargar directamente a una cuenta padre? *Propuesta:* no en captura nueva; los datos viejos se importan tal cual.
- (R7) ¿Se limpian antes de migrar las líneas sin centro de costo y las de monto negativo? *Propuesta:* importar y reportar.
- (R8) Cambiar el tipo de una cuenta con sub-cuentas: ¿arrastra a las hijas o se prohíbe? *Propuesta:* arrastra, y se rechaza si alguna tiene movimientos.
- (R9) ¿Cuál es el largo máximo real del nombre de una cuenta? *Propuesta:* 100 (el sistema anterior usaba 45).

### Bancos y Cuentas por pagar (BANCOC) — [lista](bancoc/open-questions.md)
- (1) ¿Cuentas por pagar se usa en todos los clientes? *Propuesta:* módulo propio y opcional por empresa.
- (2) Cheques a contratistas y control de obra: ¿algún cliente lo usa? *Propuesta:* no migrar.
- (5) Pantallas fuera del menú (transferencias, conciliación, remesas): ¿alguna se usó alguna vez? *Propuesta:* ignorarlas.
- (6) Tipos de cuenta (caja, ahorros, a plazo, otra): ¿se usan además de la corriente? *Propuesta:* conservar el tipo; tasa de interés solo informativa.
- (8) Fecha del saldo inicial: ¿se mantiene la regla de que ningún movimiento sea anterior? *Propuesta:* mantenerla.
- (9) ¿Algún cliente tiene cuentas en otra moneda? *Propuesta:* una moneda por empresa; el importador avisa si hay otra.
- (10) Transferencias entre cuentas propias: ¿se hacían? *Propuesta:* documento nuevo con dos extremos y una sola partida.
- (11) Estatus del cheque (firmado, entregado, cobrado): ¿se conservan? *Propuesta:* sí, con fechas y quién recibe.
- (12) ¿Un número de cheque es único por cuenta sin importar el mes? *Propuesta:* sí; los demás documentos por cuenta, tipo, período y número.
- (17) Remesa concentrada: ¿se necesita esa pantalla? *Propuesta:* quitarla; la remesa es un depósito con varias contrapartidas.
- (18) ¿Alguien digita el número de la partida para que coincida con un comprobante físico? *Propuesta:* lo asigna Contabilidad; se permite cambiarlo antes de aplicar si hace falta.
- (22) Conciliación bancaria: ¿se usa? ¿Qué bancos y formatos de estado de cuenta? *Propuesta:* marcar, saldo del banco y diferencia; importar el estado después.
- (25) Vencimiento al viernes: ¿todos los clientes pagan en viernes? *Propuesta:* opción de la empresa, activa por defecto.
- (27) Pagos parciales y cancelaciones manuales sin documento bancario. *Propuesta:* mantener; los manuales generan partida o quedan como "pago registrado por fuera" con motivo.
- (34) Tablas de trabajo con datos: ¿contienen documentos que no estén en las tablas vivas? *Propuesta:* no migrarlas, tras confirmarlo.

### IVA — [lista](iva64/open-questions.md)
- (2) Sincronización con Cuentas por cobrar, por pagar e Inventario: ¿debe correr sola o por botón? *Propuesta:* sin duplicar por documento, sin borrar capturas manuales y sin tocar meses cerrados.
- (4) ¿El libro de IVA debe cuadrar con el IVA de la contabilidad? *Propuesta:* reporte de conciliación como control, sin obligar.
- (5) Liquidación y declaración mensual de IVA: ¿la necesitan en el sistema? *Propuesta:* primero lo que hay hoy; la liquidación con partida, como segunda fase si la piden.
- (6) ¿Hay clientes con varias empresas que consoliden libros? *Propuesta:* tasa por empresa.
- (10) Renta retenida (10 % escrita en el programa): ¿es correcta? (norma) *Propuesta:* tabla de códigos de ingreso con su tasa, redondeo a centavos, monto editable con motivo.
- (12) Total de la compra y anticipo a cuenta: ¿cómo debe tratarse el anticipo? *Propuesta:* conservar la fórmula y documentar el significado de cada columna.
- (13) Compra frente a gasto: ¿el contador necesita esos parciales en el libro legal? *Propuesta:* mantener la clasificación.
- (14) Importaciones, internaciones y servicios del exterior. *Propuesta:* capturar los tres tipos y permitir un documento mixto.
- (15) ¿Cuántos meses hacia atrás puede registrarse un documento? (norma) *Propuesta:* un solo criterio: el período del libro.
- (17) Factura electrónica recibida: ¿qué tipos reciben y de quién? *Propuesta:* lector completo de los tipos que correspondan a cada libro.
- (19) Consumidor final con factura electrónica: ¿el anexo ya exige detalle por documento? *Propuesta:* guardar el documento individual y armar el resumen diario; formato decidido por renglón.
- (24) Anexos: omisión de notas, renta no exportada, signo de notas de crédito de compras, exportaciones desde cobranzas y uso del registro fiscal cuando no hay NIT ni DUI. *Propuesta:* confirmar cada punto con el contador antes de reproducirlo o corregirlo.
- (25) Folios y legalización de libros: ¿requisito de papel o basta el PDF? (norma) *Propuesta:* hojas numeradas y último folio guardado.
- (30) La bitácora registra transferencias de compras que no dejaron huella: ¿de dónde salen las compras (captura, archivo, CSV)? *Propuesta:* importarlas como manuales.
- (31) Control de renta (correlativo): ¿se usa? *Propuesta:* arrancar del mayor más uno, o dejar la pantalla para después.
- (32) Clasificaciones con valor 0: *Propuesta:* tabla de equivalencias confirmada por el contador.
- (33) Clientes y proveedores nacional o extranjero: ¿qué número es cada uno? *Propuesta:* 1 nacional y 0 extranjero, a confirmar.

### Cuentas por cobrar — [lista](cxc64/open-questions.md)
- (1) ¿Hay clientes que usan Cuentas por cobrar sin Inventario? *Propuesta:* la factura nace en Inventario; la captura manual queda opcional.
- (3) Tipos de movimiento sin uso (pago anticipado, comprobante de retención y otros). *Propuesta:* migrar el catálogo; pantallas solo para anticipos, abonos y cargos internos.
- (4) Logística de reparto (rutas, transportistas, vehículos): ¿se sigue usando el despacho como control o ya lo cubre la factura electrónica? *Propuesta:* no migrar al primer corte; la liquidación de cobradores sí.
- (5) Límite de crédito, cliente suspendido y de contado: ¿quieren que se hagan cumplir? *Propuesta:* configurable (ninguno, advertir, bloquear), por omisión advertir; "suspendido" bloquea el crédito.
- (7) Comisiones de vendedores: ¿siguen siendo necesarias y quién las calcula? *Propuesta:* fuera de este módulo; módulo futuro.
- (8) Presupuestos de ventas y cobros e indicadores. *Propuesta:* no migrar al inicio.
- (11) Numeración de facturas, notas y recibos: ¿hay que mantener la numeración vieja? *Propuesta:* factura única por empresa, tipo, serie y número; recibo con secuencia propia y la boleta física como referencia.
- (17) Cuenta de caja o de cheques postfechados según el abono tenga o no fecha de cobro: ¿es correcto? *Propuesta:* mantener ambos y mover a banco al depositar.
- (18) Pagos anticipados. *Propuesta:* un recibo sin aplicar, que se aplica a facturas; construir cuando alguien lo pida.
- (19) Cheques postfechados y rechazados: ¿cuentan como saldo del cliente o como cobrado? *Propuesta:* el rechazo reabre la deuda; el saldo puede verse con o sin postfechados.
- (20) Reporte de cobros en efectivo ("lavado de dinero"): ¿qué umbral y formato exige la ley aplicable? (norma) *Propuesta:* reporte configurable sobre un monto.
- (21) Copias y tablas de trabajo: ¿contienen movimientos que no estén en la tabla principal? *Propuesta:* no migrarlas, tras confirmarlo.
- (22) Una marca llamada "BUTTER" en facturas y cheques: ¿qué significa (línea de producto, tipo de comisión)? *Propuesta:* migrar como marca de línea de producto.
- (23) Un mismo recibo aplicado a varios clientes o liquidaciones. *Propuesta:* un recibo, un cliente (o un grupo explícito).
- (24) Liquidación de cobradores: ¿quién deposita y cómo se concilia hoy? *Propuesta:* efectivo más cheques debe igualar la remesa; se registra la cuenta y se vincula el depósito.
- (25) Venta de contado: ¿se cobra siempre en efectivo? *Propuesta:* el recibo se crea al emitir la factura.
- (26) Descuentos por pronto pago, intereses y recargos por mora: ¿se necesitan? *Propuesta:* no.
- (35) Clasificación del cliente (A/B/C), tipo, lista de precios y descuento: ¿qué significan y quién los usa? *Propuesta:* migrar como atributos; precios y descuento pasan a Inventario.

### Inventario, facturación y facturación electrónica — [lista](inv64/open-questions.md)
- (3) ¿Cómo se maneja hoy un documento rechazado o una caída de Hacienda? ¿Qué significan los comprobantes con falla ya procesados y los que no tienen número de control? *Propuesta:* estados explícitos y reintentos; revisar a mano los sin número.
- (4) Invalidación: hoy el tipo es fijo y el motivo es el nombre del usuario. ¿Es correcto? *Propuesta:* tipo y motivo obligatorios y elegibles; anular e invalidar en una sola operación.
- (5) ¿Hay más de una sucursal o caja? *Propuesta:* establecimientos y serie por punto de venta.
- (6) Un documento de consumidor final ya transmitido puede modificarse: ¿es intencional? *Propuesta:* documento emitido no modificable.
- (7) Versión de los esquemas de factura electrónica. (norma) *Sin propuesta; se contrastará con los esquemas vigentes.*
- (8) ¿Se emite remisión electrónica? *Propuesta:* no migrar.
- (9) Compras recibidas por factura electrónica: ¿qué otros tipos reciben? *Propuesta:* lector real con validación.
- (10) Formatos de impresión de comprobante de crédito fiscal y consumidor final: ¿siguen siendo necesarios así? *Propuesta:* una plantilla nueva con código QR.
- (16) Crédito y mora: ¿bloqueo duro, advertencia o aprobación? *Propuesta:* la misma que en Cuentas por cobrar (5).
- (17) Descuento por documento: ¿es política de la empresa? ¿Se conserva el descuento por línea? *Sin propuesta.*
- (18) Bonificaciones: salen a costo y se declaran como descuento. ¿Se mantiene? *Sin propuesta.*
- (19) Listas de precio: ¿se usan las nueve? *Propuesta:* listas con vigencia.
- (20) Notas de débito y de abono: ¿se conservan? *Propuesta:* débito sí; abono no.
- (21) Pedidos, prefacturas, remisiones y consignaciones: ¿otros clientes las usan? *Propuesta:* no construir en el primer corte.
- (22) Sujeto excluido: ¿quién lo emite? *Propuesta:* pasa a Cuentas por pagar e IVA.
- (24) Los números de documento se digitan o proponen: ¿se mantiene digitarlos? *Propuesta:* asignación automática por serie; digitar solo en migración o contingencia, con permiso.
- (25) ¿Hay huecos de correlativo en documentos fiscales? Entregar la tabla de resoluciones. *Sin propuesta.*
- (26) "Cambiar número a un comprobante": ¿se sigue usando? *Propuesta:* eliminar.
- (34) Transferencias entre bodegas: ¿qué concepto debe aplicar? *Propuesta:* un concepto propio.
- (35) Conceptos de movimiento con código repetido: definir el catálogo final antes de importar. *Sin propuesta.*
- (36) Inventario físico: ¿se usa? *Propuesta:* conteo con ajuste automático al aprobar.
- (38) Bodegas 11 a 15: hoy hay 4, ¿habrá más? *Sin propuesta.*
- (39) Importaciones y retaceo: ¿importan mercadería y cómo la costean? *Sin propuesta.*
- (43) Gastos de importación: ¿entran al costo? (el IVA no entra) *Sin propuesta.*
- (52) Tablas de trabajo con datos reales y de gran tamaño: ¿se destruyen o se guardan fuera del repositorio? *Sin propuesta.*
- (53) Comisiones y presupuestos: ¿se necesitan? *Propuesta:* fuera del primer corte (ver Cuentas por cobrar 7 y 8).
- (55) Etiquetas ("viñeta"): ¿se migra? *Propuesta:* no.

### Lotes (producción) — [lista](lote64/open-questions.md)
- (1) ¿Sigue en uso? Las órdenes terminan en 2020-10. *Propuesta:* si no hay datos recientes, migrar para consultar el histórico.
- (3) ¿Qué otros clientes usan producción y de qué giro? *Propuesta:* módulo opcional por empresa, apagado por omisión.
- (4) Fórmulas duplicadas por producto. *Propuesta:* la última es la vigente y las demás quedan históricas; el negocio revisa el reporte de diferencias.
- (5) Versiones de fórmulas: ¿se requiere aprobación de cambios? *Propuesta:* versiones con vigencia; la orden congela la versión usada.
- (6) "Medida base" frente a "cantidad formulada": ¿qué significa cada una? *Propuesta:* la cantidad formulada es el tamaño base; la medida base queda informativa.
- (7) Fórmula maestra: ¿para qué se usa? *Propuesta:* no migrar aparte; si son aprobadas, importarlas como versiones.
- (8) Semi-terminados: ¿se necesita explosión de materiales u "orden hija"? *Propuesta:* mantener: el semi-terminado se produce antes con su propia orden.
- (9) Sustitutos, subproductos y rendimiento esperado. *Propuesta:* no construir al inicio.
- (10) Numeración del lote (letras y dígitos): ¿qué significa cada parte? *Propuesta:* texto único por empresa con plantilla configurable.
- (11) Estatus de la orden: ¿alguno debe bloquear algo? *Propuesta:* catálogo de seguimiento separado del estado real.
- (12) Cantidad fabricada distinta de la programada: ¿qué tolerancia y quién aprueba? *Propuesta:* guardar ambas, recalcular insumos por omisión y mostrar la variación.
- (17) "Actualizar Indirectos" y "Recalcular Costos": ¿se usan? ¿Quién corrige hoy el costo promedio? *Propuesta:* no migrar; recosteo explícito con ajustes.
- (18) Base de los indirectos: al procesar incluye maquila y al recalcular no. *Propuesta:* una sola regla, la de procesar.
- (19) Etiqueta ("viñeta") como costo: ¿se usa? *Propuesta:* no migrar salvo que otro cliente la use.
- (23) Transferir materia prima al maquilador: ¿se usa? *Propuesta:* no construir hasta confirmar.
- (24) Entregas parciales: ¿alguien entrega antes de cerrar la orden y a qué costo? *Propuesta:* no construir.
- (25) Maquila: ¿cómo se paga y de dónde sale la tarifa por unidad? *Propuesta:* el maquilador es un proveedor; el costo viene de su factura o de una tarifa pactada.
- (26) Lotes de vencimiento y trazabilidad: ¿es requisito legal para algún cliente? (norma) *Propuesta:* diseñarlo en Inventario; trazabilidad en segunda fase.
- (27) Despacho de lotes: ¿se usa? ¿Por qué solo acepta órdenes sin procesar? *Propuesta:* no migrar; reporte de órdenes por fecha de envío.
- (28) Desperdicio y catálogos sin uso: ¿qué quieren medir? *Propuesta:* migrar el desperdicio solo si lo piden.
- (30) ¿Cuánto histórico se migra? *Propuesta:* todo, sin registros borrados.

### Activo fijo — [lista](afijo64/open-questions.md)
- (1) ¿Qué clientes lo usan y siguen usándolo? *Propuesta:* migrar completo; módulo opcional por empresa.
- (3) ¿Qué cifra da el contador por buena: el acumulado por cuotas o el de la ficha del activo? ¿Alguien corrió una reparación manual y cuándo? *Propuesta:* las cuotas son la verdad; entregar el informe de diferencias.
- (8) ¿El contador acepta la diferencia de centavos en la última cuota? *Propuesta:* mantener.
- (11) Activo totalmente depreciado: ¿se necesita sacarlo de los listados? *Propuesta:* estado calculado y reporte de los que siguen en uso.
- (13) Valor residual: ¿cuál es el residual real del activo cuyo dato está desbordado? *Propuesta:* residual igual a costo menos valor a depreciar.
- (15) Mejoras y adiciones: ¿algún cliente capitaliza mejoras sobre un activo existente? *Propuesta:* activo nuevo ligado al original.
- (16) Traslados entre áreas o responsables. *Propuesta:* historial en bitácora y reporte por responsable.
- (17) Compra del activo: ¿contabilizarla desde el alta? *Propuesta:* fuera de la primera versión.
- (18) Revaluaciones. *Propuesta:* no construir.
- (26) Responsables de activos (sin relación con planilla). *Propuesta:* mantener y enlazar con empleados más adelante.
- (28) Campos sin uso: ¿debe existir número de factura de compra? *Propuesta:* no migrar los campos sin uso.
- (29) Código del activo: ¿qué significa el prefijo? *Propuesta:* editable, único por empresa, con sugerencia del siguiente.

### Planilla — [lista](plan64/open-questions.md)
- (1.1) ¿Sigue en uso y qué otros clientes tienen planilla? *Propuesta:* migrar completo para el cliente actual; los regímenes sin uso, tras probarlos con otros clientes.
- (1.2) Recursos humanos (contratos, capacitaciones, asistencia y otros): ¿qué se usa? *Propuesta:* primera versión solo con lo que afecta el pago y los documentos de ley.
- (1.3) ¿Algún cliente corre varios patronos con una planilla consolidada o traslada empleados entre ellos? *Propuesta:* un patrono es una empresa.
- (1.5) Tipos de pago: ¿algún cliente necesita jornal diario o destajo? *Propuesta:* no construir.
- (2.2) ¿Se necesitan quincenas anteriores a 2021-07? *Propuesta:* importar las 48 existentes como cerradas, con la renta acumulada del año como saldo inicial.
- (3.6) Aporte para capacitación (INSAFORP): ¿hay umbral por número de empleados? (norma) *Propuesta:* aporte patronal con vigencia, confirmado por el contador.
- (3.7) Banderas dudosas ("no calcular AFP", salto de julio en seguros, plan juvenil): ¿para qué sirven? *Propuesta:* no migrar la primera; las demás como conceptos configurables.
- (3.8) Regímenes IPFA e IVM: *Propuesta:* no implementar hasta que un cliente los necesite.
- (4.4) Modo mensual con anticipo de 15 días: ¿lo usa algún cliente? *Propuesta:* frecuencia mensual con anticipo como concepto.
- (4.5) Ausencias: ¿los permisos con goce, suspensiones y retiros se tratan igual y quién autoriza? *Sin propuesta.*

## 5. Decisiones técnicas que tomaremos nosotros salvo objeción

- **Nada se borra físicamente:** los documentos se anulan y los catálogos se desactivan; no se elimina una cuenta bancaria o proveedor con movimientos. ([BANCOC 7](bancoc/open-questions.md))
- **Los saldos se calculan, no se guardan** (cartera, existencias, depreciación acumulada, saldos de cuentas bancarias); las estadísticas de pago y los campos informativos también se calculan. ([CXC 28, 29](cxc64/open-questions.md); [AFIJO 10](afijo64/open-questions.md); [BANCOC 33](bancoc/open-questions.md))
- **Toda contabilización pasa por un contrato único** con origen y enlace al documento, y el número de la partida lo asigna Contabilidad (la parte que afecta al negocio está en P2).
- **Importes con decimales exactos**, redondeo definido por concepto; cantidades y costos unitarios de producción con 5 decimales y totales contables con 2; las diferencias de un centavo contra el histórico se informan, no se fuerzan. ([PLAN 3.9](plan64/open-questions.md), [LOTE 20](lote64/open-questions.md))
- **Identificadores internos estables:** el código de producto, empleado o activo se puede cambiar sin tocar otras tablas; el documento de identidad del empleado se guarda aparte y cifrado, y se conserva el código viejo para la importación. ([INV 40](inv64/open-questions.md), [PLAN 2.5](plan64/open-questions.md))
- **Tasas, topes, tablas y formatos con fecha de vigencia**, guardados como datos y no escritos en el programa; códigos fijos de Hacienda en tablas de catálogo. ([IVA 23](iva64/open-questions.md))
- **Pistas de auditoría en todo** (quién, cuándo, valor anterior y nuevo), módulos opcionales por empresa y una instalación con varias empresas.
- **Bancos:** mover las sucursales al módulo de impuestos; no migrar la clasificación de remesas; eliminar el parámetro de correlativos con Bancos (siempre asigna Contabilidad); la referencia de paridad es el saldo recalculado y el de la cuenta contable. ([BANCOC 4, 15, 20, 33](bancoc/open-questions.md))
- **IVA:** corregir el spec de Bancos sobre el destino de "Ingresar al IVA"; el importador recibe las rutas por parámetro y no ejecuta transferencias; importador genérico de CSV con vista previa que no repite el defecto conocido. ([IVA 3, 35, 36](iva64/open-questions.md))
- **Activo fijo:** proveedor como texto de referencia hasta que exista Cuentas por pagar. ([AFIJO 27](afijo64/open-questions.md))
- **Supuestos S1 a S19 de [REPORTE.md](REPORTE.md):** valores con los que se construyó Contabilidad (roles, cierre de mes, importador). Los que tocan al negocio se cubren en P9 y en las preguntas R4 a R9 de la sección 4.

## 6. Ya decidido (no volver a preguntar)

De CONTAC ([lista](contac/open-questions.md)), decididas el 2026-11-10:
- **1. Partidas descuadradas:** una partida es borrador o aplicada; el borrador puede estar descuadrado y no afecta saldos; para aplicarla, cargos igual a abonos. El importador trae las descuadradas del sistema anterior marcadas y las reporta.
- **2. Catálogo por período fiscal:** un solo catálogo por empresa; las cuentas se desactivan, nunca se borran; los cambios quedan en bitácora.
- **4. Cierre anual:** año fiscal configurable (enero a diciembre por omisión), sin partida de apertura; los saldos se calculan desde las líneas; la partida de cierre queda marcada.
- **5. Numeración:** mensual por tipo de partida, como hoy; la migración no renumera; una partida anulada conserva su número.
- **13. Moneda:** una moneda por empresa, sin multimoneda; dos decimales.

De la tabla de decisiones del [playbook](README.md):
- **Estrategia:** módulo por módulo; se re-implementa desde un spec, no se traduce código.
- **Orden:** Contabilidad primero; luego Bancos, Cobrar, Inventario y Lotes, IVA, Activo fijo y Planilla (ajustable); Cuentas por pagar junto con Bancos.
- **Módulos nuevos:** Bancos, IVA, Lotes y Cuentas por pagar tienen módulo propio.
- **Idioma:** la interfaz va en español primero.
- **Estilo de pantallas:** familiar al sistema anterior (barra de íconos en el mismo orden, encabezado con líneas, totales y diferencia, selector de mes), más limpio.
- **Varias empresas:** una instalación es una base cifrada por cliente; cada dato lleva su empresa; la consolidación es una consulta entre empresas.
- **Roles:** los niveles del sistema anterior pasan a roles de la plataforma.
- **Codificación:** el importador convierte a UTF-8 los textos del sistema anterior.
- **Saldos:** se calculan desde las líneas de partida.
- **Borrado:** anulación, nunca borrado físico.
- **Integraciones:** los módulos publican partidas al libro mayor, que guarda su origen.
