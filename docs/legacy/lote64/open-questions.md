# LOTE64 — Preguntas abiertas

Decisiones que necesitamos del negocio antes o durante la construcción. Cada una trae una **propuesta** (la respuesta con la que se avanza si nadie contradice).
Contexto: solo se pudo revisar **una empresa** (22,643 órdenes de producción entre 2019-03 y 2020-10, 282 productos formulados). Y los datos de inventario y contabilidad que hay en disco **no son de ese cliente**
(los códigos de producto no coinciden con ningún `ARTICULO`; no hay movimientos de producción): todo lo que toca existencias y partidas está verificado **en el código**, no en los datos.

## A. Alcance, uso y datos

1. **¿Sigue en uso el módulo?** El código se compiló en 2021-12 pero las órdenes terminan en 2020-10 (50 siguen "pendientes", la más vieja de 2019-03). *Propuesta:* confirmar con el cliente si hay más datos recientes; si no, el módulo se
   migra para consulta del histórico y para el cliente que lo siga necesitando.
2. **Copia consistente de `INV64` y `CONTAC` del mismo cliente.** El `INV64/DBF` y el `CONTAC/dbf` que hay en disco son de otra empresa (articulos numéricos, sin conceptos `PR/EP/ET/SP/PP`, sin `ENTREGAP` ni `LOTEPADRE`).
   *Propuesta:* pedir la copia completa (carpeta `INV64` con `ARTICULO`, `MOVIMIEN`, `BODMES`, `MESES`, `SALDOLO`, `VENCE2`, `CONCEPTO`; y `CONTAC` con las partidas de costo) y `DBF.rar`. Sin ella, la paridad de existencias, costo promedio
   y partidas no se puede probar.
3. **¿Qué clientes usan producción?** Lo que muestra el código y los datos: lo usan los clientes que fabrican o empacan (en disco, 1 de 2 clientes de inventario; el otro no tiene ninguna orden). Por el contenido (llenado, etiquetado,
   semi-terminado, maquila, forma farmacéutica, desperdicio de horneado/fritura) el módulo se personalizó para al menos dos giros. *Propuesta:* módulo opcional por empresa; no activarlo por omisión. ¿Qué otros clientes lo necesitan y en qué giro
   (para no asumir el vocabulario del desperdicio)?

## B. Fórmulas

4. **Fórmulas duplicadas.** 47 productos tienen entre 2 y 7 encabezados vivos (32 con parámetros distintos) y 3,741 órdenes usan uno de ellos. *Propuesta:* quedarse con la última fila física como vigente y conservar las demás como históricas;
   que el negocio revise el reporte de diferencias (cantidad formulada, % indirectos, línea).
5. **Versiones y vigencia de fórmulas.** El sistema viejo reescribe la fórmula al modificarla; las órdenes ya hechas no la conservan (7,044 de 12,861 líneas muestreadas difieren de la fórmula actual). *Propuesta:* versiones con fecha de vigencia
   y una sola vigente; la orden congela la versión usada. ¿Se requiere aprobación de cambios de fórmula (calidad)?
6. **Medida base vs cantidad formulada.** `MBASE` ("Medida Base") es obligatoria y > 0 pero ningún cálculo la usa; `PROGRAMA` ("Cantidad Formulada") es el tamaño de la corrida. En 150 de 377 filas son iguales. *Propuesta:* migrar `PROGRAMA` como
   tamaño base de lote y guardar `MBASE` solo como dato informativo. ¿Qué significa para el negocio?
7. **Fórmula maestra** (`FORMULA2`/`DETAFOR2`, 12 fórmulas). Clon de la pantalla de fórmulas, sin otro uso. *Propuesta:* no migrar como tabla aparte; si son fórmulas aprobadas distintas de las de trabajo, importarlas como versiones. ¿Para qué se usan?
8. **Semi-terminados.** 433 líneas de fórmula (96 productos) usan como insumo un producto que tiene fórmula propia, pero el sistema no produce en cascada: consume existencias del semi-terminado. *Propuesta:* mantener ese comportamiento (el
   semi-terminado se produce con su propia orden antes); ¿se necesita explosión de materiales o "orden hija"?
9. **Sustitutos, subproductos, rendimiento esperado.** No existen en el sistema viejo. *Propuesta:* no construirlos al inicio; ¿algún cliente los necesita (merma esperada por fórmula, coproductos)?

## C. Órdenes de producción

10. **Numeración del lote.** El número lo digita el usuario con un patrón de letras + dígitos que parece significar línea/turno/fecha (patrones `A999999`, `AA99999`); el sugerido por la pantalla no sirve con ese patrón. *Propuesta:* mantener el número como texto único por empresa
    (hasta 20 caracteres) y ofrecer una plantilla configurable. ¿Qué significa cada parte (para validarla)?
11. **Estatus de la orden.** Seis estatus (programada, iniciada, intermedio, pte. horas, finalizada, P.T. maquila) que no gobiernan nada; 99.7 % de las órdenes quedó en `06 P.T. MAQUILA`. *Propuesta:* mantenerlos como catálogo de seguimiento opcional y
    separado del estado real (`programada → procesada → anulada`). ¿Alguno debe bloquear algo (p. ej. no procesar si no está "finalizada")?
