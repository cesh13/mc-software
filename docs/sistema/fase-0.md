# Fase 0: cimientos — diseño cerrado y plan de construcción

Fecha: 2026-11-13. Documento de trabajo para **construir** la fase 0. El *qué* ya está escrito en
[contratos.md](contratos.md) (§0–§2, §7, §8) y en [modulos-y-orden.md](modulos-y-orden.md) (§1.1, §2, §4); aquí se
decide lo que esos documentos dejaban abierto, se clasifica lo que la verificación del spec de Contabilidad cambia en lo
ya construido y se ordena el trabajo en pasos con su criterio de terminado.

> **Estado:** propuesta del equipo, sin revisar con el negocio. Cada decisión dice qué pregunta de
> [PREGUNTAS.md](../legacy/PREGUNTAS.md) la confirma y qué pasa si la respuesta es otra. Ninguna de esas respuestas
> obliga a rehacer el diseño: solo cambian datos (paquetes por rol, valores por omisión).

## Estado de la construcción (2026-11-15)

Construidos los pasos 1 a 7 y 9, y parte del 8, en `master`; 133 pruebas pasan. Opus construyó los pasos 1, 3–6 y
coordinó; Sonnet hizo los pasos 2 y 7 y las correcciones del importador; Opus hizo `parties` (paso 9), en paralelo.

| Paso | Estado |
|---|---|
| 1. Permisos por acción | Hecho: catálogo, paquetes, `core_permission_overrides`, todas las rutas (GET incluidas), `/api/permissions` |
| 2. Permisos en la web | Hecho: menú, botones, pantalla bloqueada por URL, diálogo "Permisos" en Usuarios. Visto en navegador |
| 3. Servicios y activación | Hecho: `provides`/`consumes`, registro por empresa, `core_empresa_modules`, `/api/empresa-modules` |
| 4. Períodos | Hecho: contrato `periods`, `core_periods`; `gl_periods` migrada y eliminada; motivo obligatorio al reabrir (API y web) |
| 5. Configuración y correlativos | Hecho: contratos `settings` (con vigencia) y `sequences`; `/api/empresa-settings`. Falta la pantalla de configuración y el modo advertir/exigir al cerrar (no hay subledgers aún) |
| 6. Contrato de contabilización | Hecho: servicio `ledger` (post, replace, void con reverso, find, preview) con las pruebas de reversión e idempotencia |
| 7. Ficha de empresa y bitácora | Hecho: `core_empresa_profile`, `/api/empresa-profile`, `/api/audit` (+ CSV), pantallas. Bitácora vista en navegador |
| 8. Importador y paridad | Casi: estado de mes por la primera partida, `includeClosing`, paridad por causa, `legacy_ref`, `reattributeEntries` (en `tools/legacy-import/src/common`). **Falta:** importar `USUARIOS`/`USREMP`/`PERFIL`; necesita decidir cómo reciben su clave los usuarios importados (no hay restablecimiento por correo) |
| 9. `parties` | Hecho: módulo, lookup como servicio, importador desde siete tablas (5,103 filas → 3,054 terceros) |

Diferencias con lo escrito arriba, decididas al construir:

- **Los servicios se ligan al contexto, no reciben `tx` en cada método:** `services.require('ledger', ctx)` con el
  contexto de la transacción del consumidor. Mismo efecto que contratos §0.2, firma más corta.
- **Reverso:** su `sourceRef` es `<ref>:reverso`, sin número. Un documento reversado no se vuelve a contabilizar con la
  misma referencia (se emite otro documento), así que no hace falta numerarlo (F4.3 queda así).
- **El número explícito no existe en el contrato:** solo el importador escribe números (F4.2).
- **Balance de comprobación:** incluye la partida de cierre por omisión, como antes y como el legado;
  `includeClosing=false` la quita. Solo el Estado de Resultados la excluye por omisión.
