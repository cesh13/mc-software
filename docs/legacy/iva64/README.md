# IVA64 — Libros de IVA (legacy spec)

Extraído del sistema MCERP (Visual FoxPro 9), carpeta `MCERP/IVA64`.
Proyecto vivo: `iva.pjx` (218 entradas; es el único proyecto de la carpeta). Menú principal: `IVAMENU.MPR`
(generado de `IVAMENU.MNX`). Ejecutable: `iva64.exe`.
Target en la nueva plataforma: módulo nuevo `tax` (IVA y retenciones de renta).

Documentos:

- [business-rules.md](business-rules.md) — reglas de negocio extraídas del código
- [data-model.md](data-model.md) — tablas legadas, modelo propuesto (`tax_`) y notas de migración
- [open-questions.md](open-questions.md) — decisiones pendientes para el negocio

> Este spec describe *qué hace* el sistema, no copia el código. No contiene datos de clientes
> (solo estructura, conteos de registros, textos de menú y lógica). No transcribe la ley tributaria:
> describe lo que hace el código y marca dónde conviene verificarlo contra la norma vigente.
> **Marca:** lo no marcado se verificó en el código fuente o en la estructura de las tablas.
> Lo que es deducción lleva la etiqueta *(inferido)*.

## 1. Qué hace el módulo

IVA64 es una aplicación **independiente** (su propio menú, login y ejecutable) que lleva los **libros legales de IVA**
y los archivos para Hacienda de **una empresa**:

1. **Libro de compras** (`COMPRAS`): documentos de proveedores (crédito fiscal, notas de crédito/débito, importaciones,
   retenciones y percepciones), con una variante de **compras a sujetos excluidos** en la misma tabla.
2. **Libro de ventas a contribuyentes** (crédito fiscal, `IVAFIS`): un renglón por documento (CCF, notas de crédito/débito).
3. **Libro de ventas a consumidor final** (`ivafac`): **resumen diario por rangos de documentos**, no un renglón por factura.
4. **Retenciones de renta** (`RENTAT`): comprobantes de renta retenida con base, monto y código de ingreso (muy poco usado:
   3 registros).
5. **Reportes y archivos para Hacienda**: libros impresos (por mes, por proveedor/cliente, anuales), y archivos de
   anexos (compras, crédito fiscal, consumidor final, excluidos, retención/percepción de IVA 1 %, renta anual) en Excel,
   además de los formatos viejos F987, F930 y F910 y el "COA" en texto de ancho fijo.
6. **Cierre mensual** que marca los renglones del mes como cerrados (y "Abrir mes cerrado").

**No hace** (verificado: no existe en el código): no contabiliza (no escribe en `PARTIDAS`, `DETAPART` ni `SALDOS`), no calcula
la liquidación del IVA (débito − crédito) ni genera la declaración mensual (no hay F07 ni resumen de pago); no emite, firma ni
transmite documentos tributarios electrónicos (solo **lee** el JSON de uno y copia sus identificadores); no maneja inventario ni
cuentas por cobrar/pagar (sus datos llegan por "transferencia" desde esos módulos).

### De dónde llegan los documentos

| Libro | Vías de entrada (todas verificadas en código) | Vía real en la copia de datos |
|---|---|---|
| Compras | (a) captura manual (`ivacomp2`); (b) **lectura de un JSON de DTE** (solo tipo `03`); (c) **"Ingresar al IVA"** desde Bancos/CONTAC, que abre la misma pantalla `ivacomp2` y escribe en esta tabla; (d) **Transferir desde Cuentas por Pagar** (`QUEDAN`/`NCREDEB`); (e) **Transferir desde Inventarios** (`DATAMOV`); (f) carga de un **CSV** ("Subir Libros de IVA") | Ninguna fila trae la marca `TRANSF`: se capturó a mano, por JSON/Bancos o por CSV (no se puede distinguir; *inferido*) |
| Ventas crédito fiscal | (a) captura manual (`ivamfis2`); (b) lectura de JSON de DTE (tipo `03`); (c) **Transferir desde CxC** (`CCMOV01`); (d) CSV | 99.9 % transferidas desde CxC (47,461 de 47,516) |
| Ventas consumidor final | (a) captura manual (`ivamfac2`); (b) **Transferir desde CxC** (`CCMOV01`, agrupa por día); (c) CSV | 96 % transferidas (772 de 802) |
| Renta | captura manual (`ivarenta`) o "Ingresar Renta" desde Bancos/CxP | 3 registros |

