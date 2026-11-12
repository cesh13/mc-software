# AFIJO64 — Preguntas abiertas

Decisiones que necesitamos del negocio antes o durante la construcción. Cada una trae una **propuesta** (la respuesta con la que se avanza si nadie contradice).
Contexto: solo se pudo revisar **una empresa** (143 activos, 14 corridas mensuales de 2022-01 a 2023-02, 1,623 líneas de depreciación). Los datos de contabilidad que hay en disco **sí son del mismo cliente**
(las 14 partidas de depreciación existen en `MCERP/CONTAC`), así que la paridad contra el libro mayor se puede probar, con las excepciones de la pregunta 21.
Las preguntas sobre normas tributarias están marcadas **[revisar contra la norma vigente]**: el spec describe lo que hace el código y **no afirma ninguna regla fiscal**.

## A. Alcance, uso y datos

1. **¿Qué clientes usan activo fijo y siguen usándolo?** En disco: una empresa, corridas hasta 2023-02 (ejecutada el 2023-03-01) y dos activos comprados en 2023-10 todavía sin depreciar. *Propuesta:* migrarlo
   completo para ese cliente y dejarlo como módulo opcional por empresa (`alwaysOn: false`).
2. **Otras copias y `DBF.rar`.** Solo hay una empresa en disco y `AFIJO64/DBF/dbf.rar` (75 KB) no se abrió. *Propuesta:* pedir las copias de los demás clientes que usen el módulo (para confirmar si usan otros plazos, activos
   no depreciables, bajas, etc.) antes de congelar el modelo.
3. **¿Qué cifras da por buenas el contador?** Los reportes de depreciación acumulada se calculan desde las líneas (correctos) pero la ficha del activo muestra otro acumulado (141 de 143 distintos, ver business-rules §6). *Propuesta:*
   tomar las líneas de `MOVDEPRE` como verdad, descartar los contadores de la ficha y entregar al contador el informe de diferencias. ¿Alguien corrió `arregla.prg` y cuándo? ¿Hay más reparaciones manuales (se borraron y regeneraron 2022-01 a 2022-03)?

## B. Depreciación (lo que mueve dinero)

4. **Método.** El sistema solo hace línea recta mensual en cuotas iguales. *Propuesta:* línea recta en la primera versión, con la columna `method` lista para otros. ¿Algún cliente usa saldo decreciente, unidades de producción o tablas por clase?
5. **Inicio de la depreciación y cuotas atrasadas.** Regla actual: cuota completa en el mes de la compra (cualquier día), sin prorrateo; un activo registrado tarde recibe **una** sola cuota en la primera corrida (no recupera las
   anteriores); no se puede capturar "depreciación acumulada anterior" (campo bloqueado). *Propuesta:* conservar la regla de inicio, añadir `in_service_date` (por omisión = fecha de compra), y permitir un **saldo inicial acumulado**
   por activo en el alta para los que ya traían depreciación; para los registrados tarde, una corrida de "puesta al día" explícita (varias cuotas en una partida) previa confirmación. ¿Cuál es el criterio contable correcto: fecha de compra
   o de puesta en servicio? **[revisar contra la norma vigente]**
6. **Corridas con huecos o fuera de orden.** El sistema deja correr cualquier mes (solo prohíbe repetirlo) y un mes saltado alarga la vida del activo un mes. *Propuesta:* exigir que el mes anterior esté corrido (o confirmar saltarlo) y no permitir
   corrida en un período cerrado del libro mayor.
7. **Depreciación fiscal vs financiera y vida útil.** 140 de 143 activos tienen 2 años de vida (cuota 1/24 mensual); hay 3, 4 y 8 años en uno cada uno. Solo existe un plan por activo. ¿El plazo de 2 años obedece a la norma fiscal, a una política
   del cliente o a ambas? ¿Se necesitan dos libros (financiero y fiscal) o un solo plan? ¿Hay tasas máximas por clase? **[revisar contra la norma vigente]**. *Propuesta:* un solo plan por activo, con vida útil por categoría como valor por omisión
   (editable) y sin validar contra tasas fiscales hasta tener la norma.
