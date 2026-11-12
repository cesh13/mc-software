# plan64 — Preguntas abiertas

Decisiones que necesitamos del negocio (y del contador) antes o durante la construcción. Cada una trae una **propuesta** (con la que se avanza si nadie la contradice).
Contexto: solo se pudo revisar **una empresa**: 20 empleados mensualizados, 1 patrono, 48 quincenas (2021-07 a 2023-07). Ahí no se ejercitan horas extras (casi), vacaciones, préstamos, eventuales, honorarios, ni la contabilización: esas reglas están verificadas **en el código**, no en los datos.
Marcas: **[V]** código, **[D]** datos, **[I]** inferido. Nada de lo legal está afirmado aquí: cada cifra o fórmula del sistema viejo se lista en la sección 9 como **por verificar contra la normativa vigente**.

## 1. Alcance y estructura

1.1 **¿Sigue en uso y quién más lo usa?** La copia llega a 2023-07 (última quincena sin cerrar; archivos de ISSS hasta 2023-07). *Propuesta:* migrar completo para el cliente actual y dejar los regímenes sin uso en la copia (IPFA, IVM, eventuales, honorarios, hora) detrás de pruebas con datos de otros clientes. ¿Qué otros clientes tienen planilla y de qué tipo?

1.2 **¿Qué hacemos con RR. HH.?** El menú mezcla planilla con contratos y finiquitos, capacitaciones, amonestaciones, permisos como trámite, asistencia diaria, horarios, premios por antigüedad, análisis de gasto por venta y cumpleaños. Casi todas las tablas están vacías o con 1–4 filas. *Propuesta:* primera versión solo con lo que afecta el pago y los documentos de ley (constancias de salario y de trabajo, carta de recibo, boleta); lo demás como módulo posterior si algún cliente lo pide.

1.3 **Patronos.** El sistema viejo permite varios patronos (`CODEMP`) en una base, cada uno con NIT y número patronal de ISSS. *Propuesta:* un patrono = una `core_empresas`; el número patronal y NIT son datos de la empresa. ¿Algún cliente corre varios patronos con una sola planilla consolidada o con empleados que se trasladan entre ellos (`plmtremp`)?

1.4 **Centros de costo.** Hay dos conceptos: `CCOSTOS` (C6, de planilla) y `ctacosto` del maestro (C3, el del libro mayor). *Propuesta:* usar solo `gl_cost_centers`; en la migración, mapear cada `CCOSTO` de planilla a uno del libro mayor (el de `ctacosto` donde exista). ¿Cómo se relacionan hoy? ¿La división es un departamento o un centro de costo?

1.5 **Tipos de pago.** Solo existen salario mensual (en quincenas) y por hora; no hay semanal, diario ni a destajo. *Propuesta:* no construir los que no existen; ¿algún cliente necesita jornal diario o destajo?

## 2. Datos y migración

2.1 **Copia consistente.** Para la paridad de la contabilización (y de la renta acumulada) hace falta una copia de `CONTAC` del mismo cliente y fecha, con las partidas de planilla; en disco `plan64/dbf` no trae partidas. Hay además `DBFPLAN.RAR` y `DBFin.rar` en `plan64/dbf` que **no se abrieron**. *Propuesta:* pedir la copia completa del cliente (planilla + contabilidad), una impresión de la planilla de ISSS y del F910/renta mensual de un mes cerrado y de una quincena de junio/diciembre, para comparar contra lo que el negocio considera correcto.

2.2 **Historia a migrar.** La planilla en disco empieza en 2021-07. *Propuesta:* importar las 48 quincenas como corridas cerradas de solo lectura, y como saldo inicial el acumulado de renta del año en curso (`RECORI`). ¿Se necesitan las de antes de 2021-07 (la carpeta `plan64` tiene archivos desde 1997)?

2.3 **Filas sin código (33) y empleado huérfano (1) en `PLANILLA`**, 3 filas de `MAESTRO` en blanco y 2 filas cuyo neto no cuadra con ingresos − descuentos. *Propuesta:* no importarlas y entregar el reporte de rechazos. ¿Qué eran?

