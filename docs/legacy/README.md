# Legacy migration (MCERP → nueva plataforma)

Punto de partida para cualquier sesión que trabaje en la migración del sistema anterior.
Resume **dónde está el sistema viejo, cómo lo leemos, qué decidimos y en qué vamos**.
Actualizar la sección *Progreso* al terminar cada módulo.
**Estado actual, supuestos, preguntas y bloqueos: [REPORTE.md](REPORTE.md).**
El despliegue (servidor + clientes en red local) está en [docs/architecture.md](../architecture.md).

## 1. Dónde está el sistema anterior

- Carpeta `MCERP/` en la raíz del repo. Está en `.gitignore`: **nunca se commitea**
  (≈3.2 GB, contiene datos reales de clientes).
- Es un ERP en **Visual FoxPro 9** (algunas pantallas convertidas de FoxPro 2.x).
- Un folder por módulo, cada uno con `fuente/` (código) y `dbf/` (datos):

| Carpeta | Módulo | Destino en `modules/` |
|---|---|---|
| `CONTAC` | Contabilidad general | `chart-of-accounts` + `general-ledger` |
| `BANCOC` | Bancos | **nuevo** `banking` |
| `cxc64` | Cuentas por cobrar | `accounts-receivable` |
| `INV64` | Inventario (el más grande) | `inventory` |
| `LOTE64` | Lotes / fórmulas / despachos | **nuevo** (lotes/producción) |
| `IVA64` | Libros de IVA | **nuevo** `tax` (IVA) |
| `AFIJO64` | Activo fijo | `fixed-assets` |
| `plan64` | Planilla | `payroll` |
| — | CxP no existe como módulo legado | `accounts-payable` — **la lógica vive dentro de BANCOC** (menú "Cuentas por pagar"); ver [bancoc](bancoc/README.md) |

## 2. Cómo leer el sistema anterior

Tipos de archivo:

| Extensión | Qué es | Cómo se lee |
|---|---|---|
| `.prg` | Código fuente | Texto plano (cp1252) |
| `.mpr` | Menú generado | Texto plano: es el **mapa de funcionalidades** |
| `.pjx` / `.pjt` | Proyecto (lista de archivos que se compilan) | Tabla DBF → dice qué código está **vivo** |
| `.scx` / `.sct` | Pantallas (forms) | Tabla DBF + memo: propiedades y **código de eventos** |
| `.spr` | Pantalla generada / stub | Texto; en pantallas convertidas solo llama `DO FORM` |
| `.frx` / `.frt` | Reportes | Tabla DBF + memo (pendiente de extraer) |
| `.dbf` / `.cdx` / `.fpt` | Datos / índices / memos | Tabla DBF |
| `.fxp`, `.bak`, `.err`, `*OLD*`, `PTEMP*`, `DTEMP*`, `RESPAL/` | Compilados, respaldos, temporales | **Ignorar** |

Herramientas: [`tools/legacy-extract/`](../../tools/legacy-extract/README.md) (Python, solo stdlib):
`vfp.py` (lector DBF + memos), `dump_scx.py` (código de pantallas a texto),
`render_scx.py` (pantallas a HTML aproximado).

## 3. Proceso por módulo

1. **Proyecto vivo:** leer el `.pjx` más completo del módulo (en CONTAC fue `CONT.PJX`, 364 archivos;
   `CONT64.pjx` estaba vacío). Lo que no está en el proyecto, no se usa.
2. **Menú:** leer el `.mpr` principal; cada opción → procedimiento → pantalla/programa.
   En CONTAC cada opción revisa permiso en `PERFIL` antes de abrir.
