# CONTAC — Reglas de negocio

Extraídas de `cgmpar01.scx`, `CGMPAR01.PRG`, `CGADIPAR.PRG`, `cgposteo.prg`,
`cgmcat01.scx`, `cgcmes01.scx`, `cgames01.scx`, `cgcierre.scx`, `config2.scx`,
`SELEMP.PRG`, `SELECATA.PRG`, `CGREVCAT.SPR`, `CGREVCUA.SPR`.

## 1. Período de trabajo

- Todo gira alrededor del **mes de trabajo** (`mesact`, formato `AAAAMM`). Cada partida
  pertenece a un mes (`salfec`).
- La fecha de la partida debe caer dentro del mes de trabajo
  ("Año Incorrecto. Debe ser…" / "Mes Incorrecto. Debe ser…").
- El mes de trabajo es **por usuario** y se guarda en un archivo `MESACT.<usuario>` de la
  carpeta de datos. Se cambia con los botones ENERO…DICIEMBRE (conservan el año) o con
  "Seleccionar Mes de Trabajo", donde mes y año son libres y **no se validan contra ningún
  período**.
- Todas las pantallas operan sobre el mes de trabajo: búsqueda, navegación, impresión por
  rango, cambio de número y reportes. El Balance General ignora el selector de mes de su
  propia pantalla y usa el mes de trabajo; "B. Comprobación 2" sí usa el mes elegido.

## 2. Catálogo de cuentas

- Código de hasta 14 caracteres. Jerarquía por **cuenta padre** (`anterior`);
  `"0"` = cuenta raíz (nivel 1). `nivel = nivel del padre + 1`.
- Tipos (`tipocta`): 1 Activo · 2 Pasivo · 3 Capital · 4 Gastos · 5 Ingresos · 6 Orden · 7 Contra.
- El padre debe existir, ser del **mismo tipo** y **no** ser cuenta de detalle.
- Solo las cuentas **de detalle** reciben movimientos.
- `pcosto`: la cuenta exige centro de costo en cada movimiento.
- `codigoa`: agrupación para presupuestos.
- No se puede eliminar una cuenta con movimientos (en cualquier mes) ni con sub-cuentas.
  Si tiene saldos distintos de cero en `SALDOS`, el sistema **pregunta y deja continuar**.
  Al eliminar se borran sus filas de `SALDOS` y su presupuesto; `SALDOCC` queda con filas
  huérfanas.
- Al **modificar** una cuenta se pueden cambiar tipo, padre y `es_detalle` sin revisar
  movimientos ni sub-cuentas. La validación del padre solo corre al editar ese campo: si
  solo se cambia el tipo, no se revalida contra el padre ni se propaga a las hijas.
- Altas, cambios y bajas quedan en la **bitácora**.
- Se puede crear la cuenta "al vuelo" desde la captura de partidas si no existe.
- `PERIODO` es el **período de presupuesto** (inicio, fin, número de meses, centro de costo
  por defecto), no un año fiscal: el legado no tiene concepto de año fiscal. Puede apuntar a
  un catálogo alterno (`periodo.cata`), pero ninguna pantalla permite capturarlo y en los
  datos está vacío.
  **Nueva plataforma:** un solo catálogo por empresa; el importador avisa si encuentra uno alterno.

## 3. Tipos de partida (comprobantes)

- Código de 2 caracteres (no cambia una vez creado) y nombre. La columna `bancos` existe
  pero CONTAC no la usa. `TIPOPAR.NUMERO` es un contador vestigial: se reescribe en varios
  sitios pero **no determina el número**.
- Numeración **por tipo y por mes**: siguiente = mayor número del mes para ese tipo + 1,
  con ceros a la izquierda hasta 6 dígitos. Solo si el usuario teclea el número a mano y el
  tipo es literalmente `CP` se rellena a 7 (regla fija en el código); ninguna otra rutina
  soporta 7 dígitos y en los datos todos los números son de 6.
