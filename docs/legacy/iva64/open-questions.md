# IVA64 — Preguntas abiertas

Decisiones que necesitamos del negocio antes o durante la construcción. Cada una trae una **propuesta** (la respuesta con la que se avanza si
nadie contradice). Contexto: solo se pudo revisar **una empresa** (unos siete años de libros: 19,494 compras, 47,516 ventas a contribuyentes,
802 resúmenes diarios de consumidor final, 3 retenciones de renta). Las respuestas deben confirmarse con más clientes.
Donde una pregunta toca porcentajes, umbrales, códigos o formatos de Hacienda, la propuesta es **la que hace el sistema anterior** y debe
**verificarse contra la normativa y el instructivo vigentes** antes de construir.

## A. Alcance e integración con otros módulos

1. **¿IVA64 queda como libro independiente o `tax` se alimenta siempre de los demás módulos?** Hoy los documentos llegan por cuatro vías
   (captura, JSON de DTE, transferencia desde CxC/CxP/inventario, CSV) y la tabla no guarda el documento origen. *Propuesta:* `tax` es la fuente de
   los libros legales; los documentos de CxC, CxP, Bancos e Inventario llegan por API/evento con `source_module` y `source_ref`; sigue existiendo
   la captura manual para lo que no pasa por otros módulos (gastos, importaciones, excluidos).
2. **Sincronización con CxC, CxP e inventario.** El sistema anterior borra y vuelve a traer todo el mes (y las dos fuentes de compras se pisan entre sí).
   *Propuesta:* sincronización idempotente por documento, por fuente, sin borrar capturas manuales; los documentos de meses cerrados no se tocan.
   ¿Debe correr sola (cada vez que cambia el origen) o por botón a petición del usuario como hoy?
3. **Corrección al spec de Bancos.** "Ingresar al IVA" (y "Ingresar Renta") escribe en `COMPRAS`/`RENTAT` de la carpeta de IVA64 (por `CAMINOIVA`/`IVA`
   en `EMPRESAS`), no en `LIBCOMP`, que existe pero está **vacía** en CONTAC. *Propuesta:* no migrar `LIBCOMP` ni `OFCOMPRA`; ¿algún cliente usa esa ruta vieja? Actualizar
   la sección 9.1 del spec de BANCOC cuando esto se confirme.
4. **¿Debe `tax` cuadrar con el IVA de la contabilidad?** IVA64 no postea ni lee el GL; las compras pueden no tener partida o tenerla con otro importe.
   *Propuesta:* un reporte de conciliación (IVA del libro vs saldo de la cuenta de IVA crédito/débito fiscal por mes) como control, sin obligar a que coincidan.
5. **Liquidación del IVA y declaración mensual.** No existe en el módulo (ni F07, ni resumen de débito − crédito − retenciones − anticipos, ni asiento).
   El único cálculo de débito fiscal está en el pie de los libros de ventas. *Propuesta:* la fase 1 reproduce exactamente lo que hay; la liquidación
   (con asiento al GL, `source = 'iva'`) queda como fase 2 si el negocio la pide.
6. **¿Una instalación = una empresa?** El sistema anterior trabaja una empresa por carpeta de datos y comparte la tasa de IVA entre todas.
   *Propuesta:* `empresa_id` en todo, tasa por empresa; ¿hay clientes con varias empresas que consoliden libros?

## B. Tasas, umbrales y cálculos

7. **Tasa de IVA.** Vive en un archivo de memoria global (`IVA.MEM`) y, además, hay un `0.13` escrito en los archivos F987 que ignora la tasa configurada.
   *Propuesta:* tasa por empresa con vigencia por fecha en `tax_settings`; todos los cálculos y archivos la leen de ahí. ¿Algún cliente usa una tasa distinta (zona franca, régimen especial)?
8. **IVA percibido en compras usa la tasa de retención** (`cfg_ivare`), mientras que en ventas usa la de percepción (`cfg_ivape`). *Propuesta:* usar la tasa de
   percepción en ambos casos (corregir el error). Confirmar con el contador qué tasa aplica a cada caso.
9. **Bases mínimas.** El código percibe en ventas solo si la base es mayor de 100, no tiene base mínima para retener en compras, y separa consumidor
   final por 200 en los F987. *Propuesta:* los tres valores pasan a configuración por empresa con vigencia; confirmar los montos y la comparación
   (mayor / mayor o igual) contra la norma.
10. **Renta retenida.** La tasa es 10 % escrita en el código (editable por documento), y en excluidos se calcula sin redondeo. *Propuesta:* tabla de códigos de ingreso con su tasa
    (`tax_income_codes`), redondeo a 2 decimales; el monto sigue siendo editable con motivo auditado.
11. **Redondeo del consumidor final.** El IVA se calcula **una vez sobre el total del mes** (`TOTGRA − ROUND(TOTGRA/(1+tasa), 2)`), no por documento. *Propuesta:*
    mantener exactamente esa fórmula para el libro (paridad al centavo); ¿es lo exigido o solo la costumbre?
