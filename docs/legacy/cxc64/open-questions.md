# cxc64 — Preguntas abiertas

Decisiones que necesitamos del negocio antes o durante la construcción. Cada una trae una **propuesta** (la respuesta con la que se avanza si nadie contradice). Contexto: solo se pudo revisar **una empresa**, con 1,792
clientes, 56,774 facturas y 57,183 abonos de 2017 a octubre de 2026; el libro mayor del disco llega solo a marzo de 2024. Las respuestas deben confirmarse con más clientes. Varias preguntas son comunes con
[BANCOC](../bancoc/open-questions.md) (antigüedad, cierre, posteo al GL, bitácora); aquí solo se repiten cuando cambia la respuesta.

## A. Alcance y destino

1. **¿Quién factura?** La factura con líneas de producto nace en inventario y escribe la fila `C0` en cartera (99.9 % de las facturas del disco). La pantalla "Creación de Facturas/comprobantes" de CxC es una captura
   manual del encabezado (38 facturas con su concepto). *Propuesta:* la factura se crea en `inventory` y llega a `accounts-receivable` por API; la captura manual queda como función opcional para empresas sin inventario.
   ¿Hay clientes que usan CxC sin inventario?
2. **¿Qué reportes se siguen usando?** Son 53 opciones de reportes (107 `.frx`). Candidatos a no migrar al inicio: Movimientos por vendedor/resumen, Tabla de cobros por periodo, KPI de creación de clientes,
   Despachos transportista, Visitas a clientes, el "Cuadro de análisis de cobros", y las variantes de antigüedad duplicadas. *Propuesta:* migrar un motor de antigüedad, estado de cuenta (cliente y matriz), auxiliar y histórico de
   documentos/cliente/cheque, notas no aplicadas, cheques postfechados, límites de crédito, vencimientos/programación de cobros, corte de caja, ventas y cobros por vendedor; el resto según respuesta.
3. **Tipos sin uso:** `PA` (pago anticipado), `C5`/`CR` (comprobante de retención), `A7`, `A8`, `C6`, `A2` no tienen movimientos. *Propuesta:* migrar el catálogo tal cual pero construir pantalla solo para anticipos (pregunta 18),
   abonos internos (A5, 128 filas) y cargos internos; los demás no.
4. **Logística de reparto:** rutas de despacho, rutas de cobro automáticas, transportistas, vehículos, ayudantes (más de 60,000 filas de detalle). *Propuesta:* no son cuentas por cobrar; no se migran al primer corte. Si el negocio los necesita
   van a un módulo de distribución. La **liquidación** sí se migra (porque agrupa los recibos de un cobrador). ¿Se sigue usando el despacho como control o ya lo cubre la factura electrónica?
5. **Límite de crédito, "suspendido" y "cliente de contado":** el sistema viejo no los hace cumplir (solo informa el saldo disponible; solo "inactivo" bloquea, y solo en inventario). *Propuesta:* configuración `credit_limit_mode`
   (ninguno/advertir/bloquear) por empresa, por defecto *advertir*; "suspendido" bloquea la facturación a crédito. ¿Se quiere endurecer?
6. **Cambiar código de cliente, mover documentos entre clientes y cambiar cartera de vendedor** hoy recorren varias tablas sin bitácora. *Propuesta:* se permiten con permiso `supervise`, bitácora y sin recorrer tablas (el id es estable);
   mover documentos entre clientes solo si el período está abierto.
7. **Comisiones de vendedores** (porcentajes por tipo de cobro, ISSS/AFP/renta, recibos de comisión; `COMI2`, `RENTA`, `cfg_*`): parecen copiadas del sistema de planilla. *Propuesta:* fuera de CxC; un módulo `commissions` futuro que lea los
   cobros (el abono guarda `PORCOMI` por fila). ¿Siguen siendo necesarias y quién las calcula hoy?
8. **Presupuestos de ventas y cobros y KPI** (8 opciones, `PVENDE`, `PCLIENTE`): *Propuesta:* no migrar al inicio; importar los datos a una tabla de consulta si el negocio lo pide.

