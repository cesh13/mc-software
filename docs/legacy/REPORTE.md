# Reporte de avance — migración MCERP

Documento para retomar el trabajo. Se actualiza al final de cada sesión de trabajo.
Última actualización: 2026-11-10 (sesión sin supervisión).

## Cómo retomar

**Empezar por [docs/sistema/README.md](../sistema/README.md):** la imagen completa en una página
(sistema anterior, plataforma nueva, módulos destino, contratos y orden de construcción).

1. Leer este reporte y luego [el playbook](README.md).
2. Probar el sistema con los datos importados (sección **Cómo probarlo**).
3. Llevar al negocio **[PREGUNTAS.md](PREGUNTAS.md)**: las 30 preguntas que más importan de los
   ocho módulos, con respuesta propuesta, y la segunda ronda por módulo. Varias cambian reglas ya construidas.
4. Revisar los **supuestos**: cada uno dice dónde cambiarlo.

## Estado

| Pieza | Estado | Dónde |
|---|---|---|
| Arquitectura servidor/cliente | Decidida, no construida | [architecture.md](../architecture.md) |
| Schema CONTAC (core, catálogo, libro mayor) | Hecho, con migraciones | `apps/api/src/db/schema-core.ts`, `modules/*/schema*` |
| Base para módulos (empresa activa, permisos, bitácora, pruebas) | Hecho | [module-guide.md](../module-guide.md) |
| Importador DBF → SQLite de CONTAC | Hecho; probado con los datos reales | [import.md](contac/import.md), `tools/legacy-import` |
| API de catálogo de cuentas | Hecho, 34 pruebas | `modules/chart-of-accounts` |
| API de libro mayor (partidas, cierres, reportes, cierre anual) | Hecho, 35 pruebas | `modules/general-ledger` |
| Base de la web (empresa, mes de trabajo, menú, componentes) | Hecho | [web-guide.md](../web-guide.md) |
| Pantallas: catálogo, revisión del catálogo | Hecho; cargan en navegador con datos reales | `apps/web/src/components/contabilidad/coa` |
| Pantallas: cierre de mes, cierre anual, 6 reportes | Hecho; cargan en navegador con datos reales | `apps/web/src/components/contabilidad/reports` |
| Pantallas: partidas, tipos de partida, centros de costo | Hecho; partidas carga, entra a edición y graba con sesión real. Flujo de teclado sin probar | `apps/web/src/components/contabilidad/entries` |
| Paridad con el sistema anterior | Parcial: ver **Paridad** | — |
| Spec de Bancos y Cuentas por pagar | Hecho, sin revisar con el negocio (34 preguntas) | [bancoc/](bancoc/README.md) |
| Spec de IVA | Hecho, sin revisar con el negocio | [iva64/](iva64/README.md) |
| Spec de Cuentas por cobrar | Hecho, sin revisar con el negocio (36 preguntas) | [cxc64/](cxc64/README.md) |
| Spec de Lotes (producción) | Hecho, sin revisar con el negocio | [lote64/](lote64/README.md) |
| Spec de Activo fijo | Hecho, sin revisar con el negocio | [afijo64/](afijo64/README.md) |
| Spec de Planilla | Hecho, sin revisar con el negocio; ~50 reportes sin leer | [plan64/](plan64/README.md) |
| Imagen unificada: mapa de integración, capa compartida, módulos destino, contratos y orden | Hecho. Los dos primeros verificados contra el código en lo principal; el diseño es propuesta sin revisar | [docs/sistema/](../sistema/README.md) |
| Spec de la solución de factura electrónica | Hecho desde el repositorio `factura-electronica-mc`; parte del código sin leer | [dte/](dte/README.md) |
| Spec de Inventario, facturación y DTE | Hecho, sin revisar con el negocio (55 preguntas); ~244 reportes sin leer | [inv64/](inv64/README.md) |
| Usuarios: API y pantalla (roles, bloqueo, empresas) | Hecho, 9 pruebas; pantalla sin abrir en navegador | `apps/api/src/routes/users.ts`, `apps/web/src/components/admin` |

Pruebas automáticas: 81 en `apps/api` (`pnpm --filter @accounting/api test`). La web compila como
exportación estática (`pnpm build:web`, 22 páginas).

