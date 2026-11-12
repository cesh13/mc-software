# INV64 — Preguntas abiertas para el negocio

Agrupadas por tema; cada una trae una **propuesta** cuando hay una. Las referencias `§` son a
[business-rules.md](business-rules.md). Prioridad alta = bloquea el diseño o el importador.

## A. Facturación electrónica (DTE) — prioridad alta

1. **El programa externo.** El código de INV64 solo *prepara* la fila en `FELECTRO`; otro programa firma, transmite y escribe
   número de control, código de generación y sello (§11.1). ¿Qué programa es, quién lo mantiene, dónde corre, es por lotes o
   continuo, y con qué proveedor/servicio se conecta? ¿Genera también el PDF, el QR y el correo al cliente?
   *Propuesta:* la nueva plataforma reemplaza ese programa con un módulo `dte` propio (interfaz `DteProvider`); hasta
   entonces, mantenerlo en paralelo leyendo la nueva tabla.
2. **Ambiente y modo.** `FELECTRO.AMBIENTE` y `EMPRESAS.MODOOP` están vacíos en esta copia. ¿Los 11,690 documentos son de
   producción? ¿Desde cuándo? *Propuesta:* tratar todo como producción desde 2024-11 y confirmar con una muestra.
3. **Contingencia y reintentos.** El código escribe contingencia fija `"null"` y no guarda el motivo de un rechazo. ¿Cómo se
   maneja hoy un documento rechazado o una caída de Hacienda? ¿Qué significan los 68 CCF con `FALLO = 1` ya procesados y los
   13 sin número de control? *Propuesta:* estados explícitos y cola de reintentos (`dte_events`); revisar a mano los 13.
4. **Invalidación.** La solicitud usa `tipoanula = 2` fijo y el nombre del usuario como motivo (§11.6). ¿Es correcto o se
   debería elegir el tipo y el motivo? ¿Se invalida siempre después de anular localmente? *Propuesta:* tipo y motivo
   elegibles y obligatorios; anulación local e invalidación en una sola operación.
5. **Establecimiento y punto de venta.** Los códigos de establecimiento y de punto de venta son **literales fijos en el
   programa**. ¿Hay más de una sucursal o caja? *Propuesta:* tablas `dte_establishments` y serie por punto de venta.
6. **Factura consumidor final ya transmitida.** `inmfac03` permite modificar un documento con DTE (solo el botón de enviar
   lo impide) (§9.1). ¿Es intencional? *Propuesta:* documento emitido inmutable.
7. **Versión de los esquemas.** `CORRE.VERSION` usa 1 para factura/exportación/sujeto excluido y 3 para CCF/notas, y las
   invalidaciones usan `"02"` fija. Contrastar con la **norma y los esquemas vigentes** antes de implementar; este spec no
   afirma ninguna regla de memoria.
8. **Remisión y otros tipos.** `inmpedi` intenta un DTE de remisión (tipo `R`) que no existe en `CORRE`. ¿Se emite remisión?
   *Propuesta:* no migrar.
9. **Compras recibidas por DTE.** "Leer json" solo acepta el tipo 03 y extrae campos buscando texto. ¿Se reciben otros tipos
   (notas de crédito de proveedor, exportación)? *Propuesta:* analizador JSON real y validación del esquema.
10. **Papel y PDF.** ¿Los formatos de impresión de CCF y consumidor final (`CCF`, `inrfac01/02`, `inrticke2`) siguen siendo
    necesarios en esa forma? *Propuesta:* plantilla nueva única con QR.

## B. Ventas, precios e impuestos

11. **IVA incluido vs. exclusivo.** CCF guarda precio sin IVA y consumidor final con IVA incluido; el encabezado recalcula el
    IVA sobre la base total (centavos de diferencia con la suma de líneas) (§3.4–3.5). ¿Cuál redondeo manda? *Propuesta:*
    por línea y total = suma, o sobre la base; elegir y documentarlo. Contrastar con la regla vigente.
12. **Percepción / retención 1 %.** El sistema usa un solo porcentaje (`cfg_perci`) y un monto mínimo (`cfg_grava`) para
    percepción y retención, y el signo depende de si la empresa es gran contribuyente (§3.6). ¿Son el mismo porcentaje?
    ¿Cuándo se percibe y cuándo se retiene? Contrastar con la norma.
13. **Nota de crédito sobre consumidor final.** Siempre suma IVA exclusivo, aunque el original sea `F` (§3.5; 8 filas). ¿Es un error?
    *Propuesta:* corregir en el sistema nuevo y marcar las 8 históricas.