## B. Documentos, impuestos y numeración

9. **Retención de IVA por cliente gran contribuyente (`IVAPER`).** Una tasa única (`cfg_ivaper`) con monto mínimo (`cfg_mper`) solo aplica a crédito fiscal; en consumidor final el valor se escribe a mano; en la nota de crédito de consumidor
   final se **suma** en vez de restarse; la columna se llama "percibido" pero la pantalla dice "Retención". *Propuesta:* un solo servicio de impuestos con tasa y mínimo configurables, el signo corregido (nota = reverso de la factura), la columna
   `vat_withheld`, y la regla para empresa gran contribuyente (que percibe) separada de la que retiene el cliente. Confirmar con el contador el tratamiento de las facturas con retención en el libro de IVA.
10. **Exportación (`FTICOM = 'E'`).** La pantalla le calcula IVA al gravado como al crédito fiscal, pero en los datos los 21 documentos de exportación tienen IVA = 0 (18 con gravado > 0 y ninguno con exento): el IVA se pone en cero a mano o lo fija inventario; el libro de IVA las junta con consumidor final. *Propuesta:* exportación sin IVA (tasa 0 o
    todo exento) y destino propio en el libro. ¿Es correcto?
11. **Numeración y unicidad.** Facturas: único por tipo C/F/E + número (no incluye serie ni resolución); notas de crédito A1/A3 comparten secuencia y A6 tiene la suya; los recibos pueden repetirse entre clientes y liquidaciones (799 casos).
    *Propuesta:* factura única por `(empresa, tipo, serie, número)`; el número de recibo lo asigna AR (secuencia por empresa) y el número de la boleta física queda como referencia; ¿se necesita mantener la numeración vieja o que las
    notas de crédito sigan una secuencia por tipo?
12. **Fuente `cxc` en el libro mayor.** `GL_ENTRY_SOURCES` solo tiene `manual, bancos, iva, cierre, importado`. *Propuesta:* agregar `cxc` (cambio pequeño en `modules/general-ledger` y `packages/shared`), igual que `cxp` en BANCOC (pregunta 21 de ese spec);
    el GL rechaza editar o anular directamente una partida `cxc`.
    Además, como los módulos no se importan entre sí, hace falta un **contrato de posteo compartido** (en `@accounting/shared`) que usen Bancos, CxP, CxC e IVA.

## C. Contabilidad

13. **Cuentas contables.** Las cuentas de los 16 tipos de movimiento, la cuenta de cada cliente y las de IVA/flete/retención están en archivos de configuración; en la copia de CONTAC que hay en disco la mayoría **no existe** en el catálogo (la copia
    llega a marzo de 2024 y la cartera a octubre de 2026). Además 1,786 de 1,789 clientes comparten la misma cuenta de control. *Propuesta:* validar al importar contra el plan de cuentas vigente, una cuenta de control por empresa
    (`ar_settings.ar_control_account_id`) y cuenta por cliente solo si se pide. **¿Pueden entregar el libro mayor actualizado (hasta octubre de 2026) para verificar el posteo y la paridad?**
14. **Historial de partidas.** Las 880 partidas del libro de CONTAC que vienen de CxC (concepto "VENTAS DEL…" / "ABONOS DE CLIENTES DEL…", 2022-02 a 2024-03) no tienen vínculo con los documentos y sus líneas no coinciden con el código actual;
    la marca `generado` es 0, 1, 9 o vacío. *Propuesta:* el importador crea un lote `posted` por partida (por concepto + rango) y marca la partida como `source = 'cxc'` (excepción de migración, igual que Bancos); no se vincula documento por documento.
    ¿Alguna se editó legítimamente en CONTAC? ¿Se contabilizaron los períodos anteriores a 2022-02 y posteriores a 2024-03 de otra forma?