Probado a mano en navegador, contra una base cifrada temporal con los datos reales: inicio de
sesión, catálogo (619 cuentas), los 6 reportes, cierre de mes, y en partidas: abrir la última
partida del mes, entrar a Agregar (propone el número siguiente), grabar una partida cuadrada,
rechazo de una descuadrada y anulación. **No probado:** captura con teclado línea por línea,
modificar, copiar, buscar, impresión, ni la apariencia (no hubo capturas de pantalla).

## Cómo probarlo

1. Importar los datos del sistema anterior a la base (con la API detenida):
   `pnpm --filter @accounting/api legacy:import -- --source <ruta>/MCERP/CONTAC --parity`
   (agregar `--replace` para repetir la importación de una empresa).
2. Levantar la API (`pnpm dev:api`) y la web (`pnpm dev:web`), abrir `http://localhost:3000`.
3. En **Elaboración de partidas** elegir un mes con datos (el libro importado cubre 2020-03 y
   de 2021-11 a 2024-03).

## Paridad

- **Lectura:** el lector nuevo lee exactamente los mismos registros que `vfp.py` en las 9 tablas.
- **Importación:** 619 cuentas, 5,220 partidas, 48,024 líneas; no se pierde ni duplica ninguna línea.
- **Cálculo:** el balance de comprobación de la API coincide con el cálculo independiente del
  importador en los 18,570 saldos de los 30 meses (cero diferencias).
- **Contra la tabla de saldos del sistema anterior (`SALDOS`): no cuadra limpio.** 2,444 de
  11,730 filas difieren; 2,381 son arrastre de pocos puntos de origen, todos en los datos viejos:
  1. 2020-03: una partida con dos líneas repetidas; explica el descuadre de 50.00. Verificado.
  2. 2012-12 y 2021-09: `SALDOS` tiene movimiento en meses sin ninguna partida. Verificado.
  3. 2023-02: el saldo anterior de una cadena de cuentas no es el saldo final de enero en la
     propia tabla vieja. Verificado.
  4. 2024-02: las diferencias caen en las cuentas de una sola partida (tipo 09, número 000066);
     la tabla vieja parece desactualizada tras una modificación. **Inferido, no probado.**
- **Falta:** comparar contra los *reportes impresos* del sistema anterior (no solo contra su
  tabla de saldos), y repetir todo con datos de otro cliente.

## Datos sucios encontrados (se importan tal cual y se reportan)

- 1 partida descuadrada (50.00); el balance general a 2024-03 difiere por ese mismo monto.
- 11 grupos de líneas sin encabezado en `PARTIDAS`: el importador crea el encabezado.
- 1 cuenta usada en partidas que no existe en el catálogo: se crea una cuenta provisional.
- 33 líneas cargadas directo a 2 cuentas padre (no de detalle).
- 71 líneas con monto negativo y 26 con cargo y abono a la vez.
- 5 partidas con número vacío; 600 líneas sin centro de costo en cuentas que lo exigen.
- `PRESUP`: de 682 filas solo 4 tienen montos; 462 apuntan a cuentas que no existen.

## Hallazgos del spec de Bancos que afectan lo ya construido

- **Las tablas de Bancos y CxP viven en `MCERP/CONTAC/dbf`**, junto a las de contabilidad; no
  existe `MCERP/BANCOC/dbf`.
- **Cuentas por pagar sí existe, dentro de Bancos:** proveedores, documentos (*quedan*), notas,
  pagos aplicados, vencimientos, antigüedad y provisión contable. Se propone como módulo aparte.
- **La marca `generado = 1` ya no se graba** en el código vivo (la línea está comentada). Unas
  1,970 de 5,209 partidas vienen de Bancos sin la marca. El importador de CONTAC las trae como
  `importado`; el de Bancos tendrá que enlazarlas por `MOVIBAN` y marcarlas `source = 'bancos'`.
- **Las líneas se guardan dos veces** (`DETABANK` y `DETAPART`) y ya divergen: 1,067 de 12,724
  líneas de `DETABANK` no tienen pareja. Propuesta: la contabilidad manda.
- **Cuentas por pagar necesita un origen nuevo en el libro mayor** (`source = 'cxp'`); hoy solo
  se aceptan `manual`, `bancos`, `iva`, `cierre` e `importado`.
