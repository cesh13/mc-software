# Cambios de MC Software

Versiones publicadas en el feed de actualizaciones, de la más nueva a la más antigua.
Para publicar una versión: skill `ship-mc-update` (ver `docs/prueba-interna.md`).

## 0.5.0 - 2026-11-19
- Se agregaron formatos de impresión de partidas en la vista previa: Legal, Preliminar y ½ carta.
- Se agregó la opción "Incluir concepto" al imprimir partidas: oculta solo el concepto general; el
  detalle de cada línea siempre se imprime.
- El Balance General se imprime como en el sistema anterior: formato Cuenta (Activo junto a Pasivo y
  Capital) o Reporte, sin códigos, con columna de parciales, Utilidad del ejercicio y doble raya en totales.
- Se agregó la opción de saldos Acumulados o Mensuales en el Balance General, que por defecto muestra
  hasta el nivel 3.
- Se agregaron las firmas y cargos al pie del Balance General (hasta tres, guardadas por empresa) y la
  opción de imprimir la hora y fecha.

## 0.4.0 - 2026-11-18
- Se agregó una vista previa al imprimir: el botón Imprimir (o F9) muestra en pantalla la hoja tal como
  saldrá impresa, con los botones Imprimir (F9) y Cerrar (Esc), en lugar de mandar directo a la impresora.

## 0.3.1 - 2026-11-17
- Se amplió el campo Detalle en Elaboración de partidas: la columna es más ancha y el texto largo se
  muestra completo en varias líneas en lugar de cortarse.

## 0.3.0 - 2026-11-16
- Se agregó la pantalla Migración (Administración, solo el Propietario): revisa la carpeta del sistema
  anterior (módulos, tablas, fechas de los datos), prueba la importación de Contabilidad y de clientes y
  proveedores en una copia sin tocar la base real, y permite decidir cada hallazgo. Las pruebas quedan en
  un historial.
- Actualiza la base de datos al iniciar (respaldar la carpeta de datos antes).

## 0.2.0 - 2026-11-15
- Se agregaron permisos por opción y acción: cada pantalla y botón se muestra según los permisos
  del usuario, y en Usuarios se puede conceder o negar cada permiso, para todas las empresas o una.
- Se agregó la Bitácora (Administración) con filtros y exportación a CSV.
- Se agregó la ficha fiscal de cada empresa (NIT, NRC, giro, dirección y demás datos).
- Abrir un mes cerrado ahora pide un motivo, que queda en la bitácora.
- El estado de los meses pasa a un registro común para todos los módulos; los meses cerrados se conservan.
- Se agregó el maestro de clientes y proveedores (sin pantalla todavía) y la base para que los próximos
  módulos (Bancos, Cuentas por pagar) contabilicen sus documentos.
- Actualiza la base de datos al iniciar (respaldar la carpeta de datos antes).

## 0.1.1 - 2026-11-13
- Versión de prueba para verificar la actualización automática. Sin cambios funcionales.

## 0.1.0 - 2026-11-13
- Primera versión instalable para prueba interna: contabilidad (catálogo de cuentas, partidas,
  cierre de mes, cierre anual y reportes), usuarios y empresas.
- Modo servidor y modo cliente, con actualización automática desde el feed.
