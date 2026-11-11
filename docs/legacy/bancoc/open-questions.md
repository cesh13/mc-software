# BANCOC — Preguntas abiertas

Decisiones que necesitamos del negocio antes o durante la construcción. Cada una trae una **propuesta** (la
respuesta con la que se avanza si nadie contradice). Contexto: solo se pudo revisar **una empresa** (3 cuentas
bancarias, 2,691 movimientos, 204 documentos de CxP); las respuestas deben confirmarse con más clientes.

## A. Alcance y destino

1. **¿CxP se usa en todos los clientes?** En el legado depende de `cfg_prove` y vive dentro de Bancos.
   *Propuesta:* módulo `accounts-payable` propio y opcional por empresa; Bancos funciona sin él.
2. **Cheques a contratistas / control de obra** (`cfg_obra`, tablas `CHEQUE`, `CONTRAT`, `copend01`).
   Apagado y sin datos aquí. *Propuesta:* no migrar; ¿algún cliente lo usa?
3. **¿Qué reportes ya no se usan?** Candidatos a no migrar al inicio: Consolidado de Movimientos, Movimientos
   Diarios, Documentos Recibidos por Fechas, los dos históricos, Abonos por Períodos, Programación de Pagos.
   *Propuesta:* migrar Libro Auxiliar, Saldos, Disponibilidad, Cheques emitidos/postfechados, Conciliación,
   Antigüedad, Estado de cuenta, Auxiliar de proveedores; el resto según respuesta.
4. **Sucursales** (`UNIDADES`) solo alimentan el libro de compras y están vacías. *Propuesta:* mover al módulo `tax`.
5. **Pantallas fuera del menú** (`sbmtran`, `sbrecon`, `sbrpro01`, `cgcopipa`, tabla `REMESA`): ¿alguna se usó alguna vez?
   *Propuesta:* ignorarlas.

## B. Cuentas bancarias y monedas

6. **Tipos de cuenta** (caja, ahorros, a plazo, otra): ¿se usan además de la corriente? La tasa de interés de
   las cuentas a plazo nunca se guardó. *Propuesta:* conservar el tipo; la tasa como campo informativo nuevo.
7. **Eliminar una cuenta bancaria o un proveedor con movimientos** hoy borra todo. *Propuesta:* solo desactivar;
   rechazar si hay documentos no conciliados o saldo pendiente.
8. **Fecha del saldo inicial** (`fechasal`): ningún movimiento puede ser anterior. ¿Se quiere mantener esa regla
   o permitir movimientos antes (con saldo inicial 0)? *Propuesta:* mantenerla.
9. **Multimoneda.** El legado tiene 5 códigos de moneda por cuenta y un tipo de cambio manual; la plataforma
   decidió una moneda por empresa. Aquí todas las cuentas son en dólares. *Propuesta:* mantener la decisión;
   el importador falla con aviso si una cuenta tiene otra moneda.

## C. Documentos bancarios

10. **Transferencias entre cuentas propias.** `MOVIBAN.XFER` y `sbmtran` sugieren que existió, pero el código
    (`estrans`) no está y la opción no está en el menú. *Propuesta:* documento de transferencia nuevo con dos patas
    ligadas y una sola partida.
11. **Estatus del cheque (firmado, entregado, cobrado):** casi no hay datos. ¿Se quieren conservar los cuatro
    estatus? *Propuesta:* sí (son casillas baratas), con fechas y quién recibe.
12. **Reutilización de números.** En el legado un cheque es único por cuenta + tipo en todo el tiempo, y los demás
    documentos por mes. Hay llaves de partida compartidas por dos movimientos (transferencias con dos patas).
    *Propuesta:* cheque único por cuenta sin importar el mes; los demás por cuenta + tipo + período + número; las dos
    patas se modelan como dos documentos con la misma partida.
13. **LIOF.** (a) El código solo genera el impuesto cuando `TMOV.TIPO_OPE = 1` (tipos que cargan banco), no para
    el cheque (2), y sin embargo hay 164 líneas de impuesto y 22 documentos con la casilla marcada: ¿a qué documentos
    se aplica de verdad, cheques, transferencias o ambos, y es siempre sobre el monto del documento? (b) El umbral de
    1,000 está fijo en el código: ¿es el valor legal vigente? *Propuesta:* umbral y tasa configurables; el
    impuesto como línea del documento; aplicable a cheques y transferencias de salida de cuentas no exentas.

## D. Integración con el GL

14. **Historial y la marca `generado`.** La versión actual de Bancos ya no escribe `generado = 1`; las partidas
    recientes vienen vacías. *Propuesta:* el importador enlaza por `MOVIBAN` (salfec + tipopar + número) y marca
    esas partidas `source = 'bancos'` aunque `generado` esté vacío (excepción de migración); las partidas sin
    movimiento quedan como `importado`. Confirmar que ninguna partida de Bancos se editó legítimamente en CONTAC.
15. **Clasificación de remesas** (`cfg_liqui`, `CLASIF`): apagada y vacía. *Propuesta:* no migrar.
16. **Editar desde CONTAC una partida generada por Bancos.** Hoy se puede (por lo anterior) y por eso `DETABANK` y
    `DETAPART` difieren en el 8 % de las líneas. *Propuesta:* prohibirlo (el GL rechaza editar partidas con
    `source = 'bancos'`); si hace falta corregir, se anula el documento o se hace un ajuste manual aparte.