Las rutas de los otros módulos salen de `EMPRESAS`: `INTEGRA` (datos de CxC, `cxc64`), `INTEGRAP` (datos de compras: CONTAC/Bancos-CxP) y
`RUTAINV` (inventario, `INV64`, donde vive `FELECTRO`, la tabla de DTE emitidos). Ver [business-rules.md](business-rules.md) §2 y §14.

## 2. Dónde están realmente las tablas

`EMPRESAS.CAMINO` de la empresa de IVA64 apunta a **`MCERP/IVA64/dbf`**, y ahí viven las tablas propias del módulo
(`COMPRAS`, `IVAFIS`, `ivafac`, `CONTRIBU`, `CLIENTES`, `RENTAT`, `RENTA`, catálogos geográficos). A diferencia de BANCOC (cuyas
tablas están en la carpeta de CONTAC), **IVA64 sí tiene su propio `dbf/`**. Además:

- `MCERP/IVA64/fuente` guarda tablas de sistema (`EMPRESAS`, `USUARIOS`, `PERFIL`, `USREMP`, `BITACORA`, `MSGERR`, `ARCHIVOS`),
  el catálogo `CCTMOV` (tipos de movimiento) y tablas de trabajo viejas (`LIBROCF`, `LIBROVE`, `IVAVENC`, `FACTURA`, `IVA`).
- `CONTAC.EMPRESAS.CAMINOIVA` y `BANCOC.EMPRESAS.IVA` apuntan a `MCERP/iva64/DBF`: es así como "Ingresar al IVA" y "Ingresar Renta"
  de Bancos/CONTAC terminan escribiendo en `COMPRAS` y `RENTAT` de esta carpeta.
  **Corrección al spec de BANCOC:** allí se dijo que "Ingresar al IVA" escribe en `LIBCOMP`. `CONTAC/dbf/LIBCOMP` existe pero tiene
  **0 registros** (estructura de una versión anterior; `OFCOMPRA.PRG` es lo único que la usa). Ver [open-questions.md](open-questions.md) #3.
- Las tablas de otros módulos que IVA64 **lee**: `CCMOV01`, `CCCLI01` (cxc64/DBF), `FELECTRO` y `DATAMOV` (INV64/DBF),
  `QUEDAN`, `NCREDEB`, `PROVEDOR` (CONTAC/dbf). Detalle en [data-model.md](data-model.md).

## 3. Proyecto vivo

`iva.pjx` es el único proyecto (no hay copias vacías). Su tabla de proyecto tiene **218 entradas**:

| Tipo | En el proyecto | Notas |
|---|---|---|
| Formularios `.scx` | **63** | 12 más en disco están fuera del proyecto (código muerto: `ccmcli01`, `ccmmov01`, `cnper2`, `cosubpar`, `ctppal`, `empresas`, `intro2`, `ivamemp1`, `ivamuni`, `pantalla`, `sbmuni02`, `tranivac`) |
| `.spr` generados / stubs | 53 | Los forms convertidos solo llaman `DO FORM` |
| Programas `.prg` | **34** | Casi todos utilitarios (`ventana`, `proteger`, `valibot`, `vertodo`, `ultimo`, `enletra`, `pasa`, …); 11 más en disco fuera del proyecto |
| Reportes `.frx` | **26** | 14 más en disco fuera del proyecto. Excepción: `ivaren` llama a `ivarend.frx` (la variante texto de "Renta Acumulada") que **no está en el proyecto** |
| Menú | 1 (`ivamenu.mnx`) | `ctmenu.mnx` en disco es de CONTAC |
| Imágenes / íconos | 38 + 1 icono + `foxypreviewer.app` | |
| Cabecera del proyecto | 1 | |