15. **Cierre de mes.** CxC tiene su propio cierre (`CIERREC`, con clave) independiente del cierre contable; **reabrir no pide clave ni deja rastro**; el último cierre es abril de 2024 y hay 32,231 movimientos posteriores sin cerrar.
    *Propuesta:* usar el estado del período del GL (`gl_periods`) como única fuente, con un cierre de cartera opcional (`ar_periods`) que solo `supervise` abre/cierra, con motivo y bitácora. ¿Se necesita cerrar cartera antes que contabilidad?
16. **Cómo se contabiliza.** Hoy: cinco procesos manuales por lote (rango de fechas), sin marca de lo ya contabilizado y con riesgo de duplicar o dejar huecos; las devoluciones no consideran la retención ni el exento; los abonos internos (A5) nunca se
    contabilizan. *Propuesta:* un lote por rango y tipo con **items** que impiden contabilizar dos veces, vista previa editable, y opción *una partida por documento* (empresas que lo prefieran); los A5 se contabilizan contra la cuenta que defina el
    tipo. ¿Con qué frecuencia contabilizan (diario, semanal, mensual)? ¿Quieren una partida por documento?
17. **Cuentas del cliente en cada tipo de abono.** El abono sin fecha de cobro debita la cuenta de caja/bancos del tipo `A0`; el que trae fecha de cobro (cheque postfechado) debita "cheques postfechados". *Propuesta:* mantener ambos roles y que el depósito de Bancos
    mueva de "cheques postfechados" a la cuenta bancaria. Confirmar con el contador.

## D. Cobranza, cheques y bancos

18. **Pagos anticipados (`PA`):** 0 registros y sin pantalla para aplicarlos. *Propuesta:* anticipo = recibo sin aplicaciones (saldo a favor del cliente) que se aplica a facturas; construir cuando algún cliente lo pida.
19. **Cheques postfechados y rechazados.** El cheque en poder de la empresa queda como partida `C3` (que sigue sumando en la cartera hasta que se remesa), el rechazo crea un cargo `C2` aparte sin reabrir la factura. 615 postfechados, 1 rechazado en 9 años.
    *Propuesta:* el cheque es un instrumento con estados; el rechazo reabre la deuda ligándola a la factura original; el cliente puede verse con o sin cheques postfechados en el saldo. ¿Los postfechados cuentan como saldo del cliente o como cobrado?
20. **Reportes de "lavado de dinero"** (cobros en efectivo, abonos por periodo): ¿qué umbral y qué formato exige la ley que aplican? *Propuesta:* un reporte configurable de cobros en efectivo mayores a un monto, por cliente y rango de fechas.
21. **Copias de `CCMOV01` y tablas de trabajo en `FUENTE`** (`CAL`, `REVISA`, `LORENA`, `WILDA`, `anti2`, `MOVIMI`, `cobroco2`, `VALIDA`…): parecen respaldos con datos reales. *Propuesta:* no migrar; confirmar que no contienen movimientos que no estén en `CCMOV01`.
22. **Campo `BUTTER`** (43,946 facturas y 412 cheques marcados; la tabla de comisiones `COMI2` tiene columnas `COBUTTER` y `TOTCOBU` y `PAGOCO.MEM` una variable `COMIBU`, lo que sugiere una línea de producto con comisión propia): ¿qué significa (línea de producto, tipo de comisión)? *Propuesta:* migrar como atributo `product_line_flag`
    hasta que se aclare.
23. **Recibos repetidos a otro cliente (`cfg_repetir`).** Un mismo número de recibo se aplicó a más de un cliente en 799 casos y a varias liquidaciones en 189. *Propuesta:* un recibo pertenece a un solo cliente (o a un grupo/matriz explícito); el importador separa los casos.
24. **Liquidación.** Hoy el efectivo y los cheques no se cuadran contra la remesa (los campos de totales están en cero) y la cuenta bancaria casi nunca se captura (10 de 11,031). *Propuesta:* la liquidación exige que efectivo + cheques = remesa depositada,
    registra la cuenta y genera/vincula el depósito de `banking`. ¿Quién deposita y cómo se concilia hoy?
