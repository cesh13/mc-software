# DTE — solución externa de facturación electrónica (`factura-electronica-mc`)

Spec de la solución que firma y transmite los DTE de El Salvador a partir de lo que deja el ERP FoxPro
(INV64) en `FELECTRO` y `FANULAR`. **Resuelve el bloqueo de [REPORTE.md](../REPORTE.md)** («programa externo de factura
electrónica: no está»): el programa existe, es un repositorio .NET aparte, y está especificado aquí.

> **Estado de este documento:** primera versión escrita a partir de la lectura del código y de la documentación del
> repositorio; las áreas marcadas «pendiente de leer» (sección 7) se afinan en una segunda pasada.
> Etiquetas: **[V]** verificado en código, **[D]** verificado en la estructura de los datos de muestra (solo nombres y
> tipos de campo, nunca filas), **[I]** inferido. Las rutas de código son relativas al repositorio `factura-electronica-mc`.
> **No se afirma ninguna regla tributaria de memoria:** se describe lo que el código implementa, y lo que depende de la
> norma vigente queda en [open-questions.md](open-questions.md) para contrastarlo. Ningún valor de configuración,
> credencial, NIT/NRC, nombre de cliente o dato de documento aparece aquí.

Archivos: [business-rules.md](business-rules.md) (contrato con el ERP y reglas), [data-model.md](data-model.md)
(tablas de staging campo por campo, almacenamiento local, modelo propuesto), [open-questions.md](open-questions.md).

## 1. Qué es y en qué estado está

- Solución .NET (repositorio privado del mismo desarrollador, ~340 commits, versión **1.13.3** del 2026-11-11) [V
  `FacturaElectronica.WPF/CHANGELOG.md`, `FacturaElectronica.WPF/FacturaElectronica.WPF.csproj`]. El `CHANGELOG.md` de la raíz
  está desactualizado (llega a 1.0.49); el vigente es el del proyecto WPF.
- Función: sondea cada ~60 s las tablas DBF que llena el ERP, **construye el JSON del DTE, lo firma localmente, lo transmite al
  Ministerio de Hacienda (MH), escribe de vuelta el resultado en el DBF, genera JSON/PDF/QR y envía el correo** al receptor.
- Madura en operación (varios incidentes de producción documentados y corregidos en el changelog) y activa: hay cambios casi
  a diario por la migración a la «normativa v2» (el propio repositorio fija el 2026-12-01 como fecha de cumplimiento: **verificar
  contra la norma vigente**).
- Pruebas: xUnit + Shouldly + NSubstitute; suite de la biblioteca (construcción DBF→DTE, contrato JSON, validación contra
  esquemas oficiales en pruebas), suite del cliente WPF, pruebas de captura de PDF píxel a píxel; **ninguna prueba ejercita el envío
  real** ni el contacto con el MH [V `TESTING.md`, `FABLE-AUDIT.md` §8.5]. Unos 540 casos xUnit (conteo por atributos `[Fact]`/`[Theory]`, sin ejecutarlos).

## 2. Componentes y despliegue

| Componente | Qué hace | Notas |
|---|---|---|
| `FacturaElectronicaMC` (biblioteca, net9.0) | Constructores de DTE por normativa (`Builders/`), modelos, acceso a DBF por OLE DB (`DataAccess.cs`), envío/auth/invalidación (`DataProcess.cs`), historial SQLite (`SqliteDataAccess.cs`), PDFs (QuestPDF), correo (MailKit), evento de contingencia (`ContingenciaBuilder.cs`) | Corazón de la solución [V] |
| `FacturaElectronica.WPF` (net9.0-windows, **x86**, WinExe) | Cliente de escritorio: ciclo de envío en segundo plano, pantallas Documentos / Configuración / Estadísticas / Errores / diseño de PDF / Laboratorio de pruebas, telemetría, auto-actualización (Velopack) | x86 por el proveedor de datos FoxPro de 32 bits [I] |
| `FacturaElectronicaMC.Firmador` | Firmador JWS RS512 en C# (conversión del firmador Java oficial), en proceso; sustituyó al contenedor Docker (v1.0.46) | `dte-firmador/` conserva los servicios antiguos (Docker / servicio Windows) [V] |
| `FirmadorTool`, `ContingenciaTool` | Utilidades de consola; la de contingencia **solo sirve para las pruebas del MH** (UUID inventados), no reporta documentos reales | [V] |
| `FacturaElectronica.Client` (WinForms) | Cliente anterior; sigue en la solución y en CI; hay migrador de su configuración al cliente WPF | Legado |
| `Monitor` (ASP.NET + SQLite, Docker en un VPS propio) | Recibe el «ping» de cada instalación (versión, normativa, ambiente, fallos, desincronizados, lectura del DBF); alertas por Telegram; copia diaria en JSON | No está en el `.sln` [V `Monitor/README.md`] |
| `DevHarness`, `TestSupport`, `*.Tests` | Verificación manual de PDFs; fixtures; pruebas | |
| `schemas/` | Esquemas JSON oficiales empaquetados: `normativa-v1/` y `normativa-v2/` (ver business-rules §3) | |
| `profiles/clasico.json`, `unificado.json` | **Perfiles de diseño de PDF**, no configuración por cliente | [V `profiles/README.md`] |

