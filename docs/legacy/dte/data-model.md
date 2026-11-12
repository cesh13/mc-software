# DTE — modelo de datos

Etiquetas: **[V]** código, **[D]** estructura de datos (nombres, tipos, conteos agregados; nunca filas), **[I]** inferido.
«Quién escribe»: **ERP** = INV64 (ver [inv64/data-model.md](../inv64/data-model.md)); **DTE** = la solución externa.
Se compararon tres estructuras: `FELECTRO.DBF` de INV64 (144 campos, [D]), la muestra del repositorio de la solución (134 campos, más antigua) y lo que el código lee.
Resultado: **la tabla de INV64 es un superconjunto de la muestra y contiene todas las columnas que el código lee** (incluidas `NLINEAS`, `IVARETLIN`, `COMENTARIO`, `NOMBREU`, `NDEPARTAME`, `NMUNICIPE`, `NDEPARTARE`, `NMUNICIRE`, `INVALIDADA`) [D].

## 1. `FELECTRO` (staging de DTE; una fila por línea del documento)

Llaves lógicas: grupo del documento = (`NFACT_ENV`, `TIPODOC`) al leer; llave de escritura = (`NFACT_ENV`, `TIPODTE`).
Tipos: C carácter (rellenado con espacios), N numérico, L lógico, D fecha, M memo.

### 1.1 Control (los escribe la solución, o ambos)
| Campo | Tipo | Quién escribe | Uso |
|---|---|---|---|
| `PROCESADO` | L (INV64 y muestra) | ERP lo deja en falso; **DTE** pone verdadero al ser aceptado | pendiente = falso |
| `FALLO` | N1 | **DTE** pone 1 al fallar; 0 al aceptar o al «Reintentar»; el ERP lo deja vacío/0 | fallido = 1 |
| `NCONTROL` | C40 | **DTE** (número de control calculado, §business-rules 5) | enlace con libros de IVA |
| `CODGENERAC` | C40 | **DTE** (código devuelto por el MH) | nombre de los archivos PDF/PNG |
| `SELLORE` | C40 | **DTE** (sello de recepción; nunca vacío) | prueba de aceptación |
| `NUMVALIDAC`, `FHPROCESAM`, `INVALIDADA` | C40, C40, L | **nadie** (la solución no los escribe) | siempre vacíos |
| `AMBIENTE`, `TIPOMODELO`, `TIPOOPERAC`, `TIPOCONTIN`, `MOTIVOCONT` | C | el ERP puede llenarlos pero **la solución los ignora** | ambiente = ajuste de la instalación; el resto, valores fijos |

### 1.2 Que lee la solución (los llena el ERP)
Estado de lectura por grupo, columna → destino en el JSON (detalle en `FacturaElectronicaMC/Helpers/DbfFieldMap.cs`):

