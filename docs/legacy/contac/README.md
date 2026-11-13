# CONTAC — Contabilidad General (legacy spec)

Extraído del sistema MCERP (Visual FoxPro 9), carpeta `MCERP/CONTAC`.
Proyecto vivo: `CONT.PJX` (364 archivos). Menú principal: `CTMENU.MPR`.
Target en la nueva plataforma: módulos `chart-of-accounts` + `general-ledger`.

Documentos:

- [data-model.md](data-model.md) — tablas legadas y modelo propuesto (con `empresa_id`)
- [business-rules.md](business-rules.md) — reglas de negocio extraídas del código
- [open-questions.md](open-questions.md) — decisiones pendientes para el cliente

> Este spec describe *qué hace* el sistema, no copia el código. No contiene datos de clientes.

## Mapa de menú → funcionalidad

Cada opción del menú verifica permiso en `PERFIL` (usuario + programa) antes de abrir,
**salvo**: Estado de Resultado Definido (normal y comparativo), Seleccionar Mes de Trabajo,
Seleccionar Empresa y Usuarios (nivel 1 abre el mantenimiento; los demás, el cambio de su
propia clave). "Copiar Archivo" sí consulta `PERFIL` pero no tiene ninguna fila, así que
nunca abre *(inferido)*.
Las 71 opciones se verificaron contra el menú (2026-11-12): todas llaman a la pantalla indicada.
Columna **Destino**: ✅ migrar · 🔁 migrar rediseñado · ❌ no migrar (técnico/obsoleto).

### Mantenimiento de Archivos

| Opción | Pantalla | Destino |
|---|---|---|
| Catálogo de Cuentas | `cgmcat01` | ✅ chart-of-accounts |
| Tipos de Comprobante | `cgmtip01` | ✅ general-ledger (tipos de partida) |
| Crear Centros de Costos | `cgmcosto` | ✅ general-ledger |
| Crear Agrupaciones para Presupuestos | `cgmagrup` | ✅ presupuestos |
| Importar Catálogo | `catimp` | 🔁 importador genérico. Hoy: CSV con `;` (cuenta, nombre, tipo, padre, es_detalle, nivel, pcosto); solo carga sobre catálogo vacío; la opción de borrar elimina todo sin revisar movimientos; no valida jerarquía |

### Edición de Comprobantes

| Opción | Pantalla | Destino |
|---|---|---|
| Elaboración de Partidas | `cgmpar01` | ✅ pantalla principal del GL |
| Imprimir Partidas | `cgipar01` | ✅ PDF por rango de partidas |
| Generar Partida Consolidada | `ctconcen` | ✅ reporte **"Movimientos Resumidos"**: líneas agrupadas por cuenta a N niveles en un rango de fechas, de una sola empresa. **No consolida empresas** |
| Definir Estado de Resultado (Comercial / Industrial) | `cgmest01`, `cgmst01` | ✅ diseñador de estados |
| Subir Partida Contable | `cosubpar` | 🔁 importar partidas. Hoy: CSV de columnas fijas (tipo, fecha, número, cuenta, detalle, cargo, abono, centro de costo, concepto, mes, tipomov); todo o nada; valida que la partida no exista y que las cuentas existan y sean de detalle; **no valida cuadre, mes cerrado ni centro de costo, y no actualiza saldos** |

### Reportes