**Dónde corre:** una instalación de escritorio Windows **por cliente (por empresa)**, en una máquina que ve la carpeta con los
DBF del ERP y la carpeta de salida de PDF (`DBFPath`, `PDFPath`) [V `Models/AppSettings.cs`]. Es un programa de usuario, no un
servicio de Windows: si nadie lo abre o la sesión se cierra, **no se factura** [I].
**Configuración por cliente:** `settings.json` en `%AppData%\FacturaElectronicaMC` (fuera de la carpeta de instalación), más
`pdfprofile.json`, `telemetry.json` y un identificador de instalación; contiene los secretos (contraseñas de API, de llave
privada y de correo) **en texto plano** (hallazgo de auditoría abierto) [V `FABLE-AUDIT.md` §2.12]. El certificado de firma es un
archivo cuya ruta se configura. **Actualización:** Velopack contra un feed HTTP propio; al abrir y con botón manual [V
`docs/AUTO-UPDATE.md`]. **Cantidad de instalaciones:** la documentación no da un número; el Monitor lo sabe (pendiente: pedirlo).

## 3. El contrato con el ERP, en resumen

(Detalle campo por campo en [business-rules.md §1–2](business-rules.md) y [data-model.md](data-model.md).)

1. El ERP deja **una fila por línea del documento** en `FELECTRO` (y **una por solicitud** en `FANULAR`) con `PROCESADO = .F./0` y `FALLO` vacío/0.
2. El programa lee `PROCESADO = 0 AND FALLO = 0` (`select *`, sin orden), **agrupa por (`NFACT_ENV`,`TIPODOC`)** y solo envía el documento si
   el número de filas coincide con `NLINEAS`.
3. **Escribe de vuelta únicamente cinco campos**: `PROCESADO`, `FALLO`, `NCONTROL`, `CODGENERAC`, `SELLORE`, con
   `UPDATE … WHERE NFACT_ENV = ? AND TIPODTE = ?` (todas las líneas a la vez). En `FANULAR` igual, con el sello **del evento**.
4. No escribe `FHPROCESAM`, `NUMVALIDAC`, `INVALIDADA` ni `AMBIENTE`; no escribe el motivo de un rechazo (queda solo en su SQLite).
5. Deja en `PDFPath` `<codigoGeneracion>.json|.pdf|.png` y `…-INVALIDACION.json|.pdf`: por eso el ERP encuentra el PDF por código de generación.
6. Número de control: **lo calcula el programa** a partir de tipo + establecimiento/punto de venta (de su configuración, no del ERP) + los
   últimos 8 caracteres del número de documento del ERP. Código de generación: **UUID nuevo en cada intento**.

**Supuestos de inv64 confirmados / corregidos:** ver la lista «Resuelto» al inicio de [open-questions.md](open-questions.md). Resumen:
confirmado que es un programa externo, por lotes, que sondea el DBF, y que genera PDF/QR/correo; confirmado que escribe `NCONTROL`, `CODGENERAC`,
`SELLORE`, `PROCESADO`, `FALLO`. **Distinto:** `AMBIENTE` del DBF se ignora (el ambiente es un ajuste de la instalación); `TIPOCONTIN/MOTIVOCONT/TIPOMODELO/TIPOOPERAC` también se
ignoran (fijos); la llave de escritura es `NFACT_ENV + TIPODTE` (no `TIPODOC`); `INVALIDADA` nunca se escribe; no hay contingencia productiva.

## 4. Tipos de documento

01, 03, 05, 06, 11, 14 y la invalidación están implementados. Con la «normativa v1» la versión del esquema la dicta la columna `VERSION` del DBF (1 ó 3
según inv64); con la «v2» es fija por tipo. 04 (remisión) existe solo en el camino v1; 07/08/09/15 tienen esquema empaquetado pero **no tienen constructor**.
Tabla completa en [business-rules.md §3](business-rules.md).

## 5. Qué significa para la migración (PROPUESTA, no decisión)

Contexto: la fecha de v2 (2026-12-01 según el repo) está a semanas; **no tocar el camino de producción de los clientes con ERP viejo**.