- **Documento:** `VERSION` (solo normativa v1), `TIPODTE`, `TIPODOC` (agrupación), `NFACT_ENV`, `NLINEAS` (número de líneas esperado), `FECEMI`, `HOREMI`, `TIPOMONEDA`.
- **Referencia (05/06):** `TIPODOCNC`, `TIPOGENENC`, `NOCCFDENC`, `FECCFDENC`.
- **Emisor:** `NITEMISOR`, `NRCEMISOR`, `NOMBREEMIS`, `CODACTIEMI`, `DESCACTIEM`, `NOMCOMEEMI`, `TIPOESTABL`, `DEPARTAMEN`, `MUNICIPIO`, `DIRECCEMIS`, `TELEFONOEM`, `CORREOEMI`, `CODESTABLE`, `CODPUNTOVE`.
- **Receptor:** `NITRECEPTO`, `NRCRECEPTO`, `NOMBRERECE`, `CODACTIREC`, `DESCACTIRE`, `NOMCOMEREC`, `DEPARTAREC`, `MUNICIPREC`, `DIRECCRECE`, `TELEFONREC`, `CORREORECE`, `TIPODOCUME`, `NUMDOCUMEN`, `CODPAIS`, `NOMPAIS`, `TIPOPERSON`.
- **Línea:** `NUMITEM`, `TIPOITEM`, `CODIGO`, `CODTRIBUTO`, `CANTIDAD`, `UNIMEDIDA`, `DESCRIP`, `PRECIOUNI`, `MONTODESCU`, `VENTANOSUJ`, `VENTAEXENT`, `VENTAGRAVA`, `PSV`, `NOGRAVADO`, `IVALIN`, `IVARETLIN`, `LOTE`, `FVENCE`, `COMENTARIO` (memo), `NOMBREU` (nombre de unidad, solo PDF).
- **Resumen (de la primera fila):** `TOTALNOSUJ`, `TOTALEXENT`, `TOTALGRAVA`, `SUBTOTALVE`, `DESCUNOSUJ`, `DESCUEXENT`, `DESCUGRAVA`, `PORCENDESC`, `TOTALDESCU`, `CODTRIBU`, `DESCTRIBU`, `VALTRIBU`, `SUBTOTAL`, `IVAPERCI1`, `IVARETE1`, `RETERENTA`, `MONTOTOTOP`, `TOTALNOGRA`, `TOTALPAGAR`, `TOTALLETRA`, `SALDOFAVOR`, `CONDOPERA`, `CODIGOPAGO`, `PLAZO`.
- **Exportación:** `RECINTOFI`, `REGIMEN`, `TIPOITEMEX`, `CODINCOTER`, `NOMINCOTER`, `FLETE`, `SEGURO`.
- **Apéndices y presentación:** `CAMPOAP3`, `ETIQUETAP3`, `VALORAPE3`, `CAMPAPE5`, `ETIQUETAP4`, `VALORAPE4`, `VALORAPEN` (vendedor), `VALORAPE2` (código de cliente), `REFERENCIA` (información extra de la tabla de detalle), `NDEPARTAME`, `NMUNICIPE`, `NDEPARTARE`, `NMUNICIRE`.
- **Leídas por la solución pero no usadas por el JSON:** ninguna relevante.

### 1.3 Columnas que el código **no** lee (existen en la tabla)
`CODESTABMH`, `CODPUVENMH` (los códigos MH del emisor salen de la configuración), `TRIBUTODE`, `PERIODO`, `NOMBENTREG`, `DOCUENTREG`, `NOMBRECIBE`, `DOCURECIBE`, `OBSERVACIO`, `PLACAVEHIC` (bloque `extension`, eliminado en v2), `CAMPOAPEN`/`ETIQUETAAP`/`CAMPOAPEN2`/`ETIQUETAP2`/`CAMPOAP4`/`ETIQUETAP5`/`VALORAPE5`, `VERSIONACU`, `COD_PAIS`, `COMPRA`, `TOTALCOMP`, `CONDIOP`, `PAGOS`, `MONTOPAGO` (el monto de pago es `TOTALPAGAR`) [V/D].

### 1.4 Valores de estado