2.4 **Parámetros históricos.** `CONFIG.MEM` guarda un solo juego de tasas y no tiene historial: no se puede saber con qué tasas se calculó cada quincena anterior. *Propuesta:* las corridas importadas conservan sus importes; los parámetros se cargan desde la fecha de la primera corrida actual. ¿Hay documentos de los cambios de tasa (o los conoce el contador)?

2.5 **Código de empleado.** En comentarios del código el código de empleado parece un número de documento de identidad (o un correlativo corto). *Propuesta:* en el sistema nuevo el código es un correlativo interno y el documento se guarda aparte, cifrado; se conserva el código viejo en una columna de origen para la importación y las búsquedas.

## 3. Cálculo de ISSS, pensiones y renta

3.1 **Topes y tablas por quincena o por mes.** El código multiplica por 2 los topes (`cfg_tope`, `cfg_ivm`, `cfg_max`, `cfg_ipfa`) y aplica la tabla de renta directamente a la base de **cada quincena** (`rentaag.prg` la duplica para un salario mensual), aunque la pantalla la llame "Tabla de Renta Mensual" [V][I]. *Propuesta:* en el sistema nuevo guardar cada tabla y cada tope con su **período** (quincenal o mensual) explícito y convertir al importar. Hay que leer los valores de `CONFIG.MEM` con el contador para confirmar a qué período corresponden (no se hizo aquí por tratarse de datos del cliente).

3.2 **Base de renta.** El código resta de la base ISSS, AFP e IVM del empleado pero **no el FSV** [V]; incluye vacaciones, incapacidad, horas extras e ingresos adicionales marcados como gravables, y el aguinaldo por encima del monto exento. *Propuesta:* mantener y parametrizar por concepto; el contador confirma el tratamiento de cada uno.

3.3 **Huecos entre tramos.** Los tramos se comparan con `≥ desde` y `≤ hasta` sobre una base **sin redondear**; con un hueco entre un máximo y el mínimo siguiente la retención sale 0 [I]. *Propuesta:* validar al guardar la tabla que no haya huecos ni traslapes y calcular la renta sobre una base redondeada a centavos.

3.4 **Regularización de junio y diciembre.** En la 2.ª quincena de junio y de diciembre el cálculo usa otra tabla (1.er y 2.º semestre) con el acumulado del año (`RECORI`) y resta lo retenido; en diciembre resta además la renta del aguinaldo [V]. Hay inconsistencias de programación: en el tramo 7 se mezclan variables de tablas distintas [V]. *Propuesta:* reemplazar por un **ajuste anual explícito** (acumulado del año − retenido), con la tabla vigente, y migrar `RECORI` como acumulado inicial. ¿Es esa la intención de negocio? ¿Qué se hace con empleados que entran a mitad de año o vienen de otro empleo (`INGRESOG`/`RENTAG`)?

3.5 **¿Es `calcula.prg` la versión que cuadra con lo que se paga hoy?** En `fuente` hay varias versiones del cálculo (`calcula2`, `calculaold`, `calculaback`, `calcula09092025`, `rescalcula`) que no están en el proyecto. *Propuesta:* comparar el resultado de `calcula.prg` con `PLANILLA` ya cerrada (las 48 quincenas) como primera prueba de paridad.

3.6 **INSAFORP.** Se calcula como tasa patronal sobre la misma base y tope que el ISSS salud y entra en las provisiones contables; no hay umbral por número de empleados ni exenciones [V]. *Propuesta:* que el contador confirme el umbral y la base; modelar como aporte patronal con vigencia.

3.7 **Banderas con comportamiento dudoso.** `NOAFP` ("No calcular AFP") no tiene efecto; `NOISSS` solo desactiva ISSS e IVM; `PLAN_JUV` aplica un % a los ingresos; `SEGURO`/`SEG_FAM` se saltan julio [V]. *Propuesta:* no migrar `NOAFP` (confirmar que nadie la usa); el resto como conceptos configurables. ¿Para qué es el salto de julio?