17. **Remesa concentrada** (`sbreme01`, `cgadipa2`): crea una partida directa y genera movimientos bancarios a
    partir de las líneas que tocan una cuenta de banco. *Propuesta:* quitar esa pantalla; la remesa se captura como
    documento de depósito con varias contrapartidas, y los movimientos sin documento se vinculan a mano.
18. **Numeración de la partida:** en el legado el número sale del mayor existente del mes (compartido con CONTAC). *Propuesta:*
    pedirlo al GL (siguiente número por tipo y mes). ¿Alguien captura el número a mano para que coincida con un
    voucher físico? Si sí, se permite el cambio antes de aplicar.
19. **Anular documento.** El legado conserva el documento y deja la partida con líneas en cero y el concepto
    "ANULADO". *Propuesta:* anular la partida (estado y número conservado). Los reportes de partidas emitidas deben
    mostrar la anulada con su número.
20. **`cfg_bancos`** ("integración de correlativos con Bancos"): su efecto está en `conta()`, que no está en el
    proyecto, y `TIPOPAR.BANCOS` es falso en todos los tipos. *Propuesta:* eliminar (el GL siempre asigna el número).
21. **Fuente de las partidas de CxP.** `GL_ENTRY_SOURCES` solo tiene `manual, bancos, iva, cierre, importado`.
    *Propuesta:* agregar `cxp` (cambio pequeño en `modules/general-ledger` y `packages/shared`) para las provisiones;
    alternativa: publicarlas como `manual` (no recomendado: no quedarían bloqueadas).

## E. Conciliación bancaria

22. **¿Se usa?** En los datos 0 de 2,691 movimientos están conciliados. El legado solo marca ítems y no captura el
    estado de cuenta. *Propuesta:* pantalla de marcar + saldo del banco + diferencia, conciliación por mes con cierre.
    Importar el estado de cuenta (archivo del banco) queda como fase posterior; ¿qué bancos y formatos?

## F. Impuestos y cuentas por pagar

23. **IVA percibido** usa la tasa `cfg_ivare` (la de retenido). ¿Es correcto o debería haber una tasa propia?
    *Propuesta:* dos tasas separadas en la configuración, igual al valor actual por defecto.
24. **Umbral de retención.** El código retiene `afecta × tasa` siempre que la empresa sea gran contribuyente, el proveedor
    no, y exista número de comprobante; no hay monto mínimo. ¿La ley exige un mínimo por documento? *Propuesta:* campo
    configurable (hoy 0) y validación al capturar.
25. **Vencimiento al viernes.** El sistema corre la fecha de vencimiento al viernes de esa semana (programación de pagos
    semanal). ¿Todos los clientes pagan en viernes? *Propuesta:* mantenerlo como opción de la empresa (activa por defecto).
26. **Granularidad de la provisión.** Hoy se arma por documento y se junta en una partida por lote. ¿Se quiere una
    partida por documento? *Propuesta:* ambas opciones; por lote por defecto (como hoy).
27. **Pagos parciales y manuales.** Se permiten pagos parciales y cancelaciones manuales sin documento bancario
    (`sbmfac03`). *Propuesta:* mantener; los manuales deben generar su partida (hoy no la generan) o quedar como
    "pago registrado por fuera" con motivo obligatorio.
28. **Tramos de antigüedad** (≤ 0, 1–30, 31–60, 61–90, 91–120, ≥ 121 días desde el vencimiento): ¿se mantienen?
    *Propuesta:* sí, configurables.
29. **Libro de compras y DTE.** `sbmfac01` lee un JSON de DTE y manda el documento al libro de IVA. ¿Sigue siendo así
    (módulo `tax`)? *Propuesta:* CxP guarda los datos del DTE; `tax` arma el libro a partir de los documentos.
30. **Permisos y bitácora.** Hoy los documentos bancarios (emitir, modificar, anular, eliminar) **no** dejan bitácora y los
    permisos son por pantalla. *Propuesta:* bitácora en todo; permisos `capture`/`reports`/`supervise` del manifiesto, con
    `supervise` para anular cheques impresos y para generar provisiones.

## G. Datos y operación

31. **Formatos de impresión de cheque y de quedan.** Hay formatos por cuenta (`FORMACHK`) y por empresa (`cfg_formaq`) en
    reportes `.frx`. *Propuesta:* un formato de cheque configurable por cuenta (posiciones) y un quedan estándar; levantar
    los formatos reales de cada cliente.
32. **Otros clientes.** Solo hay una empresa y una carpeta de datos con ~27 meses de movimientos. No se ha revisado si otras
    instalaciones tienen cuentas en otra moneda, conciliaciones usadas, cheques a contratistas o CxP apagado. *Propuesta:* correr la
    revisión de este spec contra cada cliente antes de importar.
33. **Tolerancia de paridad.** `CTABANCO.saldoact` se actualiza por varios caminos y puede no cuadrar con los movimientos. *Propuesta:* la
    referencia es el saldo recalculado y el saldo de la cuenta contable en el GL; las diferencias contra `saldoact` se informan.
34. **Tablas de trabajo con datos** (`PP`, `PP2`, `KK`, `SALVE`, `DTEMP*`/`PTEMP*`): parecen copias de seguridad de datos reales.
    *Propuesta:* no migrar; confirmar que no contienen documentos que no existan en las tablas vivas.