25. **Venta de contado.** Hoy se factura a plazo 0 y luego "Cancelar Ventas de Contado" genera el abono en efectivo por el total. *Propuesta:* al emitir una factura de contado, inventario crea el recibo en el mismo acto (con caja y forma de pago); la utilidad queda para
    corregir históricos. ¿Se cobra siempre en efectivo?
26. **Descuentos por pronto pago, intereses y recargos por mora:** no existen en el sistema viejo. ¿Se necesitan en la nueva plataforma? *Propuesta:* no.

## E. Saldos y reportes

27. **Base de la antigüedad.** El reporte principal cuenta los días desde la **fecha del documento** (no del vencimiento) y mezcla en el primer tramo lo vigente y lo vencido a menos de 30 días; hay una variante "por días vencidos". Las notas de crédito sin aplicar restan en el tramo
    de su fecha. *Propuesta:* una sola antigüedad con base elegible (documento o vencimiento) y tramos configurables (por defecto *por vencer*, 1–30, 31–60, 61–90, 91–120, 121–150, 151–180, ≥ 181). ¿Qué tramos usan?
28. **Estadísticas de pago (`P90`, `DIASP`, `VECESP`).** ¿Se usan para algo más que informar? *Propuesta:* calcularlas en el reporte de comportamiento de pago (días promedio, % de facturas pagadas a más de 90 días); no guardarlas.
29. **Saldo del cliente en la ficha:** los campos guardados valen cero o están incompletos. *Propuesta:* siempre calculado; el estado del crédito (tramos y saldo disponible) se muestra en la ficha.

## F. Datos y operación

30. **Datos sucios que hay que limpiar o aceptar:** 3 movimientos sin tipo, 12–15 sin fecha, 5 con fecha anterior a 2017, 2 códigos de cliente repetidos, 47 movimientos con cliente inexistente (45 son anulados), 7 notas de crédito aplicadas a facturas que no existen, 9 remesas sin cheque,
    8 facturas con sobrepago, 42 facturas cuyo total no cuadra con sus componentes. *Propuesta:* importar y reportar; el negocio decide cuáles corregir en el sistema viejo antes de la migración final.
31. **Más clientes.** Solo hay una empresa en disco. Falta revisar si otras instalaciones usan anticipos, cheques postfechados, cierre de cartera, comisiones, multimoneda (CxC no maneja moneda: se asume la de la empresa), cuenta por cliente, etc. *Propuesta:* repetir esta revisión
    por cliente antes de importar.
32. **Reportes impresos para la paridad.** Hace falta al menos una antigüedad de saldos (`ccranti2`), un estado de cuenta y una "Ventas y Bancos" impresas de un mes cerrado, para comparar contra la nueva plataforma al centavo.
33. **Formatos de impresión** del recibo (`ccrecibo`), nota de crédito (`inrnc02`) y nota de débito (`inrnd01`) por empresa (`EMPRESAS.FORMANC/FORMAND`), la ficha del cliente y los reportes con membrete. *Propuesta:* un recibo y notas estándar; levantar los formatos reales con el cliente.
34. **Documentos tributarios electrónicos.** Inventario emite y anula el DTE (`FELECTRO`); CxC solo recibe la serie/resolución. *Propuesta:* AR guarda el código de generación, número de control y sello por documento y **recibe de inventario las anulaciones** (evento), no las reescribe;
    ¿las notas de crédito/débito electrónicas se emiten desde CxC o desde inventario hoy?
35. **Clasificación del cliente (`FTIPC` A/B/C/…)**, `TIPOCLI`, `TCLIENTE` (I/P), lista de precios y `DESCUENTO`: ¿qué significan hoy y quién los usa? *Propuesta:* migrar como atributos; la lista de precios y el descuento pertenecen a inventario.
36. **Permisos y bitácora.** Hoy cinco banderas por pantalla (abrir, agregar, modificar, eliminar, anular) y el nivel de usuario 1 para algunas acciones; la bitácora existe pero no cubre cierres, reapertura, cambios masivos ni la contabilización. *Propuesta:* `capture`/`reports`/`supervise`;
    `supervise` para anular un documento con recibos, reabrir, contabilizar/anular lotes y cambios masivos; bitácora en todo.