8. **Redondeo y última cuota.** La cuota se redondea a centavos y la última cuota es el saldo; esa rama no se ha ejercido en producción (ningún activo ha terminado). *Propuesta:* mantener y cubrirla con pruebas. ¿El contador acepta la diferencia de centavos en la última cuota?
9. **Activos "No Depreciables".** El tipo se captura pero la corrida lo ignora: **11 de los 13 activos no depreciables y el de tipo 0 han sido depreciados** 14 meses. *Propuesta:* respetar el tipo (no entran en la corrida). Pero primero confirmar con el cliente
   cuál es la intención: ¿están mal clasificados (y deben seguir depreciando) o mal calculados (terrenos, obras en proceso) y hay que revertir sus depreciaciones? Resolver antes de la primera corrida en el sistema nuevo.
10. **"Porcentaje" y "Depre Anual".** Son informativos (el porcentaje se teclea; 132 de 143 = 100 / años). *Propuesta:* mostrarlos calculados y no migrarlos.
11. **Activo totalmente depreciado.** El indicador "Activo Depreciado" nunca se marca; el activo simplemente sale de la corrida, queda en el listado y su valor en libros es el residual. *Propuesta:* estado derivado "totalmente depreciado" y reporte de
    activos totalmente depreciados todavía en uso. ¿Se necesita una acción para sacarlos de los listados?
12. **Cambios a un activo con depreciación.** Se puede editar costo, años o residual en cualquier momento; el pasado no cambia y la cuota restante se reparte como se pueda. *Propuesta:* al cambiar costo, vida o residual de un activo con líneas,
    recalcular la cuota como `(valor depreciable − acumulado) / cuotas restantes`, pedir confirmación y dejar bitácora; no recalcular meses ya corridos. ¿Es esa la regla que usa el contador?
13. **Valor residual.** La columna legada es de 2 dígitos (142 en cero, 1 desbordado). *Propuesta:* migrar `residual = costo − valor a depreciar` y confirmar con el cliente el residual real del activo desbordado (su cuota guardada es correcta).

## C. Bajas, ventas y movimientos del activo (no existen hoy)

14. **Bajas, ventas y descartes.** No hay función; el campo "Cuenta Contable Pérdida del Activo" está en 3 activos y no se usa. ¿Cómo registra hoy el cliente una baja o venta (partida manual)? *Propuesta:* construir `fa_disposals`:
    fecha, tipo, importe de venta, acumulado al corte, valor en libros, ganancia/pérdida y partida por el contrato del libro mayor. Preguntas: ¿se deprecia el mes de la baja (completo, medio, nada)? ¿Qué cuentas de ganancia y pérdida? Mientras no
    haya respuesta, el activo se desactiva sin partida y se avisa.
15. **Mejoras y adiciones.** No existen (se editaría el costo o se crearía otro activo). *Propuesta:* no construir; se registra como un activo nuevo ligado al original. ¿Algún cliente capitaliza mejoras sobre el activo existente?
16. **Traslados entre áreas o responsables.** Hoy solo se edita el campo, sin historial. *Propuesta:* historial automático en la bitácora de auditoría (quién, cuándo, valor anterior y nuevo) y un reporte "activos por responsable/área"; tabla de traslados solo si el negocio lo pide.
17. **Alta con partida de compra.** La compra se contabiliza a mano en CONTAC (hay partidas que tocan las cuentas de activo). *Propuesta:* fuera de alcance de la primera versión; después, "contabilizar compra" opcional desde el alta.
18. **Revaluaciones.** No existen. *Propuesta:* no construir.

## D. Contabilidad

19. **Tipo de partida y numeración.** El usuario teclea el tipo cada mes (en disco siempre el mismo) y el número se propone como último + 1 del mes. *Propuesta:* un tipo configurado por empresa (`fa_settings.entry_type_id`), número asignado por el libro mayor.
20. **Líneas por activo vs agrupadas.** El sistema escribe **dos líneas por activo** (hasta 280 líneas en una partida) con el código del activo en el detalle; la versión agrupada por cuenta está comentada. *Propuesta:* agrupar por (cuenta de gasto, centro de costo)
    y (cuenta de depreciación acumulada), con el detalle por activo en el módulo; mismo total. Si el contador revisa la partida línea por línea, mantener "una línea por activo" (`post_mode = 'por_activo'`). ¿Cuál prefiere?
21. **Partidas de 2023-01 y 2023-02.** Para esos dos meses, el cargo y el abono de la partida en CONTAC son **el doble** del total de la corrida de activo fijo, con unas 15 líneas manuales (tipo de movimiento 2) más cada una. Los otros 12 meses cuadran al centavo.
    ¿Se editaron a mano? ¿Se corrió dos veces? ¿El libro es el correcto y la corrida está subestimada, o al revés? *Propuesta:* importar esas dos partidas como `importado` (no `activo_fijo`) y reportar la diferencia; no usarlas para la paridad hasta tener respuesta.
