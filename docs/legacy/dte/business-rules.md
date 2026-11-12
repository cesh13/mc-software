# DTE — reglas de negocio de la solución externa

Etiquetas: **[V]** verificado en código, **[D]** verificado en estructura de datos de muestra, **[I]** inferido.
Rutas relativas a `factura-electronica-mc`. Versión estudiada: 1.13.3. Nada de esto es texto normativo: es lo que el código hace.
Secciones «pendiente de leer» se refinan en la segunda pasada.

## 1. Contrato con el ERP: lectura

1.1 **Archivos y nombres.** La ruta de la carpeta de DBF y los nombres de archivo son ajustes de la instalación: `DBFPath`,
`DBFName` (por defecto `felectro.DBF`), `DBFInvalidateName` (por defecto `fanular.DBF`) [V `FacturaElectronica.WPF/Models/AppSettings.cs`].

1.2 **Acceso.** OLE DB con el proveedor de FoxPro (`VFPOLEDB`), `select * from <tabla>` con `WHERE` [V `FacturaElectronicaMC/DataAccess.cs`].
El proveedor es COM, de 32 bits y no es seguro entre hilos: **todas** las lecturas y escrituras pasan por un candado en proceso [V]. Eso explica el cliente x86 [I].
No hay índice ni `ORDER BY`: el orden de proceso es el orden físico del archivo [V].

1.3 **Qué es «pendiente».** `PROCESADO = 0 AND FALLO = 0` (para `FELECTRO` y `FANULAR`). Otros filtros que usa la pantalla: enviados
(`PROCESADO = 1 AND FALLO = 0`), fallidos (`FALLO = 1`), «enviados sin sello» (`PROCESADO = 1 AND EMPTY(SELLORE)`), y rango de fechas por `FECEMI` [V]. Hace falta que el ERP deje
`PROCESADO` en falso y `FALLO` en 0 o vacío; en la muestra `PROCESADO` es lógico en `FELECTRO` y numérico en `FANULAR`, y `FALLO` es numérico de 1 posición en ambos [D].

1.4 **Frecuencia.** Un ciclo cada `TickerTimeSeconds` (60 s por defecto): primero DTEs, luego invalidaciones, luego correos. Un solo ciclo a la vez (semáforo). El ciclo no corre mientras
la configuración esté incompleta, el perfil de PDF sea inválido o el usuario lo pause [V `FacturaElectronica.WPF/Services/ProcessingBackgroundService.cs`]. **Si la aplicación no está abierta, no hay proceso** [I].

1.5 **Agrupación de líneas.** Cada fila es una línea. Se agrupan en memoria por (`NFACT_ENV`, `TIPODOC`): la primera fila crea la cabecera (emisor, receptor, resumen, referencias) y **cada fila agrega una línea al cuerpo**; los datos
de cabecera de las demás filas se ignoran [V `DataProcess.BuildPendingDtesFromDbf`]. Un documento solo se envía si `cantidad de líneas construidas == NLINEAS` (columna que escribe el ERP); si no, **se omite sin aviso ni log** (hallazgo de auditoría abierto, se verá como «Pendiente» para siempre) [V `DteProcessingService.cs`, `FABLE-AUDIT.md` §2.15]. El orden de las líneas es el orden de las filas; `NUMITEM` viene del DBF.

1.6 **Errores de datos.** Si una fila de un documento falla al construirse, **el documento completo sale del lote** y se registra como error de datos (panel Errores; en Documentos se ve «Excepción» en rojo con la causa). **No se marca `FALLO`**: el documento sigue pendiente y se vuelve a intentar solo en el siguiente ciclo cuando el dato se corrige en el ERP; los demás documentos se envían [V 1.13.0/1.13.1].

1.7 **No se bloquea nada del lado del DBF.** No hay `FLOCK`/`RLOCK`, ni marca «en proceso». Evita el doble proceso solo por: semáforo en proceso (una instancia) y el `PROCESADO` al final. **Dos instancias contra los mismos DBF procesarían el mismo documento dos veces** [I]; la segunda sería rechazada por número de control duplicado (ver 4.4).

1.8 **Conflictos de acceso con FoxPro.** Si el ERP tiene la tabla en uso exclusivo o falta un archivo (memo), la lectura falla: el ciclo muestra «No se pudo leer felectro.DBF: <causa>», lo registra y el Monitor recibe `outbox_ok = false` [V 1.6.4/1.6.5]. Las escrituras se reintentan 3 veces con espera de 250 ms × intento; un `UPDATE` que no afecta ninguna fila se considera fallo inmediato (sin reintentos) [V `DataAccess.TryExecuteDbfUpdate`].