| Opción | Cómo | A favor | En contra |
|---|---|---|---|
| (a) Solución sin cambios; `sales` escribe el mismo staging DBF | Un escritor de DBF (130+ columnas, una fila por línea) desde Node | Cero cambios en el .NET | Escribir DBF VFP desde una plataforma que corre en el servidor (puede no ser Windows), bloqueos de archivo, perpetúa el contrato de «una fila por línea con 130 campos repetidos» |
| (b) La solución lee de la nueva plataforma (API o tabla SQLite) en vez de DBF | Una fuente alternativa que entrega las **mismas columnas** (los constructores trabajan sobre `DataRow` con nombres de columna) y un write-back por API | Cambio acotado (capa `DataAccess`); se reutiliza firma, auth, PDF, correo, monitor, telemetría; el contrato de columnas se vuelve explícito y versionado | Hay que tocar un repo en pleno cambio de normativa; sigue siendo un cliente de escritorio por cliente |
| (c) Llamar a la biblioteca desde la plataforma | Proceso lateral .NET invocado por la API | Reutiliza toda la lógica | Mezcla de runtimes en un servidor LAN; la biblioteca es estática, con singletons de log y rutas de archivo (hallazgo de auditoría) |
| (d) Portar a TypeScript (módulo `dte` con `DteProvider`) | Reimplementar constructores (sobre todo copia de campos + supresión por tipo + pocas reglas v2), firma JWS RS512, auth, esquemas con validación previa | Una sola pila; validación contra esquema **antes** de firmar; estado en SQLite de la plataforma | La más grande; hay que replicar reglas finas aprendidas en producción |

**Ruta recomendada (por etapas):**
1. **Hoy–2027-01:** solución sin cambios para clientes con ERP viejo. En paralelo, congelar el contrato y capturar JSON dorados de cada tipo (el repo ya tiene fixtures `SampleDtes`).
2. **Convivencia (primeros clientes en la plataforma nueva): (b)** — `sales`/`tax` publican en una tabla `dte_outbox` con **los mismos nombres de columna** que `FELECTRO`/`FANULAR`; la solución .NET gana una fuente alternativa (por instalación, con bandera) que lee y escribe resultados por API. Así ambos mundos usan el mismo firmador, PDF y monitor, sin doble implementación fiscal.
3. **Destino: (d)** módulo `dte` propio, usando los JSON dorados y los casos de rechazo del changelog como suite de aceptación; retirar el escritorio cuando migre el último cliente.

**Debe permanecer estable mientras convivan ERP viejo y plataforma nueva:** nombres y semántica de columnas de `FELECTRO`/`FANULAR`; regla de número de control (y que **nunca se reutilicen** números ya aceptados por el MH);
llave de enlace `NFACT_ENV + TIPODTE`; nombre de archivos por código de generación; el ajuste `Normativa`/ambiente por instalación; formato de códigos de establecimiento/punto de venta.
**Datos DTE a migrar a la plataforma:** histórico de documentos emitidos (número de control, código de generación, sello, fecha, totales, estado, JSON enviado y respuesta del MH desde `EnviosDTE`), invalidaciones con su sello, y los PDF/JSON/PNG por código de generación (archivos, no BD). Detalle en [data-model.md §5](data-model.md).
Credenciales y certificado **no se migran como datos**: se cargan al almacén de secretos por el operador.

## 6. Riesgos principales

Detalle y estado en [business-rules.md §8](business-rules.md): (1) la escritura del historial SQLite traga excepciones, de modo que un DTE puede salir sin registro local; (2) un intento aceptado por el MH cuyo write-back al DBF falla deja
el documento «Desincronizado» (recuperable a mano con «Sincronizar DBF»), y un reintento tras un error de red usa un **código de generación nuevo con el mismo número de control**; (3) token de autenticación por documento, sin caché; (4) el QR se codifica con un salto de línea dentro de la URL;
(5) contraseñas en texto plano en `settings.json`; (6) sin contingencia productiva; (7) el contrato depende de un DBF compartido sin transacciones y con lecturas `select *` completas cada ciclo; (8) la fecha de cambio a normativa v2.

## 7. Qué leí y qué no

**Leí:** `CHANGELOG.md` (raíz y WPF), `TESTING.md`, `FABLE-AUDIT.md`, `docs/hacienda-audit*.md`, `docs/AUTO-UPDATE.md`, `Monitor/README.md`; `DataAccess.cs`, `DataProcess.cs` (casi completo),
`Builders/DteBuilderV2.cs` (parte central), `Helpers/DbfFieldMap.cs`, `Constants/NumeroControlRules.cs`, `SqliteDataAccess.cs`, `Models/AppSettings.cs`,
`DteProcessingService.cs`, `ProcessingBackgroundService.cs`, `EmailService.cs`, parte de `DocumentQueryService.cs`, `ContingenciaTool/Program.cs`, README del firmador, y la **estructura** (nombres/tipos y conteos agregados de estado) de `DBF/felectro.DBF` y `DBF/FANULAR.DBF`.
**No leí (pendiente):** `GetDteBodyFromRowV1` en detalle (tributos por línea), plantillas de PDF (QuestPDF), internos del firmador, telemetría/Monitor más allá del README, Estadísticas, Laboratorio,
los PRD de `tasks/`, `scripts/`, CI, `dte-firmador/`, y ningún archivo de configuración real, certificado, SQLite con datos ni log. No se ejecutó nada.
**No se pudo determinar:** número de instalaciones, versión del ERP/DBF en producción de cada cliente (la muestra del repo es más corta que la de inv64), 