22. **Centro de costo en las líneas.** El cargo al gasto lleva el centro de costo contable del activo; el abono a depreciación acumulada **no lleva ninguno**. *Propuesta:* mantener (el gasto es el que se analiza por centro de costo). ¿Se necesita en el abono?
23. **Edición manual y marca de origen.** CONTAC no distingue las partidas de activo fijo (`GENERADO = 0`, por un parámetro mal pasado) y las deja editar; el libro bloquea solo las de Bancos. *Propuesta:* `source = 'activo_fijo'` y bloqueo de edición manual
    (solo anular la corrida desde el módulo, que revierte la partida). ¿Hay casos en que el contador necesita ajustar la partida a mano? Si sí, ¿cómo se concilia con la corrida?

## E. Catálogos y estructura

24. **Cuentas por categoría o por activo.** Hoy se capturan cuatro cuentas activo por activo (7 cuentas de activo, 7 de depreciación y 10 de gasto distintas en 143 activos). *Propuesta:* cuentas por omisión en la categoría; el activo las copia y puede cambiarlas.
    Revisar con el contador la **tabla categoría → cuentas** que se deduce de los datos y que hoy no existe en ningún lado. Además: una de las cuentas de activo y una de las de depreciación acumulada están catalogadas como gasto; ¿es intencional?
25. **Dos centros de costo.** El módulo tiene un catálogo propio (`CCOSTOa`, 8; con un campo "Dirección") y el activo además lleva el centro de costo contable de CONTAC (5). *Propuesta:* llamarlos "Área/Ubicación" y "Centro de costo", con el segundo ligado al libro.
    ¿Es correcta la lectura de "área o ubicación física"?
26. **Responsables.** Tabla propia con 30 personas, sin relación con la planilla. *Propuesta:* mantener como "responsables" y enlazar con empleados de `payroll` cuando exista; no cargar empleados de planilla de golpe.
27. **Proveedor.** Se toma del maestro de proveedores de CONTAC (128 de 128 válidos). *Propuesta:* texto de referencia hasta que `accounts-payable` defina proveedores; luego llave foránea.
28. **Campos sin uso.** `FACTURA`, `DPREANUAL`, `VACTUAL`, `TDEPRE`, `DEPREACUM`, `EMPRESP`. *Propuesta:* no migrar. ¿Debe haber número de factura de compra (hoy vacío)? Garantía es texto libre (3 llenas).
29. **Código del activo.** Texto de hasta 10 caracteres tecleado a mano (139 de 143 con la forma 6 letras + 3 dígitos, 4 con otras formas). *Propuesta:* mantenerlo editable, único por empresa, con sugerencia del siguiente consecutivo por prefijo. ¿Qué significa el prefijo?

## F. Reportes y operación

30. **Reportes.** Se conservan los cuatro (registro de activos, por cuenta contable, cuadro de activo fijo a una fecha, depreciaciones por rango de meses). Defectos a corregir: el filtro "Todos los Activos" ignora los rangos y trae solo los de tipo 2;
    el reporte "por cuenta contable" imprime con el diseño equivocado. *Propuesta:* corregir; añadir **conciliación contra el libro mayor** (saldo de las cuentas de activo y depreciación acumulada vs módulo), calendario anual de depreciación por activo y
    reporte de activos totalmente depreciados. ¿Qué otros reportes exige el cliente o la autoridad (por ejemplo un anexo anual de activos)? **[revisar contra la norma vigente]**
31. **Permisos.** Hoy cada pantalla se otorga por usuario. *Propuesta:* `capture` para activos y catálogos, `supervise` para generar y anular la corrida, `reports` para reportes.
32. **Anulación de una corrida.** No existe en el menú (se borraban filas a mano). *Propuesta:* solo la última corrida vigente y solo si el período está abierto; se anula la partida en el libro. ¿Quién puede (contador, no digitador)? ¿Hace falta motivo obligatorio?
33. **Cierre.** El módulo no cierra períodos; solo respeta el cierre de CONTAC. *Propuesta:* igual: el período lo cierra el libro mayor y las corridas de un período cerrado se bloquean.