12. **Cantidad fabricada distinta de la programada.** En 3,041 órdenes (13 %) la cantidad final difiere de la programada, y el sistema solo recalcula los insumos si se le pide; si no, el costo unitario absorbe la diferencia. *Propuesta:* siempre guardar
    programada y fabricada, recalcular insumos por omisión al cambiarla, y mostrar la variación de consumo. ¿Se espera tolerancia (±%) y aprobación?
13. **Modificar, eliminar y anular.** Hoy: procesada no se elimina; procesada sí se puede anular (reversa); `MOD`/`CI` se pueden cambiar sin recalcular; cualquier usuario con acceso a la pantalla puede hacerlo y no queda quién. *Propuesta:* anular una procesada exige permiso
    de supervisor, motivo y contra-asientos; modificar una procesada solo con permiso y deja auditoría; eliminar = anular. ¿De acuerdo?

## D. Inventario y costos

14. **Valuación del insumo y del producto terminado.** Los insumos salen a su costo promedio global (`ARTICULO.COSTO_PROM`) y el producto terminado queda con el promedio móvil **mensual de su bodega** (`BODMES.COSTOF/FINAL`). *Propuesta:* que `inventory` valúe con promedio móvil
    y devuelva el costo; reproducir exactamente el sistema viejo solo para la paridad de la migración. ¿El método oficial del cliente es promedio por artículo o por bodega?
15. **Existencias insuficientes.** Hoy no se procesa si falta cualquier insumo (global, por bodega o por lote de vencimiento) y se bloquea todo. *Propuesta:* bloquear por omisión, con permiso de supervisor para procesar con existencia negativa y reporte de las órdenes afectadas.
16. **Mes cerrado.** El sistema viejo **permite** procesar, anular y transferir en meses cerrados (la verificación está comentada) y solo bloquea el recálculo de costos. *Propuesta:* bloquear siempre en períodos cerrados y ofrecer reapertura con permiso y rastro. ¿Hay clientes que dependen
    de procesar con fecha de mes cerrado?
17. **"Actualizar Indirectos" y "Recalcular Costos".** La tarifa mensual (`CFINDI`) solo existe para 2013–2017; el proceso pone `MOD = 0` a las órdenes sin horas, solo cambia `CI` si hay horas (2 órdenes en disco tienen horas) y **no** corrige el costo promedio del inventario. "Recalcular" reescribe
    costos de órdenes y la entrada pero tampoco toca `BODMES`/`MESES`/`ARTICULO`. *Propuesta:* no migrar `CFINDI` ni "Actualizar Formulas"; reemplazar por un **recosteo** de período explícito que genere ajustes. ¿Los clientes usan alguna vez estas opciones? ¿Quién corrige hoy el costo promedio cuando cambia un costo de insumo?
18. **Base de los indirectos.** Al procesar, el % de indirectos se aplica sobre materiales + mano de obra **+ maquila**; al recalcular y anular, **sin** la maquila (170 órdenes con maquila). *Propuesta:* una sola regla; la del proceso (incluye maquila) porque es la que está grabada en los datos. ¿Es correcta?
19. **Viñeta (etiqueta).** Un costo por unidad que se suma al costo del producto terminado y se acredita a una cuenta propia; `EMPRESAS.CVINETA = F` en disco (apagado: 0 órdenes con viñeta). *Propuesta:* no migrarlo salvo que otro cliente lo use; ¿se usa?
20. **Precisión.** El sistema viejo guarda 5 decimales y redondea cada línea antes de sumar; el dinero de la plataforma nueva usa 2. *Propuesta:* cantidades y costos unitarios con 5 decimales, totales contables con 2, y el mismo orden de redondeo para la paridad. ¿Hay cifras que el cliente ve redondeadas distinto en sus reportes impresos?

## E. Contabilidad

21. **¿Cuándo y cómo se contabiliza la producción?** Hoy: a mano, por rango de fechas, **una partida resumen** de todo el período, directa al libro mayor, sin marcar qué órdenes entraron, con riesgo de duplicar si los rangos se traslapan y con la fecha/mes del primer día (un rango que cruza de mes
    se contabiliza completo en el primero). Concepto "COSTO DE VENTA" (copiado de otro proceso). *Propuesta:* contabilizar **por orden al procesarla** (o por período con cada orden marcada), con `source = 'produccion'`; la partida inversa al anular. ¿Prefieren seguir con el resumen por rango? ¿Cuándo se genera (diario, cierre de mes)?
    ¿Quién contabiliza la salida de insumos y entrada de producto terminado: `inventory` (si genera sus propias partidas de existencias) o `production`? Hay que alinearlo con el spec de INV64.
22. **Cuentas de absorción.** Hay cuatro cuentas configuradas (mano de obra, indirectos, maquilado, etiqueta) que se **acreditan** al trasladar el costo a producto terminado, y la cuenta de inventario sale de `ARTICULO.CTA`. *Propuesta:* configurarlas por empresa en `prod_settings`. ¿Es correcto que la contrapartida sea un crédito a esas cuentas
    (supone que los gastos reales se cargan a ellas por otra vía, p. ej. planilla)? ¿Hay centro de costo por línea?