- La conciliación bancaria existe pero no se usa (0 de 2,691 movimientos conciliados), y las
  transferencias entre cuentas propias no funcionan en el sistema anterior.
- Posible error del sistema anterior: el IVA percibido usa la misma tasa que el IVA retenido.

Sin verificar: el spec no se ha revisado con el negocio, y 47 reportes de Bancos no se leyeron a detalle.

## Hallazgos de los specs de IVA y Cuentas por cobrar

- **Los datos de Contabilidad en disco están atrasados:** CxC tiene movimientos hasta 2026-10,
  pero el libro de CONTAC termina en 2024-03. Para la paridad hace falta una copia reciente.
- **CxC contabiliza por lotes manuales:** cinco procesos (ventas, devoluciones, notas de abono,
  abonos, remesas) que graban UNA partida resumen por rango de fechas, sin marcar qué movimientos
  ya se contabilizaron. Los rangos pueden traslaparse o dejar huecos.
- **La facturación vive en Inventario**, que escribe la factura en la tabla de CxC. La emisión
  de factura electrónica (DTE) también está en Inventario. Sube la prioridad de ese spec.
- **IVA no toca la contabilidad:** solo libros y archivos para Hacienda. Sus libros de ventas se
  llenan por traslado desde CxC, que borra y recrea el mes.
- **Los saldos de documentos de CxC sí cuadran** con sus aplicaciones (0 diferencias en 56,774
  facturas), así que se pueden calcular en vez de guardar.
- **El libro mayor necesita un contrato para que otros módulos publiquen partidas** (`source`
  `cxp`, `cxc`…): los módulos no se importan entre sí. Está por diseñar antes de Bancos.
- Controles que el sistema anterior no aplica: límite de crédito, reapertura de mes sin
  contraseña ni rastro, números de recibo repetidos.

## Hallazgos de los specs de Inventario y Lotes

- **La factura electrónica (DTE) no la emite el sistema anterior.** Inventario solo deja el
  documento en una tabla de espera; un **programa externo que no está en el código fuente**
  firma, transmite y escribe de vuelta el sello y los códigos. Hay que identificar ese programa
  antes de diseñar el módulo de DTE.
- **La facturación está en Inventario:** tres pantallas de venta que escriben de 8 a 12 tablas
  en un solo grabado sin transacción. Una nota de crédito grabada pero no impresa nunca llega a CxC.
- **Costeo:** promedio móvil por producto (todas las bodegas). El cierre de mes vuelve a
  valuar movimientos, así que el costo de una venta puede cambiar después de facturada.
- **Existencias guardadas en cinco lugares** actualizados a mano; 21 productos no cuadran con
  sus movimientos. Propuesta: calcular desde movimientos.
- **Ventas se contabilizan desde dos módulos** (lotes manuales de Inventario y de CxC), sin
  enlace documento–partida. No se pudo determinar si hoy se duplican.
- **Lotes es producción** (órdenes, fórmulas, costo real). Escribe directo en nueve tablas de
  Inventario y contabiliza por lotes manuales. Se propone un módulo `production`.
- **Módulos propuestos por los specs:** `banking`, `accounts-payable`, `tax`,
  `accounts-receivable`, `inventory`, `sales`, `dte`, `production`.

## Hallazgos de los specs de Activo fijo y Planilla, y patrón común

- **Patrón común a todos los módulos:** cada uno escribe sus partidas directo en las tablas de
  Contabilidad con la rutina compartida `CGADIPAR`, casi siempre por lotes manuales, sin marca
  de origen y sin enlace documento–partida. El primer trabajo de diseño antes de cualquier
  módulo nuevo es **el contrato para publicar partidas en el libro mayor** (`source`,
  `source_ref`, reemplazo y reverso controlados).
- **Activo fijo:** solo línea recta. La depreciación acumulada guardada en cada activo está mal
  en 141 de 143 activos (la actualización escribe sobre el registro equivocado); la paridad debe
  hacerse contra las cuotas. Deprecia activos marcados como no depreciables. No existen bajas,
  ventas ni revaluaciones.
