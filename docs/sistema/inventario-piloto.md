# Inventario: piloto de existencias

Fecha: 26/11/2026. Primer corte del módulo `inventory` para el cliente piloto, **sin facturación**:
el cliente sigue facturando en su sistema actual y aquí se registran entradas, salidas, ajustes y
transferencias. Este documento lleva tres listas que se actualizan mientras dure el piloto:
**diferencias con el sistema anterior (INV64)**, **decisiones provisionales** que hay que confirmar y
**pendientes**.

Referencias: [modulos-y-orden.md](modulos-y-orden.md) §1.3 y §2, [contratos.md](contratos.md) §3,
[inv64/README.md](../legacy/inv64/README.md), [inv64/open-questions.md](../legacy/inv64/open-questions.md).

## 1. Qué incluye

| Área | Qué hay | Pantalla |
|---|---|---|
| Catálogos | Bodegas, grupos (con cuentas de inventario y costo), tipos de movimiento (entrada, salida, transferencia; clase y contrapartida) | Inventario › Bodegas, Grupos, Tipos de movimiento |
| Productos | Código, descripción, grupo, unidad, código de barras, mínimo y máximo, lote sí/no, servicio sí/no, cuentas propias opcionales | Inventario › Productos |
| Movimientos | Documento con rejilla de líneas; se aplica al grabar (existencia, costo y partida en una sola transacción); anulación con motivo | Inventario › Movimientos |
| Costo | Promedio móvil por producto (todas las bodegas), congelado en cada salida | — |
| Contabilidad | Una partida por documento, origen `inventario`, con el tipo de partida que se elija | Inventario › Configuración |
| Cierre | Cierre y reapertura del mes de inventario (con motivo y bitácora) | Inventario › Cierre de mes |
| Carga inicial | Productos e inventario inicial pegando filas desde Excel; revisión previa; todo o nada | Inventario › Importar |
| Reportes | Existencias a una fecha (por bodega y lote, con aviso bajo el mínimo), kárdex por producto, valorización por producto y por cuenta | Reportes de inventario |
| Permisos | 15 permisos `inv.*`; **ver costos** (`inv.cost.view`) no viene en ningún paquete: solo el propietario o quien lo reciba | Usuarios |

### Cómo se activa para una empresa

1. Configuración › Módulos: **Activar** Inventario y reiniciar el servicio del servidor.
2. Configuración › Módulos de la empresa: **Activar** Inventario para la empresa del cliente.
3. Contabilidad › Tipos de partida: crear uno para inventario (p. ej. `IN`).
4. Inventario › Configuración: elegir ese tipo de partida (o desactivar la contabilización mientras se prueba).
5. Crear bodegas, grupos con sus cuentas y los tipos de movimiento. Sugeridos: `II` inventario inicial
   (entrada, contrapartida: cuenta de capital o de apertura), `EC` compra (entrada, contrapartida: proveedores),
   `SV` salida por venta (salida, sin contrapartida: usa la cuenta de costo del grupo), `SA` ajuste por faltante
   (salida, contrapartida: gasto), `EA` ajuste por sobrante (entrada, contrapartida: ingreso), `TR` transferencia.
6. Importar productos y el inventario inicial a la fecha de corte.

## 2. Diferencias con INV64