## F. Maquila, traslados y entregas parciales

23. **Transferir materia prima al maquilador** (concepto `PP`). Funcionalidad con errores de código y sin datos. *Propuesta:* no construir hasta confirmar uso; si se necesita, una transferencia de `inventory` a la bodega del maquilador desde la orden. ¿Se usa? ¿La materia prima queda como existencia en
    bodega del maquilador (bodega 3 fija en el código)?
24. **Entregas parciales** (concepto `ET`/`SP`, bodega 17 fija). 0 usos en disco, falta la tabla `ENTREGAP`. *Propuesta:* no construir; ¿alguien entrega producto antes de cerrar la orden? ¿A qué costo se valúa la entrega parcial (hoy el promedio vigente, no el costo de la orden)?
25. **Maquila y compras.** La orden se liga a una orden de compra (`ORDENC`) solo para que el reporte de maquila por proveedor funcione, y 5,479 órdenes tienen maquilador, 171 tarifa de maquila, **0** orden de compra. *Propuesta:* el maquilador es un proveedor; el costo de maquila nace de la factura de servicio (CxP) o
    de una tarifa pactada por producto. ¿Cómo se paga hoy la maquila y de dónde sale la tarifa por unidad?

## G. Trazabilidad

26. **Lotes de vencimiento.** Existe el soporte (lote del insumo, lote y fecha de vencimiento del terminado, `VENCE2`/`SALDOLO`), pero en los datos casi no se usa (13 órdenes con lote, ninguna con vencimiento, ninguna línea con lote de insumo). Lo que el cliente llama "lote" es la orden. *Propuesta:*
    diseñar lotes/vencimientos en `inventory` y que producción solo los pase; consulta de trazabilidad ("¿con qué se hizo / a dónde fue?") como fase 2 solo para clientes con regulación (farmacia/alimentos). ¿Es requisito legal para algún cliente?

## H. Despacho

27. **Despacho de lotes.** Vale con número de ruta que agrupa órdenes (no procesadas) "para enviar a bodega". Sin efecto en existencias, 1 solo registro, claves de 6 caracteres sobre números de 7. *Propuesta:* no migrar; si la bodega necesita el papel, un reporte de órdenes por fecha de envío. ¿Se
    usa? ¿Por qué solo acepta órdenes sin procesar (¿se despacha lo que aún no se carga a inventario)?

## I. Desperdicio, catálogos y reportes

28. **Desperdicio y catálogos sin uso.** Los once tipos de desperdicio (quebrado, inflado, crudo, dorado, pegado, cabezal, quemado, retenido en máquina, caído al suelo, grasoso, falto de manteca) están en 119 órdenes (0.5 %); no se sabe si son porcentajes o unidades ni si importan para costeo. Actividades,
    indirectos, mano de obra y maquinaria (con tarifa por hora) no los usa ninguna pantalla. *Propuesta:* migrar el desperdicio como catálogo + cantidades por orden solo si el negocio lo pide; no crear los demás catálogos. ¿Qué se quiere medir (merma valorada, rendimiento)?
29. **Reportes.** El sistema trae 15 reportes (varios con 3 a 5 formatos). "Rendimientos" está inconcluso y "Producción al costo Standar" usa costos reales. *Propuesta:* construir primero órdenes pendientes, producción por fecha/línea/producto (con costos), consumo por insumo, costo por componente, producción anual y fórmulas con costo teórico;
    luego rendimiento y variación. ¿Cuáles imprimen hoy y con qué formato físico (orden de maquilado, hoja de producción)?

## J. Migración y seguridad

30. **¿Cuánto histórico se migra?** 22,643 órdenes y 98,857 líneas (2019-03 a 2020-10). *Propuesta:* migrar todo (volumen pequeño), sin los registros borrados; los movimientos de inventario viajan con `INV64`.
31. **Datos sucios por resolver con el negocio:** 50 órdenes pendientes desde 2019, 25 procesadas con bodega 0, 116 líneas procesadas con cantidad ≤ 0, 8 órdenes procesadas con costo de materiales 0, 1 sin líneas, 6 con insumo repetido, y 5 + 1 órdenes cuyos costos de materiales no igualan a la suma de sus líneas.
    *Propuesta:* importar tal cual, reportarlas y dejar que el negocio decida cuáles corregir; las 50 pendientes pasan a un estado "vencida" para cerrarse.
32. **Permisos y visibilidad de costos.** Hoy un permiso por pantalla (solo "abrir"); `USUARIOS.VE_COSTO` existe pero ninguna pantalla lo usa y "Ver costos" es una casilla libre; un perfil `USRTYPE = 2` solo ve despachos, mes/empresa, indirectos y entregas parciales. *Propuesta:* permisos `capture` (órdenes y fórmulas),
    `supervise` (procesar/anular, recosteo, partidas, cuentas) y `reports` con **permiso aparte para ver costos**. ¿Quién debe ver costos y quién debe poder procesar?