- **Planilla:** quincenal sobre sueldo mensual. Tasas, topes y tabla de renta viven en un
  archivo de configuración sin fechas de vigencia ni historial; varios porcentajes están fijos
  en el código. El cierre de planilla no se puede reabrir. La partida contable omite varios
  conceptos y puede salir descuadrada. No usa Bancos: el pago sale a un Excel genérico. Hay una
  versión del cálculo de 2025 fuera del proyecto que difiere de la vigente; no se sabe con cuál
  paga el cliente.
- Todo lo legal (IVA, DTE, ISSS, AFP, renta, depreciación) está descrito como *lo que hace el
  código* y marcado para verificar contra la normativa vigente.

## Factura electrónica: ya existe y está resuelta fuera del ERP

El "programa externo" que los specs de Inventario e IVA daban por perdido es el repositorio
`factura-electronica-mc` (cliente de escritorio .NET, versión 1.13.3). Spec en [dte/](dte/README.md).

- **Contrato con el ERP:** lee `FELECTRO` y `FANULAR` cada 60 segundos, agrupa las líneas por
  documento, arma y firma el DTE, lo transmite y escribe de vuelta solo cinco campos
  (`PROCESADO`, `FALLO`, `NCONTROL`, `CODGENERAC`, `SELLORE`). Deja JSON, PDF y QR nombrados
  por código de generación y envía el correo.
- **No calcula montos:** los copia de lo que deja el ERP. El número de control lo arma la
  solución con el tipo, los códigos de establecimiento y punto de venta, y el número del ERP.