Las tablas de datos **no** están en el proyecto (es lo normal en este sistema). Del folder `fuente` (654 archivos) el resto son compilados
`.FXP`/`.SPX`, respaldos `.BAK`, `.ERR`, el `.xlsx` de plantilla de compras (`plantillacompras.xlsx`) y archivos `.MEM` de sesión por usuario (`B01.MEM`…).

## 4. Mapa de menú → funcionalidad

El menú tiene **48 opciones con acción** en 4 popups. Cada opción llama primero a `nomoros()` y luego revisa `PERFIL` por usuario
y clave de programa (`SEEK(USRV+VARP)`; si `permiso` es falso: "Lo siento no tiene Acceso a esta opción").
Las excepciones están marcadas. Las cuatro transferencias además exigen que la empresa tenga ruta de integración (`camino2` o `camino3`);
si no, muestran "Opcion no disponible".

Columna **Destino**: ✅ migrar · 🔁 migrar rediseñado · ❌ no migrar. Pantallas nuevas dentro de `tax` salvo que se diga otro módulo.

### Archivos

| Opción | Pantalla (clave de permiso) | Destino |
|---|---|---|
| A-Proveedores | `ivmcon01` | 🔁 `tax_taxpayers` — maestro de contribuyentes; en la plataforma nueva el proveedor vive en `accounts-payable` y `tax` guarda solo los datos fiscales (NRC, NIT, DUI, gran contribuyente) enlazados |
| B-Clientes | `ivamcli1` | 🔁 igual, con `accounts-receivable` |
| C-Departamentos | `ccmdep01` | ✅ catálogo geográfico (24 filas; ver preguntas) |
| D-Municipios | `ccmmun01` | ✅ catálogo geográfico (287 filas) |
| E-Tipos de Movimiento | `ccmtmov1` | 🔁 `tax_document_types` (el legado reutiliza el catálogo de movimientos de CxC, 18 tipos) |
| G- Iva | `ccmiva` | 🔁 `tax_settings` (tasa de IVA); hoy es una variable global en `IVA.MEM` |

### Movimientos

| Opción | Pantalla | Destino |
|---|---|---|
| A- Ventas Crédito Fiscal (oculta para `usrtype=2`) | `ivamfis2` | ✅ `tax_sales_invoices` |
| B- Ventas Consumidor Final | `ivamfac2` | ✅ `tax_sales_daily_summaries` |
| C- Registro de Compras | `ivacomp2` | ✅ `tax_purchases` — pantalla principal |
| D- Compras a Excluidos | `ivaexcl` | ✅ `tax_purchases` con `kind = 'excluded'` |
| Control de Renta | `ivarenta` | ✅ `tax_income_withholdings` |
| Subir Libros de IVA | `subiriva` | 🔁 importador genérico (CSV) para cargas históricas |
| E-Seleccionar Mes de Trabajo | `sbselmes` (sin permiso) | ✅ plataforma (selector de período) |
| F-Seleccionar Empresa de Trabajo (oculta si hay una sola) | `selemp` (sin permiso) | ✅ plataforma |

### Impresiones

Las opciones 4, 5 y 6 (libros) se ocultan para `usrlvl=3`.

