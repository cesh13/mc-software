# CONTAC — Reglas de negocio

Extraídas de `cgmpar01.scx`, `CGMPAR01.PRG`, `CGADIPAR.PRG`, `cgposteo.prg`,
`cgmcat01.scx`, `cgcmes01.scx`, `cgames01.scx`, `cgcierre.scx`, `config2.scx`,
`SELEMP.PRG`, `SELECATA.PRG`, `CGREVCAT.SPR`, `CGREVCUA.SPR`.

## 1. Período de trabajo

- Todo gira alrededor del **mes de trabajo** (`mesact`, formato `AAAAMM`). Cada partida
  pertenece a un mes (`salfec`).
- La fecha de la partida debe caer dentro del mes de trabajo
  ("Año Incorrecto. Debe ser…" / "Mes Incorrecto. Debe ser…").
- El usuario cambia de mes con los botones ENERO…DICIEMBRE o "Mes de Trabajo";
  el año es fijo dentro del período fiscal.

## 2. Catálogo de cuentas

- Código de hasta 14 caracteres. Jerarquía por **cuenta padre** (`anterior`);
  `"0"` = cuenta raíz (nivel 1). `nivel = nivel del padre + 1`.
- Tipos (`tipocta`): 1 Activo · 2 Pasivo · 3 Capital · 4 Gastos · 5 Ingresos · 6 Orden · 7 Contra.
- El padre debe existir, ser del **mismo tipo** y **no** ser cuenta de detalle.
- Solo las cuentas **de detalle** reciben movimientos.
- `pcosto`: la cuenta exige centro de costo en cada movimiento.
- `codigoa`: agrupación para presupuestos.
- No se puede eliminar una cuenta con movimientos, con saldos o con sub-cuentas.
- Altas, cambios y bajas quedan en la **bitácora**.
- Se puede crear la cuenta "al vuelo" desde la captura de partidas si no existe.
- Existe un catálogo alterno **por período fiscal** (`periodo.cata`) — ver preguntas abiertas.

## 3. Tipos de partida (comprobantes)

- Código de 2 caracteres (ej. `CP`), nombre, bandera `bancos`, correlativo.
- Numeración **por tipo y por mes**: siguiente = mayor número del mes para ese tipo + 1,
  con ceros a la izquierda (6 dígitos; `CP` usa 7).
- Si la integración con Bancos está activa, el número no puede chocar con uno ya
  asignado en el módulo de Bancos ("COMPROBANTE YA ASIGNADO EN EL SISTEMA DE BANCOS").
- Si al grabar el número ya fue tomado por otro usuario, se reasigna el siguiente.

## 4. Captura de partidas (Elaboración de Partidas)

Encabezado: tipo, número, fecha, concepto general (120 car.).
Líneas: cuenta, centro de costo, detalle (hasta 200 car.), cargo, abono.

Validaciones por línea:

- La cuenta debe existir y ser de detalle ("Cuenta no es de detalle!").
- Si la cuenta exige centro de costo → obligatorio y debe existir; si no lo exige → debe ir vacío.
- Detalle obligatorio; por defecto toma el concepto general o el detalle de la línea anterior.
- Cargo **o** abono, no ambos. Ambos en cero se permite tras confirmación.
- `tipomov`: 1 = cargo, 2 = abono.
- Doble clic en una línea la regresa a edición; tecla de borrado la elimina (con confirmación).

Al grabar:

- Si cargos ≠ abonos muestra "La partida NO CUADRA por X". Si la configuración
  `cfg_cuadre` está activa, **no deja grabar**; si no, graba descuadrada.
- Modificar = reversar la partida anterior y grabar la nueva (afecta saldos).
- Si alguna línea usa la cuenta de **IVA crédito fiscal** configurada → habilita
  "Ingresar al IVA" (registro en libro de compras). Si usa la cuenta de **renta** →
  habilita "Ingresar Renta". *(Integración con el módulo IVA.)*
- Otras acciones: Copiar partida, Imprimir, navegar Anterior/Siguiente, buscar por lista.

Eliminación:

- Bloqueada si la partida fue generada por el módulo de Bancos (`generado = 1`):
  "ELIMINE DESDE EL MÓDULO DE BANCOS".
- En el legado se borra físicamente; en la plataforma nueva será **anulación** (soft delete).

## 5. Saldos

- Naturaleza deudora: tipos 1, 4, 6 → `saldo = saldo anterior + cargos − abonos`.
- Naturaleza acreedora: tipos 2, 3, 5, 7 → `saldo = saldo anterior − cargos + abonos`.
- Los movimientos se **acumulan hacia arriba** en toda la cadena de cuentas padre.
- Se mantienen saldos por mes y cuenta (`SALDOS`) y por mes, cuenta y centro de costo (`SALDOCC`).
- El saldo anterior de un mes = saldo final del mes previo ("Posteo del Mes" lo reconstruye).

**Nueva plataforma:** los saldos se calculan desde las líneas (consulta SQL con roll-up por
jerarquía). Desaparece el riesgo de saldos desincronizados y el "Posteo del Mes".

## 6. Cierre mensual / abrir mes

- Cerrar mes marca todas las partidas del mes (y movimientos de Bancos) como cerradas.
- Mes cerrado: no se puede agregar, modificar ni eliminar; solo consultar e imprimir.
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

## 8. Configuración por empresa (`BANCOCFG.MEM`)

Tasa de IVA, tasa de IVA retenido, % impuesto LIOF, cuentas de IVA crédito fiscal,
IVA retenido, IVA percibido, renta y gasto; `cfg_cuadre` (exigir partidas cuadradas);
`cfg_bancos` (integración de correlativos con Bancos). IVA retenido solo para
**gran contribuyente** (`empresas.grande`).

## 9. Empresas, usuarios y permisos

- Empresas: nombre, siglas, moneda, consolidación (a qué empresa consolida), gran contribuyente.
- Usuario → empresas permitidas (`USREMP`); si tiene más de una, elige al entrar.
- Niveles: 1 Supervisor · 2 Digitador y Consulta · 3 Digitador · 4 Consulta.
- Permiso **por pantalla** por usuario (`PERFIL`), además del nivel.
- Bitácora: usuario, fecha, hora, programa, concepto.

## 10. Controles de integridad (hoy son utilidades manuales)

- Revisión del catálogo: padre inexistente, padre de detalle, tipo distinto al padre, nivel incorrecto.
- Partidas descuadradas: lista de partidas del mes con cargos ≠ abonos.
- **Nueva plataforma:** se validan al guardar, por lo que no hacen falta como utilidades.
