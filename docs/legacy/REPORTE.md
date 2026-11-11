# Reporte de avance — migración MCERP

Documento para retomar el trabajo. Se actualiza al final de cada sesión de trabajo.
Última actualización: 2026-11-10 (sesión sin supervisión, en curso).

## Cómo retomar

1. Leer este reporte y luego [el playbook](README.md).
2. Responder las **preguntas para el negocio** de abajo; varias cambian reglas ya construidas.
3. Revisar los **supuestos** que tomé para no detenerme: cada uno dice dónde cambiarlo.

## Estado

| Pieza | Estado | Dónde |
|---|---|---|
| Arquitectura servidor/cliente | Decidida, no construida | [architecture.md](../architecture.md) |
| Schema CONTAC (core, catálogo, libro mayor) | Hecho, con migraciones | `apps/api/src/db/schema-core.ts`, `modules/*/schema*` |
| Base para módulos (empresa activa, permisos, bitácora, pruebas) | Hecho | [module-guide.md](../module-guide.md) |
| Base de la web (selector de empresa, mes de trabajo, menú, componentes) | Hecho, sin probar en navegador | `apps/web/src` |
| Importador DBF → SQLite de CONTAC | En curso | `tools/legacy-import` |
| API de catálogo de cuentas | En curso | `modules/chart-of-accounts` |
| API de libro mayor (partidas, cierres, reportes) | En curso | `modules/general-ledger` |
| Pantallas de CONTAC | Pendiente | `apps/web/src/app/(dashboard)/contabilidad` |
| Paridad con el sistema anterior | Pendiente | — |

## Supuestos que tomé

| # | Supuesto | Dónde cambiarlo |
|---|---|---|
| S1 | Roles: Supervisor, Digitador y Consulta, Digitador, Consulta, más Propietario (quien instala). Permisos: *capturar*, *reportes*, *supervisar*. El Digitador captura pero no ve reportes; Consulta solo ve reportes. | `packages/shared/src/roles.ts` |
| S2 | No hay permiso por pantalla (pregunta 12); solo los tres permisos de S1. | igual |
| S3 | El Propietario ve todas las empresas; los demás solo las que se les asignen. | `packages/shared/src/roles.ts` (`seesAllEmpresas`) |
| S4 | La empresa activa viaja en cada petición y se elige al entrar; el mes de trabajo se recuerda por empresa en cada computadora. | `apps/web/src/lib` |
| S5 | Los componentes de pantalla están hechos a mano con Tailwind. shadcn/Radix no está instalado y no había red para instalarlo. | `apps/web/src/components/ui` |
| S6 | Las pantallas viven en `apps/web`, no dentro de cada módulo: la exportación estática no puede cargar páginas de un módulo en tiempo de ejecución. | — |

## Preguntas para el negocio

Las 11 preguntas abiertas de CONTAC siguen en [open-questions.md](contac/open-questions.md).
Las nuevas que surgieron en esta sesión se agregan aquí.

## Bloqueos

- **Solo hay datos de una empresa en `MCERP/CONTAC`.** La paridad y las decisiones 1, 2, 4 y 13
  solo se pueden comprobar contra ese cliente. Hace falta una copia de al menos un cliente
  con varias empresas. Existe `dbf/DBF.rar`, que no se abrió.