3.8 **Regímenes IPFA e IVM.** Los casos `COTIZAR = 3` y `4` tienen fórmulas con topes mezclados [V]. *Propuesta:* no implementarlos hasta que un cliente los necesite; documentar como "por confirmar".

3.9 **Redondeo.** El sistema viejo opera en coma flotante, redondea a 2 decimales en cada fórmula pero no en los intermedios (`ganado = salario/30 × días`) y trunca las tasas a 4 decimales de fracción [V]. *Propuesta:* decimales exactos, redondeo "mitad hacia arriba" a centavos por concepto, y reportar cada diferencia de ±0.01 contra el histórico en vez de forzarla.

## 4. Días, horas extras e incapacidad

4.1 **Horas extras.** Seis clases con multiplicadores escritos en la pantalla (×2, ×2.5, ×1.5, ×1.75, ×2.0, ×2.5) y rótulos "100 %/125 %/50 %/75 %" que no coinciden con ellos; la hora ordinaria es salario/240 [V]. *Propuesta:* un catálogo `pay_overtime_rates` con vigencia; que el cliente diga qué clases usa y cómo deben llamarse. Sin uso en la copia salvo 2 clases.

4.2 **Días de la 2.ª quincena para quien gana el mínimo.** La generación (con `cfg_q`) da 16 / 14 / 12… días según el mes y la pantalla de días trabajados da 16 / 15 / 14 / 13 [V]. *Propuesta:* un solo criterio parametrizado; ¿cuál es el correcto? ¿Y por qué solo quienes ganan **exactamente** el mínimo?

4.3 **Valor del día para incapacidad y permisos.** `dia = sueldo de la fila / 30`, pero esa fila trae el sueldo de **15 días**: el valor del día saldría a la mitad [I]. En la copia `REM_INCA` es 0 aunque hay 3 filas con días de incapacidad. *Propuesta:* usar `salario mensual / 30`; ¿cómo se pagan hoy las incapacidades (ISSS, patrono, ambos)? ¿Se descuentan del sueldo?

4.4 **Modo "mensual" (`cfg_q` falso).** La 1.ª quincena queda como anticipo de 15 días y la 2.ª paga el resto. *Propuesta:* soportar `pay_frequency = mensual` con anticipo como concepto; ¿lo usa algún cliente?

4.5 **Ausencias.** Descuento por días `salario/30 × días` y por minutos `salario/30/8/60 × minutos` [V]. ¿Los permisos con goce, suspensiones y retiros se tratan igual? ¿Quién autoriza?

## 5. Prestaciones

5.1 **Vacaciones.** Fórmulas distintas según se use `vacacion.prg` (salario/15 × días × %) o las pantallas de "1 / 3 períodos" (salario/30 × 7 × 30 %, pero se graban 15 días), con un % por defecto en `PORVACA.MEM` [V]. *Propuesta:* un solo cálculo con prima parametrizada y vigencia; el contador define base (¿salario más promedio de comisiones?) y la regla de "305 días" para generar.

5.2 **Aguinaldo.** Días por antigüedad (15 / 19 / 21), cálculo proporcional el primer año, fecha de corte 12 de diciembre y retención de procuraduría del 30 % para quienes tienen `PROCU` [V]. *Propuesta:* todo parametrizado con vigencia (días por rango de años, fecha de corte, base); aguinaldo como corrida propia y su renta por la misma tabla que usa el sistema (¿con la tabla ×2?).

5.3 **Recibos de honorarios.** Usan otros tramos de aguinaldo (10 / 15 / 18 / 21) y retención fija de 10 % [V]. *Propuesta:* retención de honorarios configurable; confirmar los tramos de aguinaldo para honorarios con el contador.

5.4 **Indemnización.** El código distingue retiro voluntario y otros, con 730 y 365 días, tope `cfg_maxi`, y mínimo de medio sueldo bajo un año; para vacación proporcional usa `(salario/2 × 1.30) × días/365` [V]. Hay estados de aprobación y pago en cuotas [V]. *Propuesta:* modelar la liquidación con causa de terminación y fórmulas parametrizadas; que el contador revise cada fórmula antes de implementarla. ¿Siguen pagando en cuotas?

