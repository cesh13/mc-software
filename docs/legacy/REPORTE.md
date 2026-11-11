# Reporte de avance — migración MCERP

Documento para retomar el trabajo. Se actualiza al final de cada sesión de trabajo.
Última actualización: 2026-11-10 (sesión sin supervisión).

## Cómo retomar

1. Leer este reporte y luego [el playbook](README.md).
2. Probar el sistema con los datos importados (sección **Cómo probarlo**).
3. Responder las **preguntas para el negocio**; varias cambian reglas ya construidas.
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
| Pantallas: partidas, tipos de partida, centros de costo | Ver **Pendiente** | `apps/web/src/components/contabilidad/entries` |
| Paridad con el sistema anterior | Parcial: ver **Paridad** | — |

Pruebas automáticas: 81 en `apps/api` (`pnpm --filter @accounting/api test`).

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

- **Probar en navegador la captura de partidas** de punta a punta con teclado (agregar,
  modificar, borrador, anular, copiar) y la impresión de cada reporte.
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

- **Solo hay datos de una empresa en `MCERP/CONTAC`.** Hace falta una copia de al menos un
  cliente más, idealmente con varias empresas. Existe `dbf/DBF.rar`, que no se abrió.
- **La paridad final necesita reportes impresos** del sistema anterior (balance de comprobación
  y balance general de un mes cerrado) para comparar contra lo que el negocio considera correcto.