| Opción | Pantalla | Destino |
|---|---|---|
| A- Listado de Contribuyentes | `ivarcon1` | ✅ |
| B- Listado de Clientes | `ivarcli1` | ✅ |
| C- Libro de Compras | `ivarco01` (reporte `ivarco04.frx`; texto `ivadco03.frx`; botón "Generar a Excel") | ✅ libro legal |
| D- Libro de Ventas Crédito Fiscal | `ivarcf01` (`ivarcf01.frx`, `ivadcf01.frx`) | ✅ libro legal |
| E- Libro de Ventas Consumidor Final | `ivarfa01` (`ivarfa01.frx`) | ✅ libro legal |
| Compras Anual / Ventas Crédito Fiscal Anual / Ventas Consumidor Final Anual | `ivarco02`, `ivarcf02`, `ivarfa02` | 🔁 un solo reporte "libro por rango de meses" por tipo |
| F930 | `f930` | 🔁 archivo de percepciones/retenciones/anticipos (formato viejo, texto fijo) |
| F930 V2 | `f930v2` (formulario VFP) | ✅ misma información en Excel con fecha y serie |
| Retención de Renta | `ivarrent` (`ivarrent.frx`) | ✅ |
| COA | `ivarcoa` | ❌/🔁 formato viejo de texto fijo: confirmar si se usa (pregunta 21) |
| Libro de Compras por Proveedores | `ivarco03` | 🔁 filtro del libro |
| Libro de Ventas por Cliente | `ivarcf03` | 🔁 filtro del libro |
| Archivos Hacienda IVA | `genarchi` | ✅ **exportación principal** (anexos en Excel) |
| Generar F987 / F987v2 / F987v3 | `f987`, `f987v2`, `f987v3` | ❌ las v1 y v2; ✅/🔁 la v3 si el informe sigue vigente (pregunta 20) |
| Generar F910 | `f910` | ✅ renta retenida anual por perceptor |
| Renta Acumulada | `ivaren` | ✅ |
| Renta por Año | `ivaren2` | ✅ |

### Utilidades

| Opción | Pantalla | Destino |
|---|---|---|
| Reindexar Archivos (solo `usrlvl` 1–3) | `reindex` | ❌ no aplica en SQLite |
| Transferir Ventas Crédito Fiscal | `ivatranc` | 🔁 sincronizar desde CxC/facturación (ver §3 de reglas) |
| Transferir Ventas Facturas | `ivatranf` | 🔁 igual (consumidor final) |
| Transferir Compras Cuentas por Pagar | `ivatraco` | 🔁 sincronizar desde `accounts-payable` |
| Transferir Compras Inventarios | `ivatrac2` | 🔁 sincronizar desde `inventory` |
| Cierre Mensual / Abrir mes Cerrado | `ivacierr`, `abririva` | ✅ tabla de períodos fiscales de IVA (`tax_periods`) |
| Usuarios (solo `usrlvl=1`, sin `PERFIL`) | `acceso`, `acceso2` | ✅ plataforma (Better Auth + roles) |
| Creación de Empresas | `sbmemp01` | ✅ plataforma; los datos fiscales (series, resoluciones, NIT, NRC) van a `tax_settings` |
| Configuración de Retenciones | `config2` | ✅ `tax_settings` (tasas de retención, percepción y anticipo) |
| Cambiar el No. de Registro de Un Cliente / de un Proveedor / el NIT en Renta | `cambiar3`, `cambiar4`, `cambiare` | 🔁 corrección de NRC/NIT con bitácora y propagación a documentos |
| Buscar / Buscar Otra Vez / Pegar / Copiar | (menú del sistema) | ❌ |

Observaciones del mapa:
- **`ivarcoa` (COA) no tiene fila en `PERFIL`** para la copia: la opción siempre responde "no tiene Acceso" salvo que se agregue la fila *(inferido de la tabla: 45 claves de programa; falta `ivarcoa`)*.
- La clave de "Cierre Mensual" en `PERFIL` es `ivacierre` y el menú busca `ivacierr`; funciona porque `SEEK` acepta llave parcial.
- `PERFIL` tiene 88 filas vivas (46 borradas) para 2 usuarios; `USUARIOS` tiene 2 vivos (40 borrados).