12. **Total de la compra.** Incluye el IVA percibido y los otros impuestos (Cotrans, Fovial, otros) pero no el retenido ni el anticipo; hay un campo `ivarete` que nadie usa.
    *Propuesta:* conservar la fórmula, quitar `ivarete`, y documentar el significado de cada columna en el reporte. ¿Cómo debe tratarse el anticipo a cuenta (hoy solo un dato informativo)?

## C. Documentos y libros

13. **Compra frente a gasto.** La casilla "Es Compra" divide el libro en parciales de compras y de gastos; solo 180 de 19,494 documentos están marcados como compra.
    *Propuesta:* mantener la clasificación y el prefijo `C`/`G`/`R`; ¿el contador necesita estos parciales en el libro legal?
14. **Importaciones, internaciones y servicios.** El anexo de compras tiene columnas para internaciones y servicios importados que la pantalla nunca llena (tampoco existen datos).
    Un documento es interno **o** de importación. *Propuesta:* capturar los tres tipos y permitir un documento mixto.
15. **Fecha del documento y mes del libro.** Un documento puede registrarse en un mes posterior a su fecha (1,913 compras); nunca anterior. Los libros filtran por mes de registro,
    pero los anexos de ventas filtran por fecha del documento y el de compras ignora el rango de fechas. *Propuesta:* un único criterio: período del libro; el anexo de un mes incluye todo
    lo registrado en ese período. ¿Cuántos meses hacia atrás se puede registrar un documento (la ley limita el crédito fiscal en el tiempo)?
16. **Duplicados.** La unicidad (`fcomp+fregi+ftipo`) no la garantiza la base: hay 167 llaves repetidas en compras y 4 en ventas. *Propuesta:* unicidad real en la base; el importador conserva los
    repetidos con `dedupe_seq` y entrega la lista al contador para decidir. ¿Hay casos legítimos (mismo número de proveedores distintos con el mismo NRC mal digitado)?

## D. Facturación electrónica (DTE)

17. **Qué hace hoy el sistema.** Solo **lee** un archivo JSON de un DTE de tipo `03` (comprobante de crédito fiscal), por búsqueda de texto sin parser, desde las pantallas de compras y de ventas a contribuyentes;
    copia número de control, código de generación y sello de recepción, la fecha, el NRC del emisor/receptor y los totales (el IVA lo recalcula). Para los demás tipos no hace nada y no avisa.
    Marca el documento como "Documento Tributario Electrónico". *Propuesta:* parser real y soporte de los tipos que correspondan a cada libro (03, 05, 06, 11, 14, 01 por documento); ¿cuáles hacen falta
    y de quién se reciben (proveedores, el propio sistema)?
18. **Emisión.** IVA64 **no emite, firma ni transmite** DTE. La emisión vive en `INV64` (tabla `FELECTRO`: 35,944 documentos —tipos 03, 05, 01, 11, 14 y 06— con más de 120 columnas, incluidos número de control,
    código de generación y sello de recepción); IVA64 copia esos tres campos al transferir ventas. No se encontró manejo de eventos (invalidación) ni de contingencia. *Propuesta:* `tax` recibe del módulo de
    facturación un documento con sus identificadores DTE (y su estado: aceptado, invalidado) y no los captura; ¿la emisión será del módulo de facturación de la plataforma nueva o seguirá en `INV64`?
19. **Consumidor final con DTE.** Con DTE cada venta tiene su propio documento, pero el libro y el anexo de consumidor final son un **resumen diario por rango**, y el anexo usa "N/A" en resolución y serie y
    toma el primero y el último control/código del rango. *Propuesta:* guardar el documento individual (si el módulo de facturación lo entrega) y generar el resumen diario como vista; ¿el anexo ya exige detalle por
    documento? Además el anexo de crédito fiscal elige un único formato (DTE o anterior) por archivo según el primer renglón: en un mes mixto sale mal. *Propuesta:* decidir el formato **por renglón**.

## E. Archivos y formatos para Hacienda

20. **F987 (v1, v2, v3).** Tres versiones conviven en el menú; la v1 escribe texto de ancho fijo con IVA recalculado al 13 %, la v2 y v3 Excel. *Propuesta:* no migrar v1 ni v2; migrar la v3 solo si el informe sigue vigente; ¿alguien usa F987 hoy?
21. **COA (texto de ancho fijo) y F930 v1.** Formatos antiguos de texto en centavos con ceros. El menú "COA" ni siquiera tiene permiso en la copia. *Propuesta:* migrar F930 v2 (Excel); COA y F930 v1 solo si un cliente los exige.
22. **Formato actual de los anexos.** El sistema genera `.XLS`, no CSV ni el formato de presentación en línea; las columnas son las que figuran en [business-rules.md](business-rules.md) §13. *Propuesta:* producir CSV
    (separador y codificación según el instructivo vigente) y Excel; el negocio entrega un ejemplo aceptado por Hacienda para comparar columna a columna.