14. **Reingreso de devoluciones.** Hoy entran al costo promedio **del día de la nota**, no al de la venta original (§5.1).
    ¿Qué quiere el negocio? *Propuesta:* al costo de la venta original (por línea), con el promedio actual solo para notas sin referencia.
15. **Validación contra el documento original.** Las notas de crédito no limitan cantidad ni producto al original (§5.1).
    ¿Se debe? *Propuesta:* sí, con excepción con permiso.
16. **Crédito y mora.** Hoy: advertencia con clave si hay saldo vencido o pago tardío; límite de crédito, "suspendido" y "contado"
    no se aplican (§3.1; ver cxc64 #5). ¿Política deseada: bloqueo duro, advertencia o aprobación?
17. **Descuento por documento.** `EMPRESAS.DESCUENTOT` cambia cómo se declara el descuento en el DTE (§11.4). ¿Es política de la
    empresa? ¿Se conserva el descuento por línea?
18. **Bonificaciones.** Salen a costo y se declaran como descuento (§3.3, §11.4); las unidades de regalo en una compra diluyen el
    costo unitario (§13.5). ¿Se mantiene?
19. **Listas de precio.** Nueve listas por producto y `CCCLI01.NPRECIO` por cliente; `PCLIENT` (precios por cliente) no se usa
    aquí. ¿Se usan las nueve? *Propuesta:* listas con vigencia.
20. **Nota de débito y nota de abono.** 8 y 2 filas en disco. ¿Se conservan? *Propuesta:* nota de débito sí (DTE 06); nota de
    abono no.
21. **Pedidos, prefacturas, remisiones y consignaciones.** Todas las tablas están vacías. ¿Se usan en otros clientes?
    *Propuesta:* no construir en el primer corte.
22. **Sujeto excluido.** Vive en el libro de compras, no en inventario; retención 10 % fija (§6). ¿Quién lo emite
    (compras/CxP)? *Propuesta:* mover a `accounts-payable`/`tax`.
23. **Exportación.** Flete y seguro entran al gravado de la exportación y no pasan por `FACT` (no se contabilizan en ventas)
    (§15.4). ¿Cómo se contabiliza hoy el flete de exportación?

## C. Numeración y series

24. **Número digitado.** Hoy los números de documento se digitan o se proponen sin bloqueo (§2.3). ¿Se mantiene la posibilidad de
    digitarlos? *Propuesta:* asignación automática por serie; digitación solo para migración/contingencia con permiso.
25. **Huecos.** ¿Hay documentos fiscales con huecos de correlativo? `danulado` los reporta a Hacienda desde una tabla `RESOL`
    que no está en disco. Entregar esa tabla o su contenido.
26. **"Cambiar número a un comprobante".** No actualiza `FELECTRO` ni los abonos (§8). ¿Se sigue usando? *Propuesta:* eliminar.

## D. Inventario y costeo

27. **Método de costo.** Promedio móvil por producto (todas las bodegas) con re-valuación en el cierre (§13, §16.3). ¿Es el
    método contable aceptado? ¿Debe haber costo por bodega? *Propuesta:* promedio por producto, **fijo al emitir**, sin re-valuación;
    ajustes explícitos.
28. **Confirmación para producción.** El spec de lotes supone `COSTO_PROM = BODMES.COSTOF/FINAL`; en INV64 es
    `MESES.COSTOF/FIN` (§13.7). ¿Se acepta un único promedio por producto y empresa? *Propuesta:* sí.
29. **Existencias negativas.** Permitidas con advertencia; 32 productos pasan por saldo negativo. ¿Se debe bloquear?
    *Propuesta:* configurable por empresa, por defecto bloquear salvo permiso.
30. **Productos con costo cero.** 127 sin costo promedio (18 servicios). ¿Se corrigen antes de migrar?
31. **Posteo y cierre.** El posteo vuelve a poner en cero y reconstruir las existencias de todos los productos (§16.3) y 24 meses
    del rango no están cerrados. ¿Cuándo se corre y quién? ¿Los costos de venta cambian después de facturar y eso es esperado?
32. **Meses cerrados que se reabren.** ¿Con qué frecuencia? *Propuesta:* permiso, motivo y bitácora.
33. **Claves compartidas.** La clave de cierre y la de conceptos con `PASSWORD` valen las de cualquier usuario (§16.5). *Propuesta:* permisos por acción.
34. **Transferencias.** Se registran con conceptos de salida (`SV`, `SA`, `PD`…) en ambas patas. ¿Qué concepto debe aplicar?
    *Propuesta:* concepto propio de transferencia.
35. **Conceptos con código repetido.** `SV`, `ED`, `EC`, `II` están dos veces; solo una `EC` tiene clave. Definir el catálogo
    final de conceptos antes de importar.
36. **Inventario físico.** No genera ajuste (§17.1). ¿Se usa? *Propuesta:* conteo con ajuste automático al aprobar.
37. **Lotes.** 574 de 645 productos llevan lote; 21 productos descuadran contra sus movimientos. ¿Qué cifra es la correcta?
38. **Bodegas 11–15.** `EXIST_ACT` solo suma las bodegas 1–10 tras el posteo. Hoy hay 4 bodegas; ¿habrá más?
39. **Importaciones / retaceo.** Sin datos y con código inconcluso (§13.6). ¿Se importa mercadería? Si sí, ¿cómo se costea hoy?
40. **Cambio de código de producto.** `cambia` renombra el código en 6 tablas pero no en lotes ni órdenes de compra.
    *Propuesta:* id estable; el código se puede cambiar sin tocar tablas.

## E. Compras y cuentas por pagar

41. **Compras en inventario vs. IVA/CxP.** La pantalla de compras registra stock, datos fiscales, la provisión a `QUEDAN` y la
    transferencia al libro de IVA a la vez; el enlace con el documento de CxP es por proveedor y número (§13.5, §10.2).
    ¿Quién es el dueño del documento de compra? *Propuesta:* CxP/`tax` dueño del documento; `inventory` recibe la mercadería y
    referencia el documento.
42. **`DATAMOV` en disco no trae los campos fiscales** que usa la pantalla (§10.2, §19 #1). ¿Dónde están guardados los datos de
    `SIIVA`, `NCONTROL`, `CODGENERA`, clasificación, sector y tipo de costo en producción? Pedir la copia viva.
43. **Percepción en compras y costo.** El IVA no entra al costo. ¿Y los gastos de importación? (ver 39).

## F. Contabilidad

44. **¿Qué contabiliza qué?** Las ventas se contabilizan tanto desde cxc64 como desde INV64; el costo solo desde INV64
    (§15.5). ¿Cuál proceso usa el negocio? *Propuesta:* contabilización por documento desde `sales` y `inventory`, un solo flujo.
45. **Sin vínculo documento→partida.** Rangos traslapados duplican y huecos omiten (§15.3). ¿Han ocurrido? Verificar contra
    CONTAC (fuera de este disco). *Propuesta:* contrato `gl.postEntry` con `source`/`sourceRef`.
46. **Productos sin cuenta.** 260 sin inventario, 261 sin ventas, 261 sin costo; las partidas omiten en silencio las líneas sin
    cuenta (§15.4). ¿Se completan antes de migrar?
47. **Mes de la partida.** El mes de la partida es el del inicio del rango, aunque cubra varios meses (§15.2). ¿Se corre siempre por mes?
48. **Costo de ventas con producción.** Cuando entre `LOTE64`, ¿quién contabiliza el costo de existencias: inventario o producción?
    *Propuesta:* inventario contabiliza movimientos; producción contabiliza solo su absorción de costos.

## G. Usuarios, auditoría y datos

49. **Permisos.** Los permisos de agregar/modificar/eliminar/anular se leen una vez al iniciar sesión; `INMMOV06` no revisa
    ninguno; la mayoría de las pantallas de venta no escriben bitácora (§16). *Propuesta:* permisos por acción y bitácora completa.
50. **Datos de más de un cliente.** Los datos de INV64 son del mismo cliente que cxc64/IVA64; el de lotes es otro. ¿Hay copia
    de inventario de más clientes (comercio sin facturación electrónica, manufactura)? Sin ella no se prueba la variación.
51. **Datos vivos.** Falta: `DATAMOV` vivo, `RESOL`, `CONTAC` posterior a 2024-03, y copias de cxc64/IVA64/INV64 del mismo día.
52. **Tablas de trabajo con datos reales** en `FUENTE` (`WILDA` con 197,725 filas, `VEN*`, `ARTI`…). ¿Se destruyen o se
    guardan fuera del repositorio?
53. **Comisiones y presupuestos.** Fuera del primer corte. ¿Se necesitan? (ver cxc64 preguntas 7 y 8)
54. **Reporte de ~150 pantallas.** ¿Cuáles usan realmente? *Propuesta:* pedir al negocio los 15 más usados y construir un motor de
    reportes; el resto bajo demanda.
55. **Etiquetas ("viñeta").** El módulo de viñetas (`CVINETA`, 0 filas; `CCPARTCO` la usa si `PREVINE>0`) parece de otro cliente
    (farma). ¿Se migra? *Propuesta:* no.