| `PROCESADO` | `FALLO` | `NCONTROL`/`SELLORE` | Significado |
|---|---|---|---|
| falso | 0/vacío | vacíos | **Pendiente**: la solución lo toma en el próximo ciclo |
| falso | 1 | vacíos | **Fallido** (rechazo, auth o firma): no se reintenta solo; el ERP re-prepara o el usuario pulsa «Reintentar» |
| verdadero | 0 | llenos | **Aceptado** (normal) |
| verdadero | 0 | `SELLORE` vacío | **Desincronizado** (versiones antiguas): la pantalla ofrece «Sincronizar DBF» |
| verdadero | 1 | llenos | Residuo de versiones anteriores a 1.6.1 (2026-08-26), que no limpiaban `FALLO` al aceptar [V changelog 1.6.1; coincide con los 68 CCF de inv64 #3, **[I]**] |
| falso | 0 | (pendiente + error de datos) | **Excepción** en pantalla (no se marca en el DBF) |

## 2. `FANULAR` (solicitud de invalidación; una fila por documento)

Muestra del repositorio: 39 campos [D]; INV64: 39 campos [D].
| Campo(s) | Quién escribe | Uso |
|---|---|---|
| `NITEMISOR`, `NOMBRE`, `TIPOESTAB`, `NOMESTABLE`, `CODESTABLE`, `CODPUNTOVE`, `TELEFONO`, `CORREOEMI` | ERP | `emisor` del evento (`codEstableMH`/`codPuntoVentaMH` salen de la configuración) |
| `TIPODTE`, `CODGENERAC`, `SELLORE`, `NCONTROL`, `FECEMI`, `MONTOIVA` | ERP copia del documento a invalidar | `documento`; `MONTOIVA` ya no se envía en v3 |
| `TIPODOCREC`, `NUMDOCREC`, `NOMBREREC`, `TELEFONORE`, `CORREORECE` | ERP | receptor del documento; vacío = `null` |
| `TIPOANULA`, `MOTIVOANUL` | ERP (inv64: `2` fijo y nombre del usuario) | `motivo.tipoAnulacion`, `motivo.motivoAnulacion` |
| `NOMBRERES`, `TIPODOCRES`, `NUMDOCRES` | ERP (usuario conectado) | responsable |
| `NOMBRESOLI`, `TIPODOCSOL`, `NUMDOCUMEN` | ERP (el cliente) | solicitante |
| `NFACT_ENV`, `TIPODOC`, `TIPOFAC` | ERP | enlace con el documento (llave de escritura: `NFACT_ENV` + `TIPODTE`) |
| `PROCESADO` (N1), `FALLO` (N1) | **DTE** (1/0) | estado |
| `NCONTROL`, `CODGENERAC`, `SELLORE` | **DTE** reescribe al aceptar: número de control y código del documento invalidado, y **sello del evento** | |
| `VERSION`, `AMBIENTE`, `FECANULA`, `HORAANUL`, `CODGENERAR`, `NUMDOCRESP`, `TIPOFAC` | ERP | **ignorados** por la solución (versión 3 fija; fecha del evento = fecha del documento invalidado; hora = hora del envío) |

Estados: igual que `FELECTRO` (pendiente = `PROCESADO` 0 y `FALLO` 0; fallido = `FALLO` 1; aceptado = `PROCESADO` 1 y sello lleno).

## 3. Almacenamiento local de la solución (SQLite)

Ubicación configurable (`SQLitePath`; por defecto una carpeta local fija de la máquina cliente). La base de partida viene en el repositorio del cliente WinForms (vacía) [V]; quién crea la tabla en una instalación nueva del cliente WPF **no está claro** (el código solo agrega columnas): pregunta técnica 3.

**`EnviosDTE`** (una fila por **intento de envío**, no por documento) [V `SqliteDataAccess.cs`, esquema de la base de partida]:
`Id` (autoincremental), `MCNumeroFactura` (= `NFACT_ENV`; para invalidaciones `I-<nº>-<UUID del evento>`), `NumeroControl`, `CodigoGeneracion` (único por intento; llave de las actualizaciones), `Version`, `Ambiente`, `TipoDTE` (código; `-1` = invalidación), `DTEJson` (el JSON enviado, sin firma), `ExtraDataJson` (datos de presentación: vendedor, plazo, lotes…; columna agregada automáticamente tras respaldar la base), `RespuestaJson` (respuesta íntegra del MH), `Resultado` (0 = no aceptado, 1 = aceptado), `ResultadoEnvioCorreo` (0 pendiente, 1 enviado, 2 error), `Errores`, `CreatedAt`, `UpdatedAt`.
Reglas: la fila se inserta **antes** de firmar/enviar; se actualiza con el resultado; un intento fallido no borra el JSON del documento guardado (1.3.1); un documento puede tener varias filas (un UUID por intento).
Sin índices, sin purga, sin límite de retención; lectura del historial por rango de `CreatedAt` [V].
**Otras tablas:** `VentasResumen`, `VentasDetalle`, `VentasOmitidos` (estadísticas derivadas de `EnviosDTE`; reconstruibles), `LaboratorioEnvios` (pruebas manuales).
**Archivos junto a la configuración:** `settings.json` (secretos en texto plano), `pdfprofile.json` (+copias), `telemetry.json`, identificador de instalación, `update.log`.

## 4. Modelo propuesto en la plataforma nueva (PROPUESTA)

Prefijo `dte_`, `empresa_id` en todas las tablas, dinero en enteros, soft-delete/anulación, secretos fuera de las tablas (almacén de secretos).

| Tabla | Para qué | Campos principales |
|---|---|---|
| `dte_establishments` | Códigos MH por sucursal y punto de venta | `empresa_id`, `codigo_estab_mh` (`M001`…), `codigo_pv_mh` (`P001`…), `codigo_estab_interno`, `codigo_pv_interno`, `tipo_establecimiento` |
| `dte_settings` | Por empresa/ambiente | `ambiente`, `normativa` (`v1`/`v2`), `certificate_ref`, `credentials_ref` (referencias al almacén), flags |
| `dte_documents` | Un registro por documento fiscal | `id`, `empresa_id`, `tipo_dte`, `source_doc_type` (F/C/N/D/E/S), `source_doc_id`/`legacy_nfact_env`, `numero_control` (único por empresa+ambiente), `codigo_generacion` vigente, `sello`, `fecha_emision`, `hora_emision`, `estado` (`preparado`, `enviando`, `aceptado`, `rechazado`, `error_datos`, `desincronizado`, `invalidado`), `receptor_*`, totales, `json_enviado`, `respuesta_mh`, `documento_origen_id` |
| `dte_lines` | Líneas | `dte_document_id`, `num_item`, `producto_id`, montos |
| `dte_attempts` (= `EnviosDTE`) | Intentos y eventos | `dte_document_id`, `codigo_generacion`, `kind` (`emision`/`invalidacion`/`contingencia`), `request_json`, `response_json`, `ok`, `error`, `created_at` |
| `dte_invalidations` | Solicitudes (= `FANULAR`) | `dte_document_id`, `tipo_anulacion`, `motivo`, `responsable`, `solicitante`, `codigo_generacion_evento`, `sello_evento`, `estado`, `documento_reemplazo_id` |
| ~~`dte_outbox`~~ | **Descartada (2026-11-12):** era la cola de convivencia con la solución .NET. Se decidió integrar la factura electrónica en la plataforma; el contrato vigente está en [docs/sistema/contratos.md](../../sistema/contratos.md) §6. | — |
| `dte_files` | PDF/JSON/QR | `dte_document_id`, `kind`, `path`, nombre `<codigo_generacion>.<ext>` |

**Mapeo desde el staging heredado:**
| Heredado | Nuevo |
|---|---|
| Grupo (`NFACT_ENV`,`TIPODOC`) de `FELECTRO` | 1 `dte_documents` + N `dte_lines` |
| `PROCESADO`/`FALLO`/`NCONTROL`/`SELLORE` | `estado`, `numero_control`, `sello` |
| `NFACT_ENV` | `legacy_nfact_env` (y base del correlativo si se mantiene la regla de numeración) |
| `TIPODTE`/`TIPODOC` | `tipo_dte`/`source_doc_type` |
| Columnas de emisor, receptor, resumen | campos de `dte_documents`/`dte_lines` o se derivan de maestros (el emisor sale de la empresa) |
| `FANULAR` | `dte_invalidations` (+ evento en `dte_attempts`) |
| `EnviosDTE` (SQLite) | `dte_attempts` |

**Decisiones de diseño propuestas:** correlativo propio por (`empresa`, `tipo_dte`, `establecimiento`, `punto_venta`) asignado por la plataforma dentro de la transacción de emisión, **con piso inicial = último número usado por el ERP** para no repetir números aceptados; código de generación estable por documento (reutilizado en reintentos del mismo intento) y reconsulta al MH antes de reenviar para evitar el «duplicado» tras un tiempo de espera; estado explícito `desincronizado` desaparece (la BD es una sola); motivo de rechazo guardado y visible al usuario; validación contra esquema antes de firmar.

## 5. Qué migrar de la solución a la plataforma

| Dato | Origen | Destino | Nota |
|---|---|---|---|
| Documentos emitidos (identificadores, sello, fechas, totales, estado) | `FELECTRO` + `EnviosDTE` (intento con `Resultado = 1`) | `dte_documents`, `dte_lines` | No reconstruir el JSON: guardar el `DTEJson` y la respuesta tal cual |
| Intentos fallidos y errores | `EnviosDTE` | `dte_attempts` | Opcional; útil para auditoría |
| Invalidaciones y su sello | `FANULAR` + `EnviosDTE` (`TipoDte = -1`) | `dte_invalidations` | Enlazar con el documento por código de generación |
| PDF / JSON / PNG | carpeta `PDFPath` | almacenamiento de archivos | Nombre por código de generación |
| Números de control usados | derivados | tabla de «último número» por serie | **Obligatorio** para no reutilizar |
| Configuración no secreta (ambiente, normativa, establecimiento, punto de venta, perfil de PDF) | `settings.json`, `pdfprofile.json` | `dte_settings`, `dte_establishments` | |
| Contraseñas, certificado, correo | `settings.json` | almacén de secretos | **No migrar por datos**; cargar por el operador |
| Estadísticas | tablas `Ventas*` | — | Derivadas; recalcular |