- **Decisión para la plataforma nueva (dueño, 2026-11-12):** la factura electrónica se integra en la
  plataforma: el módulo `dte` firma y transmite directo al facturar y **no se integra con la solución
  .NET**, que queda como referencia (JSON dorados, casos de rechazo) y para los clientes que sigan en
  el ERP anterior, sin tocarlos. Se descartó el puente de convivencia. Detalle en
  [contratos §6](../sistema/contratos.md#6-documento-tributario-electrónico-dte).
- **Riesgos que el spec señala en la solución actual (sin verificar por mí):** un reintento
  tras un corte de red usa un código de generación nuevo con el mismo número de control; el
  historial local puede no registrar un envío; el motivo de rechazo no llega al ERP; si el
  programa no está abierto no se factura.
- **Fecha a vigilar:** el repositorio marca el cambio a la normativa v2 para 2026-12-01, con
  activación manual por cliente. Verificar contra la normativa vigente.

## Supuestos que tomé

| # | Supuesto | Dónde cambiarlo |
|---|---|---|
| S1 | Roles: Propietario, Supervisor, Digitador y Consulta, Digitador, Consulta. Permisos: *capturar*, *reportes*, *supervisar*. El Digitador captura pero no ve reportes. | `packages/shared/src/roles.ts` |
| S2 | No hay permiso por pantalla (pregunta 12), solo los tres permisos. | igual |
| S3 | El Propietario ve todas las empresas; los demás solo las asignadas. | igual (`seesAllEmpresas`) |
| S4 | El mes de trabajo se recuerda por empresa en cada computadora. | `apps/web/src/lib/work-period.ts` |
| S5 | Componentes de pantalla hechos a mano con Tailwind; shadcn/Radix no está instalado. | `apps/web/src/components/ui` |
| S6 | Las pantallas viven en `apps/web`, no dentro de cada módulo. | — |
| S7 | El código de una cuenta no se puede cambiar después de creada. | `modules/chart-of-accounts/services` |
| S8 | Cambiar el tipo de una cuenta cambia también el de sus sub-cuentas; se rechaza si alguna tiene movimientos. | igual |
| S9 | Una partida en borrador cuenta como "movimiento" para impedir eliminar una cuenta. | `services/usage.ts` |
| S10 | Una partida nueva se graba como *aplicada* si cuadra; si no, se ofrece guardarla como borrador. | `modules/general-ledger/services` |
| S11 | Quien captura puede regresar a borrador una partida aplicada al modificarla. | igual |
| S12 | No se puede cerrar un mes con borradores pendientes. | `services/periods.ts` |
| S13 | Anular una partida de cierre anual requiere permiso de supervisar. | `services/entry-actions.ts` |
| S14 | El cierre anual usa saldos acumulados, igual que el sistema anterior, y solo genera líneas para cuentas de detalle. | `services/annual-close.ts` |
| S15 | Cuentas de orden y contra se muestran aparte y fuera de la ecuación del balance (pregunta 3). | `services/statements.ts` |
| S16 | Los totales de los reportes incluyen lo cargado directo a cuentas padre. | `services/balances.ts` |
| S17 | Importador: `moneda = 2` se toma como USD; un tipo de partida vacío se guarda como `??`; las cuentas provisionales quedan activas. | `tools/legacy-import/src/contac` |
| S19 | Un Supervisor que no es Propietario solo ve y asigna las empresas que él mismo tiene. No hay cambio de contraseña desde el sistema. | `apps/api/src/routes/empresas.ts`, `routes/users.ts` |
| S18 | Importador: se crea un año fiscal enero–diciembre por cada año con partidas; la fila de `PERIODO` (2018) no se usa. | igual |

## Preguntas para el negocio

Las 11 preguntas abiertas de CONTAC siguen en [open-questions.md](contac/open-questions.md)
(la 1 tiene además pendiente saber por qué quedan grabadas partidas descuadradas). Nuevas:

1. **Historial faltante:** el libro solo tiene partidas de 2020-03 y de 2021-11 en adelante.
   ¿Dónde están las de 2020-04 a 2021-10? ¿Se depuraron, o están en otro respaldo?
2. ¿Qué cifra es la correcta en la partida de 2020-03 con líneas repetidas, y en la de 2024-02
   que la tabla de saldos vieja refleja a medias?
3. ¿Se ignoran las filas de saldos de 2012-12 y 2021-09 que no tienen partidas?
4. ¿`moneda = 2` es dólares?
5. ¿El Digitador debe poder ver reportes? ¿Quién puede anular partidas: quien captura o solo el Supervisor?
6. ¿Se permite cargar a una cuenta padre? Hoy la captura nueva lo impide, pero los datos viejos lo traen.
7. ¿Se limpian antes de migrar las 600 líneas sin centro de costo y las 71 con monto negativo?
8. ¿Cambiar el tipo de una cuenta con sub-cuentas debe arrastrarlas (S8) o prohibirse?
9. ¿Largo máximo real del nombre de cuenta? (Se usó 100; el sistema anterior tiene 45.)

## Pendiente

- **Probar con una persona la captura de partidas** con teclado (agregar líneas, modificar,
  borrador, copiar, buscar) y la impresión de cada reporte. Es lo que más probablemente
  necesite ajustes.
- La pantalla de partidas no muestra la fecha de cobro (`fcobro`, pregunta 6) y, al modificar
  una partida importada que sigue descuadrada, solo ofrece guardarla como borrador.
- **Partida de apertura** en el importador para clientes sin historial completo (no hizo falta aquí).
- **Tablas y pantallas no construidas:** diseñador de estados de resultados (pregunta 8),
  presupuestos (solo se importan), configuración contable por empresa (cuentas de IVA, tasas),
  "Subir partida contable" e "Importar catálogo" (pregunta 10), consolidación (pregunta 11),
  libros legales foliados (pregunta 9).
- **Integraciones:** choque de correlativos con Bancos e "Ingresar al IVA / Renta" llegan con esos módulos.
- **Usuarios:** falta pantalla para crear usuarios con los roles nuevos y asignarles empresas
  (la API de empresas ya lo permite).
- **Empaquetado:** todo el backlog de [architecture.md](../architecture.md), más: la API de
  producción debe empaquetar los módulos y `@accounting/shared` (hoy solo corren con `tsx`).
- **`GET /periods`** devuelve el id del usuario que cerró el mes, no su nombre.

## Bloqueos

- **`MCERP/` mezcla copias de distintos clientes y fechas.** Lotes es de un cliente (2019–2020);
  Inventario, CxC e IVA son de otro (hasta 2026-10); Contabilidad termina en 2024-03. La paridad
  entre módulos necesita una copia completa, de una misma fecha, de un solo cliente.

- **Solo hay datos de una empresa en `MCERP/CONTAC`.** Hace falta una copia de al menos un
  cliente más, idealmente con varias empresas. Existe `dbf/DBF.rar`, que no se abrió.
- **La paridad final necesita reportes impresos** del sistema anterior (balance de comprobación
  y balance general de un mes cerrado) para comparar contra lo que el negocio considera correcto.