23. **Códigos fijos.** Tipo de documento (`03`, `05`, `06`, `01`, `11`, `12`, `07`), tipo de operación `1`, tipo de ingreso `3`, calificación/modalidad/documento del F930 (`1/1/1`, `2/1/1`, `1/3/3`, `2/3/3`, `2/2/2`),
    clase de documento (1 o 4), tipo de identificación `2` en excluidos. *Propuesta:* tablas de catálogo (`tax_document_types.annex_document_code` y similares) llenadas con el instructivo vigente.
24. **Detalles de los anexos.** (a) El anexo de consumidor final **omite** las notas `A1`/`A3`. (b) El anexo de excluidos exporta `ivaexcl` pero no `renexcl` (la renta). (c) Las notas de crédito de compras salen en
    positivo en el anexo y en negativo en el libro. (d) Las exportaciones salen de CxC y no de `ivafac`. (e) Si el tercero no tiene NIT ni DUI se usa el NRC. *Propuesta:* confirmar cada punto con el contador antes de reproducirlo o corregirlo.

## F. Cierre y folios

25. **Folios y legalización.** Los libros tienen opciones "Imprimir Fecha y No. de Página" y firmas (nombre y cargo) pero no hay control de folios ni hoja legalizada. *Propuesta:* hojas numeradas por libro/año con el último folio impreso guardado; ¿hay requisito de papel o basta el PDF?
26. **Cierre y corrección posterior.** El cierre es un marcador por fila, comprobado solo en la primera, y nunca se usó en esta copia. ¿Qué pasa cuando hay que corregir un mes ya presentado?
    *Propuesta:* estados `open → closed → filed`; las correcciones se registran como ajuste en el período abierto con referencia al documento original.
27. **Quién puede abrir un mes cerrado.** *Propuesta:* solo Supervisor, con motivo y bitácora (hoy cualquiera con permiso a la pantalla).

## G. Datos y migración

28. **Terceros faltantes.** 166 compras y 27 ventas apuntan a un NRC que no existe en los maestros, y 2,395 ventas a contribuyentes no tienen NRC. *Propuesta:* crear el tercero con el nombre del documento y dejarlo para revisión; ¿los 2,395 son consumidores finales mal clasificados, notas o errores?
29. **Totales que no cuadran.** 63 compras tienen un total distinto de la suma de sus componentes; 151 compras y 136 ventas tienen un IVA distinto de base × tasa. *Propuesta:* conservar el dato original y reportar; ¿el IVA del documento fiscal es siempre el correcto?
30. **Transferencias pasadas.** La bitácora registra 41 transferencias de compras pero no queda ninguna fila transferida. ¿De dónde salen entonces las compras (captura, JSON, CSV)? *Propuesta:* importarlas como manuales.
31. **Correlativo de renta.** La tabla `CORREN` no está en la copia (y `RENTAT` tiene 3 filas). ¿Se usa el control de renta? *Propuesta:* arrancar la numeración del mayor existente + 1; si no se usa, dejar la pantalla para después.
32. **Combos con valor `0`.** Tipo de operación, clasificación, sector y tipo de costo/gasto tienen ~420 filas con `0` además de las vacías, y los índices guardados (1, 2, …) no son los códigos de la declaración. *Propuesta:* tabla de equivalencias confirmada por el contador.
33. **`TIPOC` de proveedores/clientes** (0 y 1; "Nacional/Extranjero"): ¿qué número es cada uno? *Propuesta:* 1 = nacional, 0 = extranjero, a confirmar.
34. **Más datos.** Solo hay una empresa. Repetir el análisis con otros clientes (otros regímenes: empresa no gran contribuyente, con varias sucursales `SUCURSAL`, con inventario y sin él), y revisar `dbf/DBF.rar` de CONTAC.
35. **Rutas y copias.** `INTEGRAP` apunta a `\MC\CONTAC\DBF`, que ya no existe, y no hay forma de saber qué copia de CxC/CxP alimentó cada transferencia. *Propuesta:* el importador recibe las rutas por parámetro y no ejecuta transferencias.
36. **Cargas CSV históricas.** El importador de consumidor final del sistema anterior tiene el defecto `fcomp2 = documentoi`. *Propuesta:* no repetirlo; ofrecer un importador genérico con vista previa y validaciones.

## H. Permisos

37. **Permisos por pantalla.** El legado usa `PERFIL` por usuario y pantalla (`usrlvl` 1–4 y `usrtype`); la plataforma tiene tres permisos (`capture`, `reports`, `supervise`). *Propuesta:* captura de libros → `capture`; libros y archivos de Hacienda → `reports`; configuración de tasas, cierre/apertura de mes y cambio de NRC/NIT → `supervise`.
38. **Cambio masivo de NRC/NIT.** Hoy reemplaza en todos los documentos, también en meses cerrados. *Propuesta:* operación auditada, solo `supervise`, que no toca documentos de períodos cerrados o presentados (los reemplaza por una nota en el tercero).