- **`core.empresas.manage`** quedó en el paquete `supervise` para no cambiar lo que el Supervisor ya podía hacer.
- **Limitación conocida:** si a un usuario se le niega `coa.account.view`, la pantalla de partidas no carga las cuentas
  (la captura las necesita). Con los paquetes por omisión no pasa. Si el negocio quiere ese caso, la captura debe pedir
  un permiso de consulta propio.

---

## 1. Decisiones que cierra este documento

### F1. Permisos: por acción, con la granularidad del permiso por pantalla

**Problema.** La verificación (2026-11-12) mostró que en el legado el control real es `PERFIL` (usuario × pantalla,
global para todas las empresas), no el nivel: un usuario de nivel 4 "Consulta" con permiso en `PERFIL` abre y graba
partidas. La plataforma hoy tiene tres permisos por rol (S1, S2) y **todas las lecturas** de los módulos están abiertas a
cualquier usuario con acceso a la empresa (solo los reportes piden `reports`). Con eso no se puede reproducir "este
usuario no ve el catálogo" ni "este digitador sí puede anular".

**Decisión.** Se adopta el modelo de [modulos-y-orden §2.6](modulos-y-orden.md#26-permisos-por-acción) y se fija su
granularidad para que **cubra lo que hoy hace `PERFIL`** sin portar sus 630 claves:

1. **Catálogo de permisos** `módulo.recurso.acción`, declarado en el manifiesto de cada módulo (`permissions:
   PermissionDef[]` con `id`, `label` en español, `group` para la pantalla, `package`). Acciones estándar: `view`,
   `create`, `update`, `void`, `close`, `reopen`, `export`, `manage` (configuración). Un recurso equivale a "una
   pantalla del legado o un grupo pequeño de ellas" (§2 lista el catálogo inicial de Contabilidad).
2. **`view` es un permiso real.** Cada recurso tiene su `view`; sin él la ruta de lectura responde 403 y el menú no
   muestra la opción. Es lo que hace `PERFIL.PERMISO` hoy.
3. **Paquetes.** Los tres permisos actuales pasan a ser paquetes que agrupan permisos finos: `capture` (ver y capturar:
   `view`, `create`, `update` de los recursos operativos), `reports` (`view` de reportes y `export`), `supervise`
   (`void`, `close`, `reopen`, `manage`, usuarios). Los roles siguen como hoy (S1) y se definen por paquetes. Dos permisos
   sensibles no entran en ningún paquete: `core.costs.view` y `core.salaries.view` (se conceden aparte).
4. **Ajustes por usuario:** tabla `core_permission_overrides(user_id, permission, effect 'grant'|'deny', empresa_id
   NULL, created_by, created_at)`, única `(user_id, permission, empresa_id)`. `empresa_id` nulo = todas las empresas
   (como `PERFIL`, que es global); con valor = solo esa empresa (lo que el legado no podía hacer). Se resuelve en este
   orden: `deny` de la empresa > `grant` de la empresa > `deny` global > `grant` global > paquetes del rol. El
   Propietario no admite `deny` (no puede quedar fuera de su sistema).
5. **Un solo evaluador**, `can(user, permission, empresaId)` en `@accounting/shared` (puro, recibe rol y ajustes ya
   cargados), y un `requirePermission(perm)` que acepta tanto `'gl.entry.void'` como un paquete (`'supervise'`),
   para migrar las rutas sin romperlas. El contexto del módulo carga los ajustes del usuario una vez por petición.
6. **La web** pide `GET /me/permissions?empresa=…` (permisos efectivos) y filtra menú, botones de la barra y pantallas.
   La web nunca decide sola: la API vuelve a comprobar.
7. **Importación de `PERFIL`/`USUARIOS`/`USREMP`** (por módulo, empezando por CONTAC): una tabla de correspondencia
   *clave de pantalla → permisos* por módulo (`tools/legacy-import/src/<módulo>/perfil-map.ts`), escrita cuando se
   construye cada módulo. El importador asigna el rol por `USRLVL` (nivel más alto entre módulos, N1), y crea
   **ajustes solo donde `PERFIL` difiere del rol** (grant o deny). Así se conserva el comportamiento real ("Consulta"
   que graba partidas) sin inventar roles, y el reporte de importación lista cada ajuste para que el negocio lo revise.
   Las claves de usuario no se migran: restablecimiento obligatorio (D1).
8. **Pantalla:** en Usuarios, una pestaña "Permisos" con la lista agrupada por módulo y pantalla, que muestra el
   efectivo (rol + ajuste) y permite conceder o negar por usuario, global o por empresa. Todo cambio va a la bitácora.

*Alternativas descartadas:* (a) tres permisos por rol sin ajustes (S1–S2 actuales): pierde la granularidad que hoy se
usa; (b) portar `PERFIL` tal cual (una fila por pantalla): 630 claves duplicadas, con huecos y sin empresa
(plataforma-compartida §2); (c) roles personalizados creados por el cliente: más trabajo de interfaz y el legado no los
tiene; se puede agregar después sobre el mismo catálogo.

**Qué confirma el negocio (P9, N1, N2, N4):** los paquetes de cada rol (p. ej. si el Digitador ve reportes, quién anula).
Si responden "bastan tres permisos por rol", el modelo queda igual y simplemente no se crean ajustes.

### F2. Alcance por empresa

Se mantiene S3/S19: el Propietario ve todas las empresas; los demás, incluido el Supervisor, solo las asignadas. Un
Supervisor solo asigna empresas que él mismo tiene. *Si el negocio pide que el Supervisor vea todas:* se agrega el
permiso `core.empresas.all` al paquete `supervise` y `seesAllEmpresas` lo consulta; no cambia nada más.

### F3. Activación de módulos por empresa

`core_empresa_modules(empresa_id, module_id, is_enabled, enabled_at, enabled_by)`. Un módulo `alwaysOn` (núcleo,
`chart-of-accounts`, `general-ledger`, `parties`) siempre está activo. El cargador sigue registrando rutas de todos los
módulos instalados y habilitados globalmente; `moduleContext` rechaza con `module_disabled` (403) la petición a un
módulo apagado para la empresa, e inyecta solo los servicios de los módulos activos para ella. Activar un módulo exige
que sus `consumes.required` estén activos; apagarlo exige que ningún activo lo requiera. Permiso `core.modules.manage`
(paquete `supervise`, pero por omisión solo el Propietario lo tiene: es una decisión de instalación).

### F4. Contrato de contabilización: lo que se confirma y lo que se ajusta

El contrato de [contratos §1](contratos.md#1-contabilización-en-el-libro-mayor-ledger) se construye tal cual, con tres
ajustes que salen de la verificación:

1. **`PostLine.collectionDate` se elimina del contrato.** `fcobro` no la usa ningún programa del legado y está vacía. La
   columna `collect_date` de `gl_journal_lines` se queda (la llena el importador si algún cliente la trae) pero ningún
   módulo la publica.
2. **El número explícito (`number`) solo lo acepta el importador.** La única razón del legado para teclear el número era
   evitar el choque con Bancos (`MOVIBAN`), que desaparece porque el GL numera. La contingencia (BANCOC 18) se resuelve
   editando el número de una partida **manual**; las generadas no lo admiten. Si el negocio responde que sí necesita
   digitar el número de la partida de un cheque, se reabre.
3. **El reverso de un `void` en período cerrado** usa como `sourceRef` el del original con sufijo `:reverso:<n>` (no solo
   `:reverso`), para que un documento que se anula, se re-emite y se vuelve a anular en meses cerrados no choque con el
   índice único.

Se confirma lo demás: proveedor síncrono sin `inTx` propio, una partida viva por `(empresa, source, source_ref)`, las
generadas nacen `aplicada`, son de solo lectura en la pantalla de partidas y se corrigen desde el documento dueño (P2).

### F5. Períodos

Se construye [contratos §2](contratos.md#2-estado-de-períodos-periods) con estas precisiones:

- `core_periods` reemplaza a `gl_periods`; la migración copia filas, usuarios y fechas, y deja una vista o nada
  (ninguna otra tabla referencia `gl_periods`).
- `reopen` exige motivo (texto, mínimo 10 caracteres) y deja bitácora. Se guarda el último cierre y la última
  reapertura en la fila; el historial completo queda en la bitácora.
- Cerrar el GL **advierte** si hay áreas que contabilizan y siguen abiertas (M1, modo `advertir`); el modo `exigir` es
  un ajuste de empresa (`settings: core.periodCloseMode`). Mientras no exista ningún subledger, la advertencia nunca sale.
- **Importación:** el legado lee el estado del mes de la **primera partida del mes** (`CERRADO` de esa fila); el
  importador hoy marca cerrado solo si **todas** las partidas lo están (`tools/legacy-import/src/contac/setup.ts`). Se
  corrige para usar la misma regla que el legado y se reportan los meses donde ambas reglas difieren.

### F6. Configuración, correlativos, ficha de empresa y bitácora

Sin cambios respecto a [contratos §8](contratos.md#8-configuración-y-correlativos) y
[modulos-y-orden §1.1](modulos-y-orden.md#11-plataforma-núcleo-appsapi--accountingshared--no-es-un-módulo). En la fase 0
solo se construye el mecanismo y las claves del núcleo y de Contabilidad; las claves de cada módulo llegan con él. La
consulta de bitácora (`GET /audit`, pantalla en Administración, permiso `core.audit.view` del paquete `supervise`) entra
en esta fase porque el cambio de permisos debe poder auditarse.

### F7. `parties`

Maestro único de terceros con identificadores fiscales (NIT, NRC, DUI, pasaporte, extranjero), roles (`customer`,
`supplier`) y contacto. Importa `PROVEDOR` (dos copias), `CCCLI01`, `CONTRIBU` y `CLIENTES` con el reporte de cruces por
NRC/NIT; **unifica** cliente y proveedor con el mismo NRC (M3) y lista cada unión para revisión. Los atributos operativos
(límite de crédito, plazo, vendedor, cuenta) **no** van aquí: los agregan `accounts-receivable` y `accounts-payable`.

---

## 2. Catálogo inicial de permisos (núcleo y Contabilidad)

Equivale a las opciones de menú de CONTAC con control en `PERFIL`. Paquete = el que lo incluye por omisión.

| Permiso | Pantalla / acción | Paquete |
|---|---|---|
| `coa.account.view` | Catálogo de cuentas (consultar) | capture, reports |
| `coa.account.create`, `coa.account.update` | Agregar y modificar cuentas | capture |
| `coa.account.deactivate` | Desactivar y reactivar cuentas | supervise |
| `coa.budget_group.view` / `.manage` | Agrupaciones de presupuesto | reports / supervise |
| `coa.integrity.view` | Revisión del catálogo | reports |
| `gl.entry.view` | Elaboración de partidas (consultar) | capture, reports |
| `gl.entry.create`, `gl.entry.update` | Agregar y modificar partidas, copiar | capture |
| `gl.entry.apply` | Aplicar un borrador | capture |
| `gl.entry.unapply` | Regresar a borrador una aplicada | supervise |
| `gl.entry.void` | Anular partida | capture *(como hoy; P8 propone supervise)* |
| `gl.entry_type.view` / `.manage` | Tipos de partida | capture / supervise |
| `gl.cost_center.view` / `.manage` | Centros de costo | capture / supervise |
| `gl.fiscal_year.manage` | Años fiscales | supervise |
| `gl.period.view` | Estado de meses | capture, reports |
| `gl.period.close`, `gl.period.reopen` | Cerrar y abrir mes | supervise |
| `gl.annual_close.run` | Cierre anual | supervise |
| `gl.report.view` | Los 6 reportes (balance, mayor, diario, estados) | reports |
| `gl.report.export` | Imprimir y exportar | reports |
| `core.users.manage` | Usuarios, roles, empresas y permisos | supervise |
| `core.empresas.manage` | Empresas y ficha fiscal | supervise *(por omisión solo Propietario)* |
| `core.modules.manage` | Activar módulos por empresa | *(solo Propietario)* |
| `core.settings.manage` | Configuración por empresa | supervise |
| `core.audit.view` | Bitácora | supervise |
| `core.costs.view`, `core.salaries.view` | Ver costos / sueldos | *(ninguno)* |

Esto **no cambia el comportamiento actual** de ningún rol salvo en un punto: hoy cualquier usuario con acceso a la
empresa puede leer partidas y catálogo por la API; con `view` el Digitador sin `reports` sigue viendo partidas y
catálogo (los trae `capture`), y un usuario sin ningún paquete ya no ve nada. Las pruebas de rol actuales deben seguir
pasando sin cambios.

---

## 3. Lo que la verificación cambia en lo ya construido

Clasificación de cada hallazgo de [REPORTE.md](../legacy/REPORTE.md#verificación-del-spec-de-contabilidad-2026-11-12)
y de `contac/business-rules.md` frente al código de `modules/` y `tools/legacy-import/`.

| Hallazgo | Efecto en lo construido | Acción |
|---|---|---|
| El control real es `PERFIL` por pantalla | S1/S2 pierden granularidad; lecturas abiertas | **Cambiar en fase 0** (F1, paso 1) |
| `SALDOS` solo actualiza el mes de trabajo; cuatro rutinas que contabilizan distinto | La paridad contra `SALDOS` nunca cuadrará limpio; nada que cambiar en el cálculo (se calcula desde líneas) | **Cambiar la paridad:** el reporte de paridad deja de tratar `SALDOS` como referencia y clasifica cada diferencia (arrastre, mes sin partidas, rutina que no toca saldos). Referencia = reportes impresos + cálculo propio. Paso 8 |
| Los reportes del legado leen `SALDOS` | Los impresos pueden traer el mismo desfase | Al comparar contra impresos, **correr antes "Posteo del Mes" en el legado** (o pedir impresos después del posteo). Va en la lista de lo que se pide al negocio |
| El legado **no excluye** la partida de cierre | El Estado de Resultados de diciembre no coincide con el impreso en años con cierre | **Mantener la exclusión** (decisión CONTAC 4). Agregar `includeClosing` (por omisión `false`) a la consulta del Estado de Resultados y del Balance de Comprobación, para paridad. Paso 8 |
| Estado del mes = primera partida del mes | El importador usa "todas cerradas" | **Corregir el importador** (F5). Paso 8 |
| Mes cerrado solo lo respeta la captura en el legado | La plataforma lo exige en todo: más estricto | **Mantener.** El importador no valida meses cerrados (escribe SQL directo), así que el historial entra igual |
| `fcobro` no se usa | Columna `collect_date` y campo en la API sin uso | **Quitar del contrato** (F4); dejar la columna. No tocar pantallas (ya no la muestran) |
| `PERIODO` no es año fiscal | S18 ya no depende de esa tabla | **Sin cambio** |
| No hay consolidación en el legado | `core_empresas.consolida_en_id` existe sin uso | **Sin cambio**; consolidación queda como función nueva, fuera de la fase 0 |
| Numeración: 7 dígitos solo si se teclea `CP`; choque con `MOVIBAN` al teclear | `numberWidth` por tipo ya cubre el caso | **Sin cambio.** El choque desaparece porque el GL numera (F4.2) |
| Cambio de código de cuenta sin bitácora; captura sin bitácora | La plataforma no permite cambiar el código (S7) y audita todo | **Sin cambio** |
| Eliminar cuenta: el legado pregunta y deja continuar con saldos | La plataforma desactiva y rechaza con movimientos (S9) | **Sin cambio**; ya es más estricto |
| Línea con cargo y abono: el legado la descarta en silencio | Importador: 26 líneas así | **Sin cambio**; ya se importan y reportan |
| Copiar partida trata la clase 6 como acreedora | No aplica: saldos calculados desde líneas por tipo de cuenta | **Sin cambio**; explica parte de las diferencias de `SALDOS` |

Conclusión: **ningún hallazgo obliga a rehacer módulos construidos.** Hay tres ajustes pequeños (importador de períodos,
`includeClosing`, reporte de paridad) y uno grande que ya era parte de la fase 0 (permisos).

---

## 4. Plan de construcción

Cada paso es una entrega independiente con sus pruebas, en `master`, en el orden indicado. Lo construye Opus desde este
documento y de `contratos.md`; lo verifica un modelo distinto (Sonnet) antes de pasar al siguiente. Regla de todos los
pasos: las 81 pruebas actuales siguen pasando y la importación de CONTAC sigue cuadrando los 18,570 saldos.

| # | Paso | Contenido | Depende de | Terminado cuando |
|---|---|---|---|---|
| 1 | **Permisos por acción** | `roles.ts`: catálogo, paquetes, evaluador `can(user, perm, empresaId, overrides)`; `core_permission_overrides` y su migración; `ModuleManifest.permissions: PermissionDef[]`; `requirePermission` acepta permiso fino o paquete; carga de ajustes en `moduleContext`; migrar todas las rutas de `chart-of-accounts` y `general-ledger` al catálogo de §2, **incluidas las GET**; `GET /me/permissions`; API de ajustes en `routes/users.ts` | — | Pruebas por rol sin cambios; pruebas nuevas: `deny` gana a paquete, `grant` por empresa no se filtra a otra, Propietario sin `deny`, cada ruta tiene permiso (prueba que recorre el router y falla si alguna no lo declara) |
| 2 | **Permisos en la web** | Menú, barra de íconos y pantallas filtrados por `/me/permissions`; pestaña "Permisos" en Usuarios | 1 | La pantalla de usuarios abre en navegador (hoy sin probar); un usuario con `deny` de `gl.entry.view` no ve la opción y la API responde 403 |
| 3 | **Registro de servicios y activación por empresa** | `ModuleManifest` + `provides`, `consumes`, `settingsSchema`, `optionalPerEmpresa`; `core_empresa_modules`; registro en `module-loader.ts`; `services` en `ModuleEnv` filtrado por empresa; `module_disabled`; ruta y pantalla para activar | 1 | Prueba con dos módulos de prueba (proveedor y consumidor falsos en `apps/api/src/testing`): requerido ausente impide activar; opcional ausente da `null`; ruta de módulo apagado responde 403 |
| 4 | **Períodos compartidos** | `core_periods` + contrato `periods`; migración de `gl_periods`; `services/periods.ts` del GL delega en el contrato; motivo al reabrir (API y pantalla); modo advertir/exigir | 3 | Pruebas actuales de cierre pasan; reabrir sin motivo falla; los meses importados conservan su estado tras la migración |
| 5 | **Configuración y correlativos** | `core_empresa_settings` (vigencia por fecha) y `core_sequences` con sus contratos; validación de claves por el `settingsSchema` del manifiesto; claves iniciales del núcleo (`core.periodCloseMode`) | 3 | `get` a una fecha devuelve la versión vigente; `next` dentro de una transacción que falla no consume número; `SERIE_AGOTADA` fuera de rango |
| 6 | **Contrato de contabilización** | Todo [contratos §1.8](contratos.md#18-cambios-en-el-gl-actual-verificados-contra-el-código) con los ajustes de F4: orígenes nuevos, columnas `reverses_entry_id`, `legacy_ref`, `origin_confidence`, índice único parcial, `insertEntry`/`replaceEntryLines` sin transacción, `ledger-provider.ts`, `ledger-void.ts`, bloqueo de edición y anulación de generadas en la pantalla | 3, 4 | Las cuatro pruebas de [contratos §0.5](contratos.md#05-pruebas) con un módulo consumidor falso: proveedor, consumidor real, **reversión** (error después de `post` ⇒ nada escrito, número no consumido) e **idempotencia**; `void` en mes cerrado crea reverso en el mes abierto; `replace` en el lugar conserva id y número |
| 7 | **Ficha de empresa y bitácora** | `core_empresa_profile` (pantalla en Empresas); `GET /audit` con filtros y pantalla en Administración | 1 | Pantallas abren en navegador; cada cambio de permisos (paso 1) aparece en la bitácora |
| 8 | **Ajustes del importador y la paridad** | `legacy_ref` en `contac/entries.ts`; estado de mes por primera partida (F5); `includeClosing` en reportes; reporte de paridad que clasifica diferencias contra `SALDOS`; `reattributeEntries` como función común (sin usos aún); importación de `USUARIOS`/`USREMP`/`PERFIL` de CONTAC con su `perfil-map.ts` | 1, 4, 6 | Reimportar CONTAC: mismos 619 / 5,220 / 48,024, mismos 18,570 saldos; el reporte lista los meses donde cambió el estado de cierre y los ajustes de permisos creados |
| 9 | **`parties`** | Módulo nuevo (`pty_`): schema, API, lookup `parties`, pantalla de terceros; importador desde las cinco fuentes con reporte de cruces | 1, 3 | Importa las copias en disco y reporta uniones por NRC; el lookup funciona desde un módulo de prueba |

Los pasos 4 y 5 pueden ir en paralelo (archivos distintos); 7 y 9 también, una vez hecho el 3. El resto es secuencial.
Tamaño estimado: 1–2 son el bloque más grande por la cantidad de rutas y pantallas que tocan; 6 es el más delicado.

**Al terminar la fase 0:** actualizar `module-guide.md` (cómo declarar permisos, servicios y ajustes en un módulo nuevo),
las secciones de [REPORTE.md](../legacy/REPORTE.md) y los supuestos S1–S2 (reemplazados por F1), y publicar una versión
con `ship-mc-update` para probar la migración de permisos y períodos sobre la instalación real.

---

## 5. Preguntas que afectan la fase 0 y valor con el que se avanza

| Pregunta | Se avanza con | Si la respuesta es otra |
|---|---|---|
| P9, N4 — ¿permisos por pantalla o por rol? | Por acción con ajustes por usuario (F1) | Nada que rehacer: se dejan sin ajustes |
| P9 — ¿el Digitador ve reportes? ¿quién anula? | Como hoy (Digitador sin `reports`; anular en `capture`) | Cambiar los paquetes en `roles.ts` |
| N1 — usuarios con niveles distintos por módulo | Nivel más alto como rol; diferencias como ajustes | Ajustar a mano tras importar |
| N2 — `USRTYPE`, `VE_COSTO`, niveles de planilla | `VE_COSTO` ⇒ `core.costs.view`; el resto al construir cada módulo | — |
| P7, M1 — quién reabre; ¿cerrar GL exige subledgers? | `supervise` con motivo; advertir | Cambiar el valor por omisión del ajuste |
| P2 — generadas de solo lectura | Sí (F4) | Si hay ediciones legítimas: ajuste manual aparte, no edición de la generada |
| M3 — unificar cliente y proveedor por NRC | Sí, con reporte | Importar separados y unir a mano |
| ¿Supervisor ve todas las empresas? (decisión pendiente de Cesar) | No (F2) | Agregar `core.empresas.all` a `supervise` |

Fuera de la fase 0 y aún pendientes de Cesar: cuándo se contabiliza la venta (fase 4) y cómo lee la llave el servicio
de Windows (instalación en cliente).