- Al **sugerir** número, si `cfg_bancos` está activo se toma el mayor entre partidas y
  movimientos de Bancos (`MOVIBAN`). Al **teclear** un número a mano (Agregar) se rechaza
  siempre si ya existe en partidas ("COMPROBANTE YA EXISTE") o en `MOVIBAN` ("COMPROBANTE
  YA ASIGNADO EN EL SISTEMA DE BANCOS"), sin depender de `cfg_bancos`.
- Si al grabar el número ya fue tomado por otro usuario, se reasigna el siguiente.
- **Nueva plataforma:** se mantiene la numeración por tipo y por mes. El número de una
  partida anulada no se reutiliza.

## 4. Captura de partidas (Elaboración de Partidas)

Encabezado: tipo, número, fecha, concepto general (120 car.).
Líneas: cuenta, centro de costo, detalle (hasta 200 car.), cargo, abono.

Validaciones por línea:

- La cuenta debe existir y ser de detalle ("Cuenta no es de detalle!").
- Si la cuenta exige centro de costo → obligatorio y debe existir; si no lo exige → debe ir vacío.
- Detalle obligatorio; por defecto toma el concepto general o el detalle de la línea anterior.
- Cargo **o** abono, no ambos: una línea con los dos mayores que cero **no se agrega y no
  avisa** (el mensaje está comentado). Ambos en cero se permite tras confirmación. No hay
  validación de signo, así que se pueden capturar montos negativos *(inferido: la máscara
  no lo impide)*.
- `tipomov`: 1 si el cargo no es cero, 2 si lo es. En los datos es inconsistente (miles de
  líneas con abono y `tipomov = 1`): **no usarlo**, derivar de cargo/abono.
- No se impide grabar una partida sin líneas ni con concepto vacío *(inferido por ausencia
  de validación)*.
- Doble clic en una línea la regresa a edición; tecla de borrado la elimina (con confirmación).

Al grabar:

- Si cargos ≠ abonos muestra "La partida NO CUADRA por X". Si la configuración
  `cfg_cuadre` está activa, **no deja grabar**; si no, graba descuadrada.
- **Nueva plataforma:** la partida descuadrada solo se puede grabar como **borrador**
  (no afecta saldos ni reportes); aplicarla exige cargos = abonos. `cfg_cuadre` desaparece.
- Modificar = reversar la partida anterior y grabar la nueva (afecta saldos). Modificar
  **no revisa `generado`**: solo Eliminar bloquea las partidas de Bancos.
- **La captura de partidas no escribe bitácora.** Sí la escriben: catálogo, tipos de
  partida, empresas, período, estado definido, cierre y apertura de mes, cambio de número,
  copiar partida y cierre anual. No la escriben: centros de costo, configuración,
  importaciones, posteo ni el cambio de código de cuenta.
- Si alguna línea usa la cuenta de **IVA crédito fiscal** configurada → habilita
  "Ingresar al IVA" (registro en libro de compras). Si usa la cuenta de **renta** →
  habilita "Ingresar Renta". *(Integración con el módulo IVA.)*
- Otras acciones: Copiar partida, Imprimir, navegar Anterior/Siguiente, buscar por lista.

Eliminación:

- Bloqueada si la partida fue generada por el módulo de Bancos (`generado = 1`):
  "ELIMINE DESDE EL MÓDULO DE BANCOS".
- En el legado la partida se **marca como borrada** (`DELETE`) y queda en el DBF hasta que
  alguien empaque (Utilidades › Reconstruir Índices › Empacar). El importador ignora los
  registros marcados. En la plataforma nueva será **anulación** (soft delete).
- `generado` toma también el valor 9 y blanco en los datos; Eliminar solo bloquea el 1.

## 5. Saldos

- Naturaleza deudora: tipos 1, 4, 6 → `saldo = saldo anterior + cargos − abonos`.
- Naturaleza acreedora: tipos 2, 3, 5, 7 → `saldo = saldo anterior − cargos + abonos`.
- Los movimientos se **acumulan hacia arriba** en toda la cadena de cuentas padre.
- Se mantienen saldos por mes y cuenta (`SALDOS`) y por mes, cuenta y centro de costo (`SALDOCC`).
- **Cada grabación solo actualiza la fila del mes de trabajo** en `SALDOS`/`SALDOCC`; si la
  fila no existe la crea con saldo anterior en cero, y **no propaga a los meses
  siguientes**. "Posteo del Mes" copia el saldo final del mes previo como saldo anterior
  (de todas las cuentas, incluidas las de resultados) y vuelve a acumular desde las líneas.
  `SALDOS` solo es confiable después de correr el posteo.
- **Los reportes del legado leen `SALDOS`/`SALDOCC`, no las líneas** (Balance de
  Comprobación, Balance General, Estado de Resultados comercial, Libro Mayor, saldos por
  cuenta). La paridad contra esas tablas hereda sus desfases.
- **Hay cuatro rutinas que contabilizan, y no hacen lo mismo:**
  1. `CGADIPAR` (captura): actualiza `SALDOS` y `SALDOCC`; deudoras = tipos 1, 4, 6.
  2. `CGADIPAC` (la llama Copiar partida): solo `SALDOS`; mismos tipos.
  3. Copiar partida (`cgcopipa`) tiene además su propio bucle de saldos que trata como
     deudoras **solo los tipos 1 y 4** (el 6 queda como acreedor) y acumula en el mes de
     trabajo. *Sin verificar: si entre este bucle y `CGADIPAC` los saldos se duplican.*
  4. "Subir Partida Contable" (`cosubpar`) y "Cambiar número a una cuenta" (`cgchcta`)
     **no tocan saldos**.
- `SALDOCC` guarda también filas con centro de costo en blanco (cuentas que no lo exigen),
  y las cuentas padre heredan el centro de la línea.

**Nueva plataforma:** los saldos se calculan desde las líneas (consulta SQL con roll-up por
jerarquía). Desaparece el riesgo de saldos desincronizados y el "Posteo del Mes".

## 6. Cierre mensual / abrir mes

- Cerrar mes marca todas las partidas del mes (y movimientos de Bancos) como cerradas.
  Exige que el mes tenga partidas (un mes vacío no se puede cerrar) y **no valida nada
  más**: ni cuadre, ni posteo, ni orden de meses.
- Mes cerrado: en la **captura** y en el cambio de número no se puede agregar, modificar ni
  eliminar. **Las demás rutinas no consultan el cierre** y escriben igual en un mes cerrado:
  subir partida, copiar partida, cambiar código de cuenta, aplicar el cierre anual y el posteo.
- El estado del mes se lee de la **primera partida del mes**; en disco `CERRADO` vale
  blanco o falso y la mayoría de los meses mezclan ambos. Blanco = abierto.
- "Abrir Mes Cerrado" revierte el cierre. Ambas acciones quedan en bitácora.
- **Nueva plataforma:** el estado vive en una tabla de períodos, no en cada partida.

## 7. Cierre anual

1. El usuario indica el tipo de partida, el número y la **cuenta de utilidad/pérdida**.
2. Genera una partida borrador "CIERRE CONTABLE EJERCICIO/AAAA" con fecha del último día del mes:
   - cada cuenta de detalle de **Gastos** con saldo → abono por su saldo;
   - cada cuenta de detalle de **Ingresos** con saldo → cargo por su saldo;
   - si la cuenta usa centros de costo, una línea por centro de costo.
3. La diferencia va a la cuenta de utilidad: utilidad → abono, pérdida → cargo.
4. Se puede ver, imprimir y luego **aplicar** (graba como partida normal y queda en bitácora).

Detalles verificados en el código (2026-11-12):

- Usa el **saldo acumulado** de `SALDOS` en el mes de trabajo (incluye el saldo anterior),
  no el movimiento del año. Coincide con el supuesto S14.
- Corre en el mes de trabajo: **no exige diciembre** ni que `SALDOS` esté al día.
- La cuenta de utilidad solo se valida como no vacía: puede no existir o no ser de detalle.
- Un saldo negativo se vuelca con signo negativo en el mismo lado, sin cambiar de columna.
- Con centros de costo, la condición "tiene saldo" es la del total de la cuenta, y los
  montos son los de cada centro en `SALDOCC`.
- El borrador vive en `CIERRE1`/`CIERRE2`, una sola tabla por empresa (no por usuario).
- Aplicar no revisa mes cerrado, número repetido ni cuadre.
- **Los reportes del legado no excluyen la partida de cierre.** El posteo arrastra el saldo
  de todas las cuentas, incluidas las de resultados; solo la partida de cierre las deja en cero.

**Nueva plataforma:** la partida de cierre lleva `source = cierre` y el Estado de Resultados
la excluye. No hay partida de apertura: los saldos de balance se arrastran al calcularse
desde las líneas. El año fiscal es configurable (enero–diciembre por defecto).

## 8. Configuración por empresa (`BANCOCFG.MEM`)

La pantalla `config2` captura: tasa de IVA, tasa de IVA retenido (solo **gran
contribuyente**, `empresas.grande`), % impuesto LIOF, cuentas de IVA crédito fiscal, IVA
retenido, IVA percibido, renta y gasto de impuesto, y `cfg_cuadre` (exigir partidas
cuadradas). `cfg_bancos` (integración de correlativos con Bancos) viene del mismo archivo
pero **no se edita en CONTAC**. Al guardar reescribe todas las variables `cfg_*` cargadas.
El archivo es por carpeta de datos y lo comparte con Bancos.

## 9. Empresas, usuarios y permisos

- Empresas: siglas, nombre, carpeta de datos, carpeta de IVA, moneda (1 = Colones,
  2 = Dólares), niveles y dígitos para reportes, gran contribuyente. Los campos de
  consolidación existen en la tabla pero **ninguna pantalla los edita ni programa vivo los lee**.
- Usuario → empresas permitidas (`USREMP`); si tiene más de una, elige al entrar.
- Niveles: 1 Supervisor · 2 Digitador y Consulta · 3 Digitador · 4 Consulta.
- El control real es el permiso **por pantalla** por usuario (`PERFIL`, usuario + programa),
  que es **global: no distingue empresa**. El nivel casi no se usa: solo oculta Catálogo de
  Cuentas y Tipos de Comprobante al nivel 4, y decide si "Usuarios" abre el mantenimiento
  (nivel 1) o el cambio de la clave propia (los demás). Un usuario de nivel 4 "Consulta" con
  permiso en `PERFIL` puede abrir y grabar partidas.
- La clave se guarda como una suma de los códigos de sus caracteres, no como hash: las
  claves se reinician al migrar.
- Bitácora: usuario, fecha, hora, programa, concepto.

## 10. Controles de integridad (hoy son utilidades manuales)

- Revisión del catálogo: padre inexistente, padre de detalle, tipo distinto al padre, nivel incorrecto.
- Partidas descuadradas: lista de partidas del mes con cargos ≠ abonos.
- **Nueva plataforma:** se validan al guardar, por lo que no hacen falta como utilidades.