## 2. Contrato con el ERP: escritura de vuelta

2.1 **Llave de escritura:** `NFACT_ENV = ? AND TIPODTE = ?` (¡`TIPODTE`, el código DTE de 2 caracteres, no `TIPODOC`!) en `FELECTRO` y en `FANULAR`. Actualiza **todas las filas** que cumplan, es decir, todas las líneas del documento [V `DataAccess.cs`]. Consecuencia: si el ERP reutiliza el mismo `NFACT_ENV` + `TIPODTE` para dos filas distintas (por ejemplo una preparación anterior sin borrar), ambas se actualizan [I]; la solución misma advierte «el ERP reutiliza NFACT_ENV» [V comentario en `DataProcess.RecoverExtraDataFromDbf`].

2.2 **Aceptado por el MH** (`estado = "PROCESADO"`): `PROCESADO = 1`, `FALLO = 0`, `NCONTROL`, `CODGENERAC` (el que devolvió el MH), `SELLORE` (sello de recepción). **Un sello vacío nunca se escribe** (se trata como desincronizado) [V].
2.3 **Rechazado, error de auth, de firma o respuesta no válida:** solo `FALLO = 1` (nada más; `PROCESADO` queda en 0). **El motivo del rechazo no va al DBF**: queda en el SQLite local (`Errores`, `RespuestaJson`) y en la pantalla Documentos/panel Errores [V]. El usuario del ERP solo ve `FALLO = 1`.
2.4 **Excepción no controlada durante el envío** (p. ej. tiempo de espera de red): **no se marca `FALLO`**; el documento sigue pendiente y se reenvía en el siguiente ciclo [V `DteProcessingService.cs`, bloque `catch`].
2.5 **Reintento manual:** botón «Reintentar» = `FALLO = 0` (`resetFailedInvoice`). Un documento con `FALLO = 1` **no se reintenta solo**. En el lado ERP, «Enviar F.Electro» borra y rehace la preparación mientras `NCONTROL` esté vacío (inv64 §11.1), lo que también devuelve `FALLO` a vacío [V inv64 + I].
2.6 **Desincronizado:** documento aceptado por el MH (existe intento con `Resultado = 1` en SQLite) pero cuya fila DBF no quedó escrita (bloqueo, sello vacío). La pantalla lo promueve a «Desincronizado» y el botón «Sincronizar DBF» escribe sello/código/número de control del intento aceptado, sin enviar nada al MH [V 1.5.0, 1.6.5, `DocumentQueryService.PromoteIfDesincronizado`].
2.7 **Campos que la solución nunca escribe:** `FHPROCESAM`, `NUMVALIDAC`, `INVALIDADA`, `AMBIENTE`, `TIPOMODELO`, `TIPOOPERAC`, `TIPOCONTIN`, `MOTIVOCONT` [V: no hay `UPDATE` que los nombre]. Si los libros de IVA o la UI del ERP esperaban `INVALIDADA`, nunca llegará.
2.8 **Invalidación (`FANULAR`):** al aceptarse, escribe `PROCESADO = 1`, `FALLO = 0`, `NCONTROL` y `CODGENERAC` **del documento invalidado**, y `SELLORE` = **sello del evento de invalidación** (se sobrescribe el sello que el ERP copió del documento) [V `DteProcessingService.SendPendingInvalidationsBatchAsync`].

## 3. Tipos de documento y versión de esquema

Selector: `Normativa` por instalación («v1» por defecto; cualquier otro valor cae a v1) [V `AppSettings.cs`, `DteBuilderFactory.cs`]. El tipo sale de la columna `TIPODTE` de cada fila.