| Tema | INV64 | Nuevo | Por qué |
|---|---|---|---|
| Existencia guardada | `ARTICULO.BODEGA1..15`, `EXIST_ACT`, `MESES`, `BODMES`, `SALDOLO` que el "posteo" reconstruye | No se guarda: siempre es la suma de los movimientos | Hoy las cifras guardadas no cuadran con los movimientos (INV 37, P12) |
| Costo de las salidas | Promedio que el posteo y el cierre vuelven a calcular; el costo de una venta puede cambiar después | Promedio vigente al grabar, **congelado** en el movimiento; no hay re-valuación | P10, INV 27 y 31 |
| Salida de toda la existencia | Puede dejar centavos de valor con existencia cero | Se lleva todo el valor restante | Cuadre exacto con la cuenta contable |
| Bodegas | Máximo 15 columnas; el total solo suma 1–10 | Sin límite | INV 38 |
| Conceptos | Códigos repetidos (`SV`, `ED`, `EC`, `II`) y clave compartida | Código único por empresa; la dirección no se puede cambiar | INV 33, 35 |
| Transferencias | Dos movimientos con conceptos de salida | Tipo propio; salida y entrada al mismo costo; no generan partida | INV 34 |
| Número de documento | Se digita | Correlativo automático por tipo de movimiento | INV 24 |
| Modificar un documento | Se edita encima | Se anula (movimientos inversos al mismo costo) y se graba otro | Rastro completo |
| Anular en mes cerrado | Se reabre el mes sin rastro | El reverso y la partida quedan con fecha de hoy; el mes cerrado no cambia | P7, INV 32 |
| Existencias negativas | Permitidas con advertencia (32 productos pasaron por negativo) | Bloqueadas; se permiten por empresa o, caso por caso, con el permiso `inv.stock.negative` | P11, INV 29 |
| Contabilización | Tres procesos por rango de fechas que pueden duplicar u omitir | Una partida por documento al grabar, enlazada al documento | P1, INV 44, 45 |
| Productos sin cuenta | La partida omite la línea en silencio | No deja grabar y dice qué producto y qué cuenta falta | INV 46 |
| Cuentas | Tres por producto (`CTA`, `CTAVENTA`, `CTACOSTO`) | Inventario y costo por grupo, con excepción por producto; la contrapartida va en el tipo de movimiento | Menos captura; la cuenta de ventas será de `sales` |
| Lotes | Lote en casi todos los productos y saldo por lote en tablas aparte | Lote y vencimiento solo si el producto lo maneja; existencia por lote calculada | INV 37 |
| Cambiar código de producto | Utilería que reescribe 6 tablas | Se cambia en la ficha; los movimientos usan un id estable | INV 40 |
| Permisos | Por pantalla, leídos al iniciar sesión | Por acción; costos visibles solo con permiso | P9, INV 49 |

## 3. Decisiones provisionales (confirmar con el cliente o su contador)

| # | Decisión tomada para el piloto | A confirmar | Referencia |
|---|---|---|---|
| D1 | Costo promedio por producto para todas las bodegas | Que el contador lo acepte | P10, INV 27 |
| D2 | Las compras se registran en inventario con su contrapartida (proveedores) | Cuando exista Cuentas por pagar, la compra pasa a ese módulo y aquí solo se recibe la mercadería | P23, INV 41; modulos-y-orden §1.3 |
| D3 | Las salidas por venta se registran a mano (o importadas) porque la facturación sigue en el sistema del cliente | Cada cuánto las registra el cliente (diario, semanal) y si se importan desde su sistema | P1 |
| D4 | El IVA no entra al costo | Que el cliente sea contribuyente y no tenga importaciones | INV 43 |
| D5 | Salidas sin existencia: bloqueadas | Si el cliente necesita vender antes de registrar la compra | P11 |
| D6 | Una unidad de medida por producto | Si compra en una unidad y vende en otra | — |
| D7 | Ver costos solo con permiso | Quién del cliente debe verlos | P9 |

## 4. Pendientes y cambios para fases siguientes

- **Datos del cliente:** rubro, cantidad de productos y bodegas, si usa lotes, qué sistema usa hoy y cómo
  exportar sus productos y existencias.
- **Importador desde INV64** (`ARTICULO`, `BODEGAS`, `TABLA`, `CONCEPTO`, `MOVIMIEN`) si el cliente viene de ese
  sistema; hoy la carga es por Excel.
- **Proveedor en la pantalla de movimientos:** el documento ya guarda el tercero, pero no hay pantalla de
  clientes y proveedores todavía; por ahora se usa la referencia.
- **Cuadre automático** contra el saldo de la cuenta de inventario en el libro mayor: necesita un lookup de saldos
  en el contrato del GL. Hoy: valorización por cuenta y comparar a mano con el Balance de comprobación.
- **Toma física** con conteo y ajuste automático al aprobar (INV 36).
- **Contrato `stock`** para `sales`, compras y producción (contratos.md §3): las reglas ya están en los servicios;
  falta exponerlo cuando exista el primer consumidor.
- **Varias unidades de medida**, listas de precio, órdenes de compra, importaciones (retaceo): fuera del piloto.
- **Residuo de valor:** si se anula una entrada cuyo producto ya tuvo salidas a otro promedio, puede quedar un
  valor con existencia cero. Se ve en la valorización; corregir con un ajuste. Revisar si conviene un ajuste
  automático.