5.5 **Provisiones mensuales de aguinaldo, vacaciones e indemnización.** El módulo no las calcula; las cuentas `CTAAGUI`, `CTAVACA`, `CTAINDEM` existen pero la partida de planilla no las usa [V]. *Propuesta:* decidir si la nueva plataforma las contabiliza (cálculo mensual por empleado) o si se registran al pagar.

5.6 **Retención de procuraduría (30 %).** Aplica a aguinaldo e indemnización de empleados marcados [V]. ¿Qué es exactamente y a quién aplica? ¿Hay otros embargos u órdenes de descuento (judiciales, pensión alimenticia, sindicato) que hoy se meten como "otros descuentos"?

## 6. Acceso y control

6.1 **Datos sensibles.** El sistema muestra salarios y datos personales a cualquiera con permiso a la pantalla. *Propuesta:* permiso `payroll.salary` para ver sueldos y bitácora de lectura; datos de salud y beneficiarios fuera de la primera versión (o con permiso propio y cifrado de campo); documentos de identidad y cuentas bancarias cifrados.

6.2 **Llaves de autorización.** Hay un esquema de dos llaves más autorización para descuentos, ingresos, aumentos, vacaciones e indemnización que **el cálculo no exige** [V]. *Propuesta:* un solo paso de aprobación configurable por tipo de movimiento (`pay_approvals`), con quién y cuándo; ¿se usa realmente?

6.3 **Reapertura de una planilla cerrada.** No existe en el sistema viejo. *Propuesta:* corrida cerrada inmutable; correcciones por corrida de ajuste; reabrir solo con permiso de supervisor y bitácora.

6.4 **Permiso por pantalla.** Hoy es por usuario y pantalla, sin distinguir altas, cambios o cierres. *Propuesta:* los permisos de plataforma (`capture`, `reports`, `supervise`) más `salary` y `close`; ¿quién debe poder calcular, cerrar, contabilizar y generar archivos oficiales?

## 7. Contabilización

7.1 **¿Contabiliza algún cliente desde planilla?** En la copia no (ninguna cuenta configurada, sin partidas en `plan64`) [D]. *Propuesta:* construir la publicación al libro mayor (contrato `source = 'nomina'`) con un mapa de cuentas por **concepto × centro de costo × empresa** en vez de cuentas por empleado.

7.2 **Frecuencia y granularidad.** Hoy una partida **por mes** con líneas por empleado, tipo y número digitados a mano, que se puede repetir y que borra la anterior [V]. *Propuesta:* una partida por corrida cerrada (o por mes si se prefiere), con una línea por concepto y centro de costo (no por empleado, salvo que el negocio lo pida), y con el número asignado por el libro mayor. ¿Qué detalle espera el contador?

7.3 **Cuadre.** La partida legada no incluye FSV, horas extras de cuatro clases, incapacidad, vacaciones `vac1/vac2`, aguinaldo, indemnización ni préstamos, y no se valida que cuadre [V]. *Propuesta:* generar la partida desde las líneas de concepto (cuadra por construcción); ¿qué hace hoy el contador con las diferencias?

7.4 **Provisiones patronales** (ISSS, AFP, INSAFORP) sí se contabilizan con cuenta de gasto y de pasivo [V]. *Propuesta:* mantenerlas por concepto; confirmar cuentas.

7.5 **Pago neto.** La partida acredita una sola cuenta (`ctag`) que el usuario digita. *Propuesta:* cuenta por empresa (y por banco si hay varios), y si el pago pasa por Bancos, el módulo de Bancos hace el movimiento contra esa cuenta mediante contrato.

## 8. Salidas oficiales y bancarias

8.1 **Archivo de depósito.** El sistema genera un Excel genérico (cuenta, nombre, neto, concepto, correo) y hay archivos de texto de ejemplo con `;` de formatos anteriores. *Propuesta:* un exportador con formato configurable por banco; ¿qué bancos y qué layouts usa el cliente hoy? ¿Se paga con cheque en algún caso?