| Tipo | Documento | Normativa v1 (esquema, versión) | Normativa v2 (esquema, versión fija) |
|---|---|---|---|
| 01 | Factura consumidor final | `fe-fc-v1`; versión = columna `VERSION` del DBF | `fe-f-v2`; 2 |
| 03 | Comprobante de crédito fiscal | `fe-ccf-v3`; `VERSION` del DBF | `fe-ccf-v4`; 4 |
| 05 | Nota de crédito | `fe-nc-v3`; `VERSION` del DBF | `fe-nc-v4`; 4 |
| 06 | Nota de débito | `fe-nd-v3`; `VERSION` del DBF | `fe-nd-v4`; 4 |
| 11 | Factura de exportación | `fe-fex-v1`; `VERSION` del DBF | `fe-fex-v3`; 3 (desde 1.9.0) |
| 14 | Sujeto excluido | `fe-fse-v1`; `VERSION` del DBF | `fe-fse-v2`; 2 |
| 04 | Nota de remisión | rama en el código v1 y PDF; **el ERP no la emite** (inv64 #8) | `NotSupported` (no migrada) |
| 07, 08, 09, 15 y otros | (retención, liquidación, doc. contable, donación…) | esquema empaquetado, **sin constructor** | sin constructor |
| Invalidación | evento | `invalidacion-schema-v3` para **todas** las instalaciones (versión 3 fija; la columna `VERSION` = «02» de `FANULAR` se ignora) | igual |
| Contingencia | evento | solo `ContingenciaTool`/`ContingenciaBuilder`, esquema v4 | v4 |

[V `Builders/DteBuilderV2.cs`, `DataProcess.intializeDTEToInvaildateFromRow`, `FacturaElectronicaMC/Models/DTEContingenciaModel.cs`, carpeta `schemas/`; el nombre de cada tipo es el de inv64/`DbfFieldMap`; el significado de 07/08/09/15 por el nombre del esquema empaquetado es **[I]**]. Los eventos «Retorno», «Operaciones especiales» y «Gestión» tienen esquema empaquetado y no están implementados (`docs/hacienda-audit-v2.md`).

## 4. Construcción del DTE: de qué campo sale cada sección

Principio central [V]: **la solución no calcula importes**. Copia del DBF los totales, el IVA, las retenciones/percepciones y el total a pagar que el ERP ya calculó. Las reglas de cálculo viven en INV64 (ver inv64 §3). La solución solo copia, suprime campos que el esquema del tipo no admite (centinelas `NO_SERIALIZABLE_*`), normaliza y valida algunas cosas. El mapa completo columna → campo JSON está en `FacturaElectronicaMC/Helpers/DbfFieldMap.cs` (verificado por pruebas `DbfFieldMapTests`).

| Sección | Campos del DBF (cabecera = primera fila) | Observaciones |
|---|---|---|
| identificacion | `VERSION` (v1), `TIPODTE`, `FECEMI`, `HOREMI`, `TIPOMONEDA` | `ambiente` = ajuste (`00` pruebas / `01` producción), **no** la columna `AMBIENTE`; `tipoModelo = 1`, `tipoOperacion = 1`, contingencia `null`; `codigoGeneracion` = UUID nuevo; `numeroControl` calculado (§5) |
| documentoRelacionado | `TIPODOCNC`, `TIPOGENENC`, `NOCCFDENC`, `FECCFDENC` | Solo si las cuatro tienen valor. En el cuerpo, `NOCCFDENC` también viaja como `numeroDocumento` en 05/06 |
| emisor | `NITEMISOR`, `NRCEMISOR`, `NOMBREEMIS`, `CODACTIEMI`, `DESCACTIEM`, `NOMCOMEEMI`, `TIPOESTABL`, `DEPARTAMEN`, `MUNICIPIO`, `DIRECCEMIS`, `TELEFONOEM`, `CORREOEMI`, `CODESTABLE`, `CODPUNTOVE`, `TIPOITEMEX`, `REGIMEN`, `RECINTOFI` | `codEstableMH`/`codPuntoVentaMH` = `null`. `CODESTABMH` y `CODPUVENMH` **no se leen** |
| receptor | `NITRECEPTO`, `NRCRECEPTO`, `NOMBRERECE`, `CODACTIREC`, `DESCACTIRE`, `NOMCOMEREC`, `DEPARTAREC`, `MUNICIPREC`, `DIRECCRECE`, `TELEFONREC`, `CORREORECE`, `TIPODOCUME`, `NUMDOCUMEN`, `CODPAIS`, `NOMPAIS`, `TIPOPERSON` | NIT/NRC/documentos sin guiones. Según el tipo se suprimen campos (p. ej. 01 no lleva NIT/NRC/actividad; 11 no lleva dirección) |
| cuerpoDocumento (por fila) | `NUMITEM`, `TIPOITEM`, `CODIGO`, `CANTIDAD`, `UNIMEDIDA`, `DESCRIP`, `PRECIOUNI`, `MONTODESCU`, `VENTANOSUJ`, `VENTAEXENT`, `VENTAGRAVA`, `CODTRIBUTO`, `PSV`, `NOGRAVADO`, `IVALIN`, `IVARETLIN` (NC/ND v2) | v1 manda `uniMedida = 1` fijo; v2 lee `UNIMEDIDA` |
| resumen | `TOTALNOSUJ`, `TOTALEXENT`, `TOTALGRAVA`, `SUBTOTALVE`, `DESCUNOSUJ`, `DESCUEXENT`, `DESCUGRAVA`, `PORCENDESC`, `TOTALDESCU`, `CODTRIBU`/`DESCTRIBU`/`VALTRIBU` (tributo IVA), `SUBTOTAL`, `IVAPERCI1`, `IVARETE1`, `RETERENTA`, `MONTOTOTOP`, `TOTALNOGRA`, `TOTALPAGAR`, `TOTALLETRA`, `SALDOFAVOR`, `CONDOPERA`, `CODIGOPAGO`, `PLAZO`, `FLETE`, `SEGURO`, `CODINCOTER`, `NOMINCOTER`, `VALORAPE3` (observaciones) | v2 renombra `ivaRete1→ivaRete`, `ivaPerci1→ivaPerci`; `reteRenta` desaparece en 01/03/05/06; `pagos[]` en v2 (§4.3) |
| extensión | (ninguna) | v1: bloque `extension` vacío/suprimido; v2: eliminado. Las columnas `NOMBENTREG`, `DOCUENTREG`, `NOMBRECIBE`, `DOCURECIBE`, `OBSERVACIO`, `PLACAVEHIC` **no se usan** |
| apéndice | `CAMPOAP3`/`ETIQUETAP3`/`VALORAPE3`, y `CAMPAPE5` (varias entradas `n:campo:etiqueta:valor;`) | El apéndice 4 (`ETIQUETAP4`/`VALORAPE4`) es dirección de envío solo para el PDF; el vendedor (`VALORAPEN`) y código de cliente (`VALORAPE2`) son solo datos de presentación |
| solo presentación (PDF) | `NDEPARTAME`, `NMUNICIPE`, `NDEPARTARE`, `NMUNICIRE`, `VALORAPEN`, `PLAZO`, `VALORAPE2`, `VALORAPE3`, `REFERENCIA`, `ETIQUETAP4`, `VALORAPE4`, `LOTE`, `FVENCE`, `COMENTARIO`, `NOMBREU` | No viajan al MH; se guardan en `ExtraDataJson` |

4.1 **Supresión por tipo (v1)** [V `DataProcess.InitializeDteFromRowV1`]: por ejemplo 01 suprime NRC/NIT/actividad del receptor, `ivaPerci1` y tributos; 11 suprime dirección del receptor y los totales de no sujeto/exenta/IVA/retención/renta/descuentos, y deja incoterms en `null` si `TIPOITEMEX = 2` (servicio); 05/06 suprimen tipo y número de documento del receptor, descuentos, `totalIva`, pagos, etc.; 03 pone `totalIva`, `descuento`, `flete`, `seguro` en `null`. Cualquier cambio de esquema obliga a tocar esta lógica (hallazgo de arquitectura abierto).

4.2 **Reglas v2 por tipo** [V `Builders/DteBuilderV2.cs`]:
- Todas: se exige que establecimiento y punto de venta de la configuración cumplan el patrón del MH (§5.3); se quitan `tipoEstablecimiento`, `codEstableMH`, `codPuntoVentaMH` en los tipos donde el esquema ya no los admite; `extension` eliminado; `observaciones` pasa a `resumen.observaciones` (de `VALORAPE3`); direcciones con `distrito`.
- **Dirección:** el código de municipio del ERP (tabla v1) se convierte con `Constants/TerritorioV2.cs` (derivado de `schemas/territorio-v1-a-v2.json`); `distrito` = el código de municipio v1 mapeado; si el código nuevo no tiene equivalente, el error dice los códigos anteriores válidos; corrección de Cabañas en 1.12.2 según catálogo CAT-013 v1.1 del MH.
- **Unidad de medida:** `UNIMEDIDA` vacía → 59 (Unidad); un código que la v2 eliminó (p. ej. 05, 04, 03) → 99 (Otra); un código que nunca existió → el documento no sale, el mensaje nombra la columna.
- **Forma de pago (01, 03, 11, 14):** `pagos[0]` con `codigo = CODIGOPAGO` (catálogo, con cero a la izquierda) y `montoPago = TOTALPAGAR`; si `CONDOPERA = 2` (crédito) añade `plazo = 01` (días) y `periodo = PLAZO`. Si `CODIGOPAGO` no está en el catálogo o el crédito no trae `PLAZO` → el documento no sale con mensaje de la columna (1.10.0). `referencia = null`.
- **05/06:** receptor con `tipoDocumento`/`numDocumento` (de `TIPODOCUME`/`NUMDOCUMEN`; si faltan, cae a NIT = tipo 36 desde `NITRECEPTO`; si tampoco hay → error); `ivaPerci` = `IVAPERCI1`; `totalIva`/IVA por línea **solo** si el documento relacionado es del tipo 07 (`TIPODOCNC = "07"`), en caso contrario 0 (1.11.0/1.11.1); `totalNoGravado`, `totalPagar` del DBF.
- **Retención por línea en 05/06 (1.13.3):** el MH compara `resumen.ivaRete` contra la suma de `cuerpoDocumento[].ivaRete`. La línea lee `IVARETLIN` (el ERP la llama así; una versión anterior leía `IVARETELIN` y mandaba 0 → rechazo «CALCULO INCORRECTO»). Si todas las líneas vienen en 0 y `IVARETE1 > 0`, se **reparte `IVARETE1` entre las líneas gravadas proporcional a `ventaGravada`**, con redondeo a 2 decimales (alejándose de cero) y el **residuo a la última línea gravada**; sin líneas gravadas va completa en la primera. Si el ERP sí llena `IVARETLIN`, la suma debe coincidir con `IVARETE1` con tolerancia de 0.01; si no, el documento queda en «Excepción» y no se envía (`CompletarDocumento`).
- **11 (exportación v3):** `REGIMEN` con formato `EX-n.dddd.ddd` se separa en `tipoRegimen` («EX-n») y `regimen` («dddd.ddd»); formato distinto o `TIPOITEMEX` fuera de 1–3 → no sale. `descuento`, `totalNoOnerosas` fijo 0 (el DBF no lo trae), etc.
- **14 (sujeto excluido v2):** el bloque `sujetoExcluido` pasa a `receptor`.

4.3 **Validaciones antes de enviar** [V]: (a) las anteriores del constructor; (b) `NLINEAS`; (c) en `AsignarPagos`, `MapDireccionV2`, `LeerUnidadMedida`, `AsignarRegimen`; (d) suma de `IVARETLIN`. **No hay validación contra el esquema JSON oficial en la ruta de envío**: solo existe en pruebas y en el Laboratorio (`LabSchemaValidator`). Un dato que pasa las reglas locales pero viola el esquema se descubre como rechazo del MH tras firmar (hallazgo de auditoría §3.7, abierto). La pantalla del JSON enviado resalta en rojo los campos señalados por el MH y muestra la columna DBF de origen (1.8.0).

4.4 **Redondeo.** La solución no redondea importes del DBF (precisión del DBF: importes N12.2, precio unitario y descuento de línea N12.4) salvo en el reparto de `ivaRete`. `ConversionHelper.GetDecimalValue` solo hace `decimal.TryParse` sobre el texto de la celda con la **cultura actual de Windows** (sin redondeo; una columna ausente o no numérica lanza error de documento) [V `Helpers/ConversionHelper.cs`]. Las diferencias de centavos entre líneas y totales que inv64 detectó (inv64 #11) **se heredan tal cual** hacia el MH y pueden provocar rechazos por «CALCULO INCORRECTO»; no hay corrección salvo la de 05/06 [I].

## 5. Numeración

5.1 **Número de control.** Lo genera la solución, no el ERP: `DTE-{TIPODTE}-{establecimiento}{puntoVenta}-{15 dígitos}` donde establecimiento y punto de venta son `LocationId` y `PosId` de **la configuración de la instalación** (por defecto `M001`/`P001`) y los 15 dígitos son `"00000" + "00" + NFACT_ENV sin sus 2 primeros caracteres` [V `DataProcess.InitializeDteFromRowV1`]. Es decir: **el correlativo es el número de documento del ERP (sus últimos 8 dígitos)**; no hay contador propio ni tabla de secuencias. Solo funciona si `NFACT_ENV` mide exactamente 10 caracteres (hallazgo §2.5: no se valida).
5.2 **Secuencias por establecimiento/punto de venta/tipo:** no existen en la solución. Una instalación tiene **un** establecimiento y **un** punto de venta; varias cajas implican varias instalaciones o una convención en el ERP [I]. La unicidad por tipo depende de que el ERP no repita los últimos 8 dígitos dentro de un mismo `TIPODTE` (inv64 #5, #24, #25).
5.3 **Formato exigido en v2:** establecimiento `[MBSP]\d{3}`, punto de venta `P\d{3}`; la configuración no se puede guardar con otro formato y el constructor lo vuelve a comprobar [V `Constants/NumeroControlRules.cs`, 1.10.0]. El texto de la norma debe contrastarse con la vigente.
5.4 **Código de generación:** `Guid.NewGuid()` en mayúsculas, **nuevo cada vez que se construye el documento (cada ciclo/intento)** [V]. Para el ERP el valor final es el que devuelve el MH y se escribe en `CODGENERAC`.
5.5 **Colisiones y huecos.** No hay detección de huecos ni de reutilización. Lo único que protege es que el MH rechaza un número de control repetido; el mensaje se recibe como rechazo (`Reintentar` se deshabilita para ese caso desde 1.5.0). Si el MH aceptó un envío cuyo resultado no llegó (tiempo de espera), el reintento con **UUID nuevo y mismo número de control** es rechazado como duplicado y el documento queda fallido sin camino de recuperación automático; falta usar la consulta del MH para recuperar el sello (propuesta de auditoría §6.1, no implementada) [V/I].
5.6 **`idEnvio`** de cada solicitud = año + correlativo, como entero 32 bits (desborda a ~8 dígitos de correlativo anual) [V `DteRequestReconstructor.ComputeIdEnvio`, auditoría §2.5].

## 6. Firma y transmisión

6.1 **Firma:** local, en proceso, JWS con RSA-SHA512 sobre el JSON del DTE; usa un archivo de certificado (XML con la llave privada cifrada) cuya ruta es `SigningCertPath` y la contraseña de la llave privada del ajuste `PrivatePassword`. NIT del contribuyente = ajuste `NIT` [V `FacturaElectronicaMC.Firmador/FirmaBusiness.cs`, `FirmaService.cs`]. Hallazgo abierto: el firmador imprime en consola el contenido del certificado (auditoría §2.10).
6.2 **Autenticación:** `POST` de formulario (`user` = NIT, `pwd` = contraseña de API) al endpoint de seguridad del ambiente; la respuesta trae un `token` con prefijo `Bearer` que se envía en la cabecera `Authorization`. **Se pide un token por cada documento**; no hay caché ni renovación (`TODO` en el código); si la autenticación falla, el documento se marca `FALLO` [V `DataProcess.GetAuthenticationToken`; auditoría §5.1: el MH limita ese endpoint].
6.3 **Recepción:** una petición **síncrona por documento** (`POST` al endpoint de recepción de DTE) con `ambiente`, `version`, `tipoDte`, `idEnvio`, `codigoGeneracion` y el documento firmado; **no se usa el envío por lotes del MH** (los «lotes» son locales). Éxito = HTTP correcto **y** `estado = "PROCESADO"` [V]. Envío en serie (un documento a la vez).
6.4 **Tiempos y reintentos:** sin tiempo de espera configurado (el predeterminado de `HttpClient`) [I]; reintentos solo por el ciclo (60 s) y solo si hubo excepción; un rechazo no se reintenta solo (ver 2.3–2.5).
6.5 **Rechazos:** la respuesta del MH se guarda íntegra en SQLite; el panel Errores muestra `descripcionMsg` + `observaciones`; la ventana del JSON enviado señala los campos con error y su columna DBF. El usuario corrige **en el ERP** (re-preparar) o, si el dato era del ERP, pulsa Reintentar tras corregir [V 1.8.0].
6.6 **Ambiente:** ajuste `TestEnvironment` (verdadero por defecto) elige la URL de pruebas o producción (constantes en `Constants/BaseURLConstants.cs`) y el campo `ambiente` (`00`/`01`). No hay protección contra una instalación de producción en modo prueba salvo la idea (no implementada) de una alerta en el Monitor [V/I].
6.7 **Laboratorio de pruebas** (1.11.0): envía JSON editados a mano **siempre al ambiente de pruebas** con credenciales propias, sin tocar el DBF [V].

## 7. Contingencia e invalidación

7.1 **Contingencia productiva: no existe.** Todo DTE sale con `tipoModelo = 1`, `tipoOperacion = 1` y sin tipo de contingencia. No hay detección de caída del MH, ni modo de entrada/salida, ni emisión diferida, ni envío posterior de documentos en contingencia. Solo hay `ContingenciaBuilder` (evento de contingencia v4 en la biblioteca: valida 1 a 1000 documentos, tipo de contingencia 1–5, motivo obligatorio con el tipo 5, códigos MH de 4 caracteres) y `ContingenciaTool`, que envía eventos con documentos de relleno **para las pruebas del MH** [V `ContingenciaTool/Program.cs`; auditoría §3.3/§6.4]. 
7.2 **Invalidación:** la solicitud la crea el ERP en `FANULAR`; la solución la envía al endpoint de anulación. Campos y origen en `DbfFieldMap.Invalidacion`: documento a invalidar (`TIPODTE`, `CODGENERAC`, `SELLORE`, `NCONTROL`, `FECEMI`), receptor del documento (`TIPODOCREC`, `NUMDOCREC`, `NOMBREREC`, `TELEFONORE`, `CORREORECE`; vacíos se envían como `null` para coincidir con la factura original, 1.4.3), motivo (`TIPOANULA`, `MOTIVOANUL`), responsable (`NOMBRERES`, `TIPODOCRES`, `NUMDOCRES`), solicitante (`NOMBRESOLI`, `TIPODOCSOL`, `NUMDOCUMEN`), emisor (`NITEMISOR`, `NOMBRE`, `TIPOESTAB`, `NOMESTABLE`, `CODESTABLE`, `CODPUNTOVE`, `TELEFONO`, `CORREOEMI`).
7.3 **Reglas del evento:** `version = 3` fija; `codigoGeneracion` del evento = UUID nuevo (propio, distinto al del DTE; 1.1.1); `fecEmi` = **fecha del documento invalidado** y `horEmi` = hora del envío (el MH exige que coincidan; 1.3.2); `codEstableMH`/`codPuntoVentaMH` = ajustes `LocationId`/`PosId`; `codigoGeneracionR = null` siempre. **Por eso solo el tipo de anulación sin documento de reemplazo es correcto** (inv64 envía `tipoanula = 2` fijo); los tipos que exigen un documento de reemplazo no están soportados [V/I].
7.4 **Plazos de invalidación por tipo:** **no se implementan** (la auditoría v2 los lista como obligación y propone solo una advertencia); el MH rechazará fuera de plazo [V por ausencia en lo leído; confirmar con búsqueda completa].
7.5 **Entrega:** el JSON de la invalidación que se adjunta al correo lleva `firmaElectronica` y `selloRecibido` del evento desde 1.10.0, y el PDF muestra el sello del evento más el del documento invalidado [V].
7.6 **No se marca el documento original como invalidado** en `FELECTRO` (`INVALIDADA` no se escribe). La relación vive solo en `FANULAR` y en el SQLite (`TipoDte = -1`, `MCNumeroFactura = I-<nº>-<UUID del evento>`) [V].

## 8. Salidas: PDF, QR, correo, almacenamiento, monitor

8.1 **Carpeta de salida (`PDFPath`)**, nombres por código de generación [V `DteProcessingService.cs`]: `<cod>.json` (el DTE sin firma, indentado), `<cod>.pdf`, QR como imagen `<cod>.png` (`FacturaElectronica.WPF/Helpers/QRHelper.cs`), y para invalidaciones `<cod>-INVALIDACION.json|.pdf` (con el UUID **del evento**). El QR apunta a la consulta pública del MH con `ambiente`, `codGen` y `fechaEmi`; **la URL lleva un salto de línea literal entre parámetros** (hallazgo abierto §2.4; el generador de la vista previa no lo tiene). El ERP lee `<cod>.pdf` y `<cod>.PNG` (inv64 §11.1): coincide (Windows no distingue mayúsculas en la extensión) [I]. El **ticket `<cod>-t.pdf`** (1.0.20) solo lo genera el cliente WinForms legado; el cliente WPF **no** lo genera (el ERP imprime su propio ticket con el PNG) [V `FacturaElectronica.Client/Main.cs`].
8.2 **PDF:** QuestPDF, una plantilla por tipo (`CCFPDF`, `InvoicePDF`, `NotaCreditoDebitoPDF`, `FacturaExportacionPDF`, `SujetoExcluidoPDF`, `InvalidacionPDF`); diseño por cliente mediante `pdfprofile.json` (márgenes, tamaños, logo, QR) con perfiles «Clásico» y «Unificado» y copias; si un diseño falla genera uno de respaldo (`PdfWithFallback`) [V]. El perfil inválido **detiene el envío** antes de tocar el DBF (decisión de diseño: enviar es irreversible).
8.3 **Correo:** al terminar los envíos del ciclo, para los documentos aceptados con `ResultadoEnvioCorreo = 0`; destinatario `receptor.correo` (sujeto excluido: su correo; invalidación: `documento.correo`); asunto «<emisor> - Factura electrónica» (o «- Invalidación -»); adjuntos PDF y JSON; copias a las direcciones configuradas (`CopyEmailAddresses`, separadas por `;`); SMTP por MailKit (host, puerto por defecto 587, validación de certificado opcional). Resultado 1 = enviado, 2 = error **definitivo** (sin reintento automático; hay reenvío manual) [V `Services/EmailService.cs`].
8.4 **Almacenamiento local:** SQLite `EnviosDTE` (historial de intentos), más tablas de estadísticas y del laboratorio; sin purga automática encontrada; además la solución respalda la base una vez antes de migrar la columna `ExtraDataJson` [V]. Detalle en [data-model.md](data-model.md). **Logs:** archivo rotativo (Serilog) dentro de la carpeta de instalación, que se pierde en cada actualización (auditoría §2.6); `update.log` junto a la configuración. **Sentry** para errores.
8.5 **Monitor/telemetría:** el cliente envía al abrir y cada 6 h un «ping» con id de instalación, versión, SO, normativa, ambiente, si está instalado, contador de caídas, documentos con fallo (7 días), desincronizados y si pudo leer el DBF; sin contenido de documentos ni contraseñas. El servidor alerta por Telegram (instalación nueva, DBF ilegible, desincronizados, fallos, silencio > 26 h hábiles) y guarda copias JSON diarias (30) [V `Monitor/README.md`, 1.7.0, 1.7.1]. La identificación de la empresa incluye el NIT en el ping (visto en el ejemplo del README; no se copia aquí).
8.6 **Auto-actualización:** Velopack; el ciclo se detiene por completo antes de instalar (1.6.3). El feed está en un VPS propio por HTTP simple (hallazgo §8.2).

## 9. Calidad y riesgo

**Pruebas (según `TESTING.md`)**: lógica pura sin red; acceso solo por API pública; fixtures de DBF completos (`FullDbfTableBuilder`) y JSON de ejemplo de cada tipo; **validación de esquema oficial en pruebas** (`SchemaValidationTests`) para los tipos migrados a v2; pruebas de PDF píxel por píxel (regla: no regenerar líneas base para «arreglar» pruebas); (≈540 casos `[Fact]`/`[Theory]` xUnit contados por atributo) no hay pruebas de `SendDTE`/`SendDTEInvalidation`, de `TryExecuteDbfUpdate`, de `ContingenciaTool` ni del Monitor.

**Hallazgos de `FABLE-AUDIT.md` (2026-09-16) y estado verificado en el código actual:**
| # | Hallazgo | Estado hoy |
|---|---|---|
| 2.1 | `executeSave` de SQLite traga toda excepción: un DTE puede salir sin registro local | **Abierto** [V: el `catch` sigue vacío] |
| 2.2 | `SendDTEInvalidation` no revisa autenticación nula | **Abierto** [V] |
| 2.3 | Sello del evento en JSON/PDF de invalidación | **Corregido** (1.10.0) |
| 2.4 | QR con salto de línea | **Abierto** [V] |
| 2.5 | `numeroControl`/`idEnvio` suponen número de 10 dígitos | **Abierto** [V] |
| 2.6/2.7 | Log dentro de la carpeta de instalación; `ILogger` de WPF sin destino | Probable abierto (no verificado) |
| 3.2 | Exportación v2 | **Corregido** (1.9.0) |
| 3.3 | Contingencia v4 | Constructor v4 en biblioteca (herramienta actualizada); flujo productivo sigue sin existir |
| 3.6 | Patrón de número de control v2 | **Corregido** (1.10.0) |
| 3.7 | Validación de esquema antes de firmar | **Abierto** (solo en laboratorio/pruebas) |
| 5.1/5.2/5.3 | Token por documento; 6+ lecturas completas del DBF por consulta; sin índices en `EnviosDTE` | Abierto probable |
| 8.1 | Versiones de paquetes `*`, runtimes .NET 7 en dependencias | Parcialmente corregido (1.13.2 fijó versiones del cliente WPF) |
| 8.2/8.3 | Feed sin HTTPS; certificados de prueba confirmados | Abierto probable |

**Fragilidad del contrato DBF:** (1) llave de escritura compartida por todas las líneas y reutilización de `NFACT_ENV`; (2) sin transacciones: un fallo entre «aceptado» y «escrito» crea estado divergente (mitigado con «Desincronizado»); (3) `select *` completo cada ciclo y cada vez que se actualiza la pantalla (varias pasadas por ciclo) sobre un archivo que el ERP escribe; (4) esquema de columnas no versionado: la muestra del repositorio **no tiene** `NLINEAS`, `IVARETLIN`, `COMENTARIO`, `NOMBREU`, `NDEPARTAME`… que el código lee (ver data-model §1); una columna faltante rompe el documento con un mensaje de columna; (5) el código reconoce vacío con `EMPTY()` porque VFP rellena con espacios; (6) cualquier cambio de nombre de columna en el ERP rompe silenciosamente un campo opcional.