| Opción | Pantalla | Destino |
|---|---|---|
| Catálogo de Cuentas | `cgrcat01` | ✅ |
| Balance de Comprobación (normal / comparativo / por C. de Costo) | `cgrsal01`, `cgrsalcp`, `cgrsal03` | ✅ |
| Libro Auxiliar | `cgrmov01` | ✅ |
| Libro Diario Mayor | `cgldiama` | ✅ |
| Diario General | `cgldia01` | ✅ |
| Libro Mayor | `cglmayor` | ✅ |
| Anexos | `cgrbalc1` | ✅ |
| Balance General (normal / comparativo) | `cgrbalg1`, `cgrbalgc` | ✅ |
| Estado de Resultados (comercial, industrial, mensual, definido, comparativos) | `cgrest01-03`, `cgrst01`, `cgrst01c`, `cnrestco` | ✅ unificar en 1 motor + layouts |
| Saldos por Cuentas (detallado, consolidado, por rubro mensual/anual) | `cgrmov02-05` | ✅ |
| Listado de Partidas Emitidas | `cgrpar01` | ✅ |
| B. Comprobación 2 | `cgrbalc2` | ❓ balance de comprobación con opción acumulado/mensual y por cuenta/reporte; usa el mes elegido en pantalla. Confirmar si se usa |
| Estado de Cambio | `cgrcamb` | ✅ |
| Saldos por C. de Costo (acumulado / mensual) | `cgrmovcp`, `cgrmovc2` | ✅ |
| Consultar Montos | `cgbuscav` | ✅ búsqueda de partidas por monto |

### Utilidades

| Opción | Pantalla | Destino |
|---|---|---|
| Reconstruir Índices | `reindex` | ❌ no aplica en SQLite |
| Seleccionar Mes de Trabajo | `cgselmes` | ✅ selector de período en la barra |
| Seleccionar Empresa | `selemp` | ✅ selector de empresa (login/sesión) |
| Posteo del Mes | `cgactsal` → `cgposteo.prg` | ❌ saldos se calculan en vivo (ver reglas) |
| Revisión del Catálogo | `cgrevcat` | ❌ las reglas se validan al guardar |
| Partidas Descuadradas | `cgrevcua` | 🔁 reporte de control (solo si se permite grabar descuadradas) |
| Cambiar número a un comprobante | `cgchgnum` | ✅ con bitácora |
| Borrar partidas sin número | `cgborra` | ❌ no pueden existir. También borra cuentas del catálogo sin nombre |
| Numerar Páginas | `numera` | 🔁 foliado de libros legales (confirmar). Hoy solo imprime hojas con números de página consecutivos, sin contenido |
| Cierre Mensual / Abrir Mes Cerrado | `cgcmes01`, `cgames01` | ✅ |
| Configurar Cuentas | `config2` | ✅ configuración por empresa |
| Cierre Anual | `cgcierre` | ✅ |
| Copiar Archivo | `copycat` | ❌ utilidad genérica: copia un DBF cualquiera a otra carpeta |
| Cambiar Número a Una Cuenta | `cgchcta` | ✅ con bitácora (hoy **no** la escribe). Renombra el código en catálogo, líneas, saldos mensuales, presupuesto, estados definidos y tablas de Bancos; no toca `SALDOCC` ni revisa mes cerrado |
| Mantenimiento de Empresas | `cgmemp01` | ✅ plataforma (empresas). Las columnas de consolidación están inertes |
| Usuarios | `acceso` / `acceso2` | ✅ plataforma (Better Auth + roles) |

### Presupuestos

| Opción | Pantalla | Destino |
|---|---|---|
| Período | `periodo` | ✅ período de **presupuesto** (no es un año fiscal; no interviene en el cierre anual) |
| Mantenimiento | `presup.prg` | ✅ presupuesto mensual por cuenta / C. de costo |
| Imprimir Presupuesto (general / por C. de Costo) | `cgipre01`, `cgiprecc` | ✅ presupuesto vs real |

## UI de referencia

La pantalla `cgmpar01` (Edición de Partidas) es la que más usan los clientes:
barra de íconos arriba (Agregar, Buscar, Eliminar, Modificar, Anterior, Finalizar,
Siguiente, Grabar, Cancelar, Imprimir, Mes de Trabajo, Copiar, Partidas, Ingresar al IVA,
Ingresar Renta); encabezado (Tipo, Número, Fecha, Concepto general); línea de captura
(Cuenta, C.C., Concepto, Cargo, Abono) + grid; barra de TOTALES y Diferencia; botones
ENERO…DICIEMBRE a la derecha para cambiar de mes.