3. **Esquemas:** volcar estructura (campos, tipos, # registros) de las tablas de `dbf/`.
   Solo estructura, **nunca copiar datos de clientes a los docs**.
4. **Lógica:** volcar con `dump_scx.py` las pantallas clave y leer los `.prg` que llaman
   (las reglas viven en los eventos `Valid`, `When`, `Load` y en los botones).
5. **UI:** renderizar 2–4 pantallas con `render_scx.py`, servirlas con
   `python -m http.server` y verlas en el navegador (las pantallas que se redimensionan
   en tiempo de ejecución salen recortadas).
6. **Escribir el spec** en `docs/legacy/<modulo>/`: `README.md` (menú → destino),
   `business-rules.md`, `data-model.md`, `open-questions.md`.
7. Revisar el spec con el negocio → diseñar schema Drizzle → API + UI → importador DBF → SQLite
   → **paridad**: los reportes nuevos deben cuadrar al centavo con los del sistema viejo.

Hallazgos útiles:
- Sistema de usuarios compartido: `USUARIOS` (nivel), `PERFIL` (permiso por pantalla),
  `USREMP` (usuario ↔ empresa), `BITACORA` (auditoría), `EMPRESAS` (una carpeta por empresa).
- Configuración por empresa en archivos `.MEM` (ej. `BANCOCFG.MEM`: cuentas de IVA, tasas, `cfg_cuadre`).

## 4. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Estrategia | Módulo por módulo, no por rol. Se **re-implementa** desde un spec; no se transpila código. |
| Orden | CONTAC primero (todo postea al GL). Sugerido luego: Bancos → CxC → Inventario/Lotes → IVA → Activo fijo → Planilla (ajustable a prioridades del negocio). CxP se diseña junto a Bancos. |
| Módulos nuevos | Bancos, IVA, Lotes y CxP tienen módulo propio. |
| Idioma | UI **en español** primero (es lo que usan los clientes). |
| Estilo de UI | Familiar al sistema anterior, con shadcn: barra de íconos (Agregar, Buscar, Eliminar, Modificar, Anterior, Siguiente, Grabar, Cancelar, Imprimir…) en el mismo orden; encabezado + grid de líneas; barra TOTALES/Diferencia; selector de mes (ENERO…DICIEMBRE). Más limpio, mismo flujo. |
| Multi-empresa | Una instalación = una BD cifrada por cliente; **`empresa_id` en toda tabla de negocio**; el usuario elige empresa al entrar; la consolidación es una consulta entre empresas. |
| Roles | Niveles legados Supervisor / Digitador y Consulta / Digitador / Consulta → roles de Better Auth. |
| Codificación | El importador detecta cp1252 (mayoría, marca `0x03`) vs cp850 (tablas sin marca `0x00` o `0x02`) y convierte a UTF-8. Está en alcance. |
| Saldos | Se calculan desde las líneas de partida (no se guardan tablas de saldos); caché solo si el volumen lo exige. |
| Borrado | Anulación (soft delete), nunca borrado físico. |
| Integraciones | Los módulos (Bancos, IVA…) publican partidas al GL; el GL marca su origen (`source`). |

## 5. Progreso

| Módulo | Spec | Schema | API/UI | Importador | Paridad |
|---|---|---|---|---|---|
| CONTAC | ✅ [docs/legacy/contac](contac/README.md) — 11 preguntas abiertas | ✅ core + catálogo + GL | ✅ API con 69 pruebas; pantallas hechas, captura de partidas sin probar a fondo | ✅ [import.md](contac/import.md) | ⚠️ cálculo verificado; no cuadra limpio contra `SALDOS` (ver [REPORTE](REPORTE.md)) |
| BANCOC (+ CxP) | ✅ [docs/legacy/bancoc](bancoc/README.md) — 34 preguntas abiertas | — | — | — | — |
| cxc64 | ✅ [docs/legacy/cxc64](cxc64/README.md) — 36 preguntas abiertas | — | — | — | — |
| INV64 | ✅ [docs/legacy/inv64](inv64/README.md) — 55 preguntas abiertas; reportes sin leer | — | — | — | — |
| LOTE64 | ✅ [docs/legacy/lote64](lote64/README.md) | — | — | — | — |
| IVA64 | ✅ [docs/legacy/iva64](iva64/README.md) | — | — | — | — |
| AFIJO64 | ✅ [docs/legacy/afijo64](afijo64/README.md) | — | — | — | — |
| plan64 | ✅ [docs/legacy/plan64](plan64/README.md) | — | — | — | — |

Pendientes generales:
- Responder las 11 [open-questions de CONTAC](contac/open-questions.md) restantes con el negocio
  (decididas: 1, 2, 4, 5 y 13).
- Las decisiones 1, 2, 4 y 13 se revisaron contra los datos de `MCERP/CONTAC` (2026-11-10): no las
  contradicen, pero **solo hay una empresa** en disco (1 período, enero–diciembre, sin catálogo
  alterno, 1 partida descuadrada de 5,215). Falta repetir la revisión con datos de más clientes
  (`dbf/DBF.rar` no se abrió).
- Hallazgos de esa revisión para el importador: `EMPRESAS.DBF` está en `fuente/`, no en `dbf/`;
  `moneda` es un código numérico; hay 6 partidas en `DETAPART` sin encabezado en `PARTIDAS`;
  `PERIODO` dice 2018 pero el libro cubre 2020-03 a 2024-03.
- Extraer reportes `.frx` en detalle (se hará al construir cada reporte).
- Confirmar qué opciones de menú ya no se usan (hay pantallas duplicadas, ej. `cgpar01` = `CGMPAR01`).
