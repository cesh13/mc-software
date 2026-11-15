# Cambios de MC Software

Versiones publicadas en el feed de actualizaciones, de la más nueva a la más antigua.
Para publicar una versión: skill `ship-mc-update` (ver `docs/prueba-interna.md`).

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