8.2 **Planilla de ISSS.** Archivo ASCII de 102 posiciones con los campos descritos en [business-rules §13.1](business-rules.md); los códigos de observación y el correlativo fijo `001` no están documentados en el código. *Propuesta:* validar el layout contra el formato que hoy acepta el ISSS (y el portal vigente) antes de implementarlo; ¿qué códigos de observación se usan (`00`, `01`…)?

8.3 **AFP.** El módulo vuelca a tablas de un sistema externo en `F:\` y no genera un archivo de cotización propio [V]. *Propuesta:* no migrar ese vuelco; ¿cómo declara hoy el cliente la planilla de AFP (portal, archivo, otro sistema)? Definir el layout vigente.

8.4 **Reportes que se conservan.** Unos 50 reportes en el menú; algunos parecen de un solo cliente (vialidad, aseguradora, ventas, análisis de gastos de restaurantes). *Propuesta:* migrar los de ley (ISSS, AFP, renta, constancias, boleta, planilla) y pedir al cliente la lista de los que sí usa.

8.5 **F910 y renta mensual.** Los archivos usan códigos de tipo de renta (`01`, `11`, `33`, `60`, `70`) y de país `9300` escritos en el código, y un campo del F910 se llena con el valor equivocado (usa `cefafa` donde debe ir `iboni`) [V]. El layout de ancho fijo (750 posiciones) y las columnas del Excel pueden haber cambiado. *Propuesta:* generar ambos desde el nuevo modelo con una versión de layout por año, validando contra el formato oficial vigente, y no replicar el error del campo de bonificaciones; ¿qué versión de F910 presenta el cliente hoy?

## 9. Qué verificar contra la normativa vigente (lista, sin valores)

Todo esto lo hace hoy el código viejo; ninguna cifra legal se afirma en estos documentos. Para cada ítem hay que confirmar el valor, la vigencia y la fórmula actual, y guardarlos con fecha en `pay_param_sets` / `pay_tax_tables`:

- Tasas de empleado y de patrono, base y **tope** de: ISSS (salud), IVM del ISSS, AFP (incluida la comisión de cada administradora y la tasa patronal de pensionados), IPFA, FSV, INSAFORP (y su umbral si lo hay).
- **Tabla(s) de renta**: tramos, cuotas fijas y porcentajes; tabla mensual, quincenal, semestral y anual; renta de eventuales y de extranjeros; retención de honorarios (10 % escrita en el código); monto exento del aguinaldo; tratamiento de aguinaldo e indemnización en la renta; deducciones permitidas y su orden (ISSS, pensión, FSV).
- **Salario mínimo** (se usa para identificar al empleado de mínimo, para días de la 2.ª quincena y en la indemnización).
- **Horas extras**: multiplicadores por clase, horas ordinarias del mes (240 en el código) y base de la hora; tratamiento de descanso semanal y asuetos.
- **Incapacidad y permisos**: días de carencia, porcentaje que paga cada parte, tope por enfermedad.
- **Vacaciones**: días, prima (30 % en el código), proporcionalidad, base (comisiones), plazo mínimo (305 días) y quién autoriza.
- **Aguinaldo**: días por antigüedad (15 / 19 / 21 en el código; 10 / 15 / 18 / 21 en recibos), fecha de corte (12 de diciembre en el código), proporcionalidad del primer año, base, empleados excluidos.
- **Indemnización y liquidación**: fórmulas por causa, topes, mínimos, plazos (730 / 365 días), vacación y aguinaldo proporcionales, retención de procuraduría (30 % en el código) y quién la origina.
- Descuentos de ley u órdenes: embargos, pensión alimenticia, cooperativas, sindicato, seguro y plan de jubilación (porcentajes y montos fijos del código).
- **Archivos y declaraciones**: layout vigente de la planilla de ISSS (102 posiciones en el código), de la planilla/cotización de AFP, del archivo de renta mensual, del F910 anual y de las constancias; códigos de tipo de renta, de país y de observación; plazos de presentación.
- **Año y período fiscal**: mes de arranque, cierre anual y qué constituye el "mes" para topes (la lógica de acumulado en la 2.ª quincena).