## 5. Pantallas clave (descripción de la interfaz)

Renderizadas con `render_scx.py` (solo se leyeron las posiciones; **no se vieron en navegador**). Todas son ventanas de ancho fijo con
fondo gris de Windows y el mismo estilo de la familia (barra de botones, campos a la izquierda, importes apilados a la derecha).

**`ivacomp2` — Registro de Compras** (966 × 660). Fila superior de botones de acción (Anterior, Siguiente, Modificar, Eliminar,
Agregar, Finalizar; Grabar/Ignorar; "Ver Todo", "Buscar", "Imp. Retención", "Leer json"). **Columna izquierda** (x≈143), de arriba abajo:
No. Comprobante, No. de Registro (con el nombre del proveedor al lado), No. Correlativo Interno, No. de Resolución, No. de Serie,
Tipo de Movimiento, Código de Generación, Número de Control, Sello de Recepción, Tipo de Operación (combo), Clasificación (combo),
Sector (combo), Tipo de Costo/Gasto (combo), Fecha del Comprobante, No. de Comprobante de Retención, Tipo de Doc. (combo:
Impreso por Imprenta, Formulario Único, Otros, Documento Tributario Electrónico). **Columna derecha** (x≈572 y 744): dos bloques
"Internas" e "Importaciones" con Exentas, Gravadas, IVA; debajo Cotrans, Fovial, Otros Impuestos, IVA Percibido, **Compra total**,
IVA Retenido, "13 % Retención" (etiqueta fija en la pantalla), Anticipo a Cuenta, Compra No Sujeta; casillas "Es retención a Terceros" y "Es Compra".

**`ivamfis2` — Ventas con Crédito Fiscal** (≈ 700 × 560). Izquierda: Tipo de Mov., No. Comprobante, No. de Registro (+ nombre),
Código de Generación, Número de Control, Sello de Recepción, Fecha del Doc., No. de Resolución, No. de Serie. Derecha (x≈400), apilados:
Exportaciones, Vta. Exentas, Vta. Gravada, IVA, IVA Percibido, IVA Retenido, Total Vta., Anticipo a Cta. Botones "Ver Todo", "Buscar", "Leer json".

**`ivamfac2` — Ventas Consumidor Final** (≈ 700 × 720). Encabezado: Comprobante **del … al …**, Código de Generación y Número de Control
**del … al …**, Fecha, Movimiento, No. de Resolución, No. de Serie. Bloque "Detalle de la Venta" apilado: Ventas Exentas, Ventas Internas Exentas
no Sujetas a Proporcionalidad, Venta No Sujeta, Ventas Brutas Gravadas, Exportaciones fuera/dentro del Área, Exportaciones de Servicio,
Ventas a Zona Franca, Ventas a Terceros, Venta Total.

**`genarchi` — Archivos Hacienda IVA** (≈ 500 × 620). Selector "Todo el Mes / Por Fechas", Fecha Inicial/Final, Directorio de Copia, Nombre de Archivo
y una columna de **siete botones**: Compras Locales, Crédito Fiscal, Consumidor Final, Compras a Excluidos, Retención de IVA 1 %, Percepción de IVA 1 %, Exportaciones.

La nueva UI conserva: barra de íconos en el mismo orden, columna de campos + columna de importes, totales visibles y los selectores de mes.

## 6. Fuera de alcance de este spec

- Extraer el detalle de los 26 reportes `.frx` (solo se leyeron los de los tres libros legales y el comprobante de retención `qwreten`).
- Emisión de DTE (vive en `INV64`, tabla `FELECTRO`); ver [open-questions.md](open-questions.md) #17–19.
- Maestro de proveedores y clientes completos (CxP y CxC); aquí solo los datos fiscales.
- `ivarco05`, `ivarco1k`, `ivarco4k`, `ivadcok`, `ivadcopr` y demás variantes de reporte fuera del proyecto.
- Formularios de alta de empresas y usuarios (plataforma).
