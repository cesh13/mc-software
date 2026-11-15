# Pantalla de migración

Fecha: 2026-11-15. Pantalla de administración para revisar una copia del sistema anterior y probar su importación
sin tocar la base real. Complementa [import.md](../legacy/contac/import.md) (el importador de Contabilidad) y
[fase-0.md](fase-0.md).

## Estado (2026-11-15)

Versión 1 construida y probada en el navegador contra la copia real de `MCERP/`: revisión de carpeta en 0.3 s,
prueba de Contabilidad + Terceros en 3 s, la base real sin cambios. Código: `tools/legacy-import/src/migration/`
(catálogo de módulos, revisión, hallazgos, registro de importadores), `apps/api/src/routes/migration.ts`,
`apps/api/src/lib/migration-run.ts`, `apps/web/src/components/migration/`. Pruebas en `apps/api/tests/migration.test.ts`.

## Versión 1

Tres pasos, todos de solo lectura sobre la base real:

1. **Revisar la carpeta.** Se indica la carpeta del sistema anterior **en la PC servidor** (la que tiene `CONTAC`,
   `INV64`, `cxc64`…). Por cada módulo se revisan sus tablas esperadas: encontrada o no, registros vivos y borrados,
   fecha de última modificación del archivo, codificación del texto y el rango de fechas de sus movimientos. Hallazgos
   de toda la copia: módulos de fechas distintas, tablas obligatorias faltantes, archivos comprimidos sin abrir.
2. **Prueba de importación.** Corre los importadores elegidos (hoy Contabilidad y Terceros, en ese orden) sobre una
   **copia en memoria** de la base real; la copia se descarta al terminar. Muestra cantidades, hallazgos y la paridad
   por causa.
3. **Decidir cada hallazgo.** Cada hallazgo tiene gravedad (*bloquea*, *decidir*, *informativo*), una acción
   recomendada y, si aplica, la pregunta de [PREGUNTAS.md](../legacy/PREGUNTAS.md). La decisión (aceptar tal cual,
   corregir en el sistema anterior, pendiente con el negocio) se guarda con quién y cuándo, y se conserva entre corridas.

Cada corrida queda en un historial con su informe, quién la hizo, la carpeta y las opciones.

## Decisiones

| Tema | Decisión |
|---|---|
| Dónde vive | Función del núcleo (`apps/api/src/routes/migration.ts`, pantalla en Administración), no un módulo: escribe en tablas de todos los módulos y no tiene sentido apagarla por empresa. Los importadores siguen en `tools/legacy-import`; la línea de comandos sigue funcionando |
| Interfaz común | Cada importador se registra con `id`, `label`, `dependsOn`, `inspect` y `run`; `run` devuelve su informe y **hallazgos estándar** (`código`, gravedad, cantidad, muestras por llave, recomendación, pregunta). La pantalla solo lista lo registrado: Bancos y los demás se agregan sin tocarla |
| Copia para la prueba | `serialize()` de la base real (páginas ya descifradas) y apertura en memoria: no queda archivo sin cifrar en disco y no hace falta borrar nada |
| Hilo | V1 corre la prueba en el proceso de la API después de responder (la pantalla consulta el avance). Mientras corre, el servidor atiende más lento unos segundos. Pasar a un hilo aparte queda para cuando Inventario o CxC lo exijan |
| Permiso | `core.migration.run`, sin paquete: solo el Propietario, salvo que se conceda |
| Carpeta | Ruta absoluta en el servidor; los DBF se abren solo para leer. Sin subida de archivos por el navegador |
| Privacidad | Los informes guardan cantidades y llaves (códigos, NRC, períodos), nunca filas completas |
| Aplicar | **No en V1.** V2: respaldo automático, modo mantenimiento de la empresa e importación en una transacción |

## Pendiente (V2 y siguientes)

- Hoy los hallazgos de *bloquea* también admiten decisión; en V2 "Aplicar" debe exigir que no quede ninguno.
- Las muestras se guardan hasta 500 por hallazgo (suficiente para la lista de revisión de terceros).

- "Aplicar" con respaldo y modo mantenimiento.
- Importadores de cada módulo nuevo (Bancos, CxP…) con sus revisiones: forma parte del "terminado" de cada módulo.
- Hilo aparte para corridas largas.
