# DTE — preguntas abiertas

Primero lo que este spec **resuelve** de [inv64/open-questions.md](../inv64/open-questions.md) (sección A y relacionadas); después las preguntas nuevas.
Etiquetas como en [business-rules.md](business-rules.md). Nada aquí afirma regla tributaria: lo que depende de la norma vigente se marca **(norma)**.

## Resueltas (o parcialmente) por la lectura de la solución

| inv64 # | Respuesta | Fuente |
|---|---|---|
| 1 El programa externo | Es `factura-electronica-mc` (.NET, v1.13.3), mantenido por el mismo desarrollador. Es un **cliente de escritorio Windows** (x86) por cliente, **continuo con sondeo cada 60 s** sobre los DBF (no es servicio). Genera el JSON, firma localmente (JWS), transmite de forma síncrona por documento, escribe 5 campos de vuelta, **genera PDF, QR y JSON y envía el correo**. Sí confirma todo lo inferido por inv64 §11.7 excepto «por lotes asíncrono»: el ciclo es por lotes locales pero cada envío es síncrono. | README §1–3 [V] |
| 2 Ambiente y modo | `FELECTRO.AMBIENTE` (vacío) **se ignora**: el ambiente es el ajuste `TestEnvironment` de cada instalación (pruebas por defecto). `EMPRESAS.MODOOP` no interviene. **Sigue sin saberse** si los 11,690 documentos de producción corresponden al ambiente real: el Monitor guarda `ambiente` por instalación → pedirlo. | business-rules 6.6 [V] |
| 3 Contingencia y reintentos | No hay contingencia productiva. Rechazo = `FALLO = 1` sin motivo en el DBF (el motivo solo en su SQLite). Los 68 CCF con `FALLO = 1` y `PROCESADO = 1` coinciden con versiones previas a 1.6.1 (no limpiaban `FALLO` al aceptar) **[I]**. Los 13 sin número de control son preparaciones pendientes o fallidas: con `FALLO = 1` no se reintentan solas. Una excepción de red deja el documento pendiente y se reintenta con UUID nuevo. | business-rules 2.3–2.5, 5.5, 7.1 |
| 4 Invalidación | La solución usa tal cual lo que escribe INV64 (`TIPOANULA`, `MOTIVOANUL`); nunca envía `codigoGeneracionR` (solo es correcto el tipo sin reemplazo); **no implementa plazos**; no marca `INVALIDADA`. «Se invalida siempre después de anular localmente» no lo controla la solución. | business-rules 7.2–7.6 |
| 5 Establecimiento y punto de venta | El número de control usa los códigos de **configuración de la instalación** (un establecimiento y un punto de venta por instalación); `CODESTABLE`/`CODPUNTOVE` del DBF solo viajan como códigos internos; `CODESTABMH`/`CODPUVENMH` del DBF no se leen. | business-rules 5.1–5.3 |
| 7 Versión de esquemas | v1: la versión sale de `FELECTRO.VERSION` (el ERP: 1 ó 3). v2: fija por tipo (01→2, 03→4, 05/06→4, 11→3, 14→2). Invalidación: v3 fija para todos; la `"02"` de `FANULAR` se ignora. **(norma)** contrastar. | business-rules 3 |
| 8 Remisión | Solo existe una rama en el camino v1 (y su PDF); no migrada a v2. El ERP no emite tipo 04. | business-rules 3 |
| 9 Compras recibidas por DTE | **No** forman parte de esta solución: solo emite; no recibe ni lee JSON de proveedores. Sigue pendiente en la plataforma nueva. | — |
| 10 Papel y PDF | La solución genera los PDF (una plantilla por tipo, ticket para CCF/consumidor final) con QR; diseño por cliente. La plataforma debe definir su propia plantilla. | business-rules 8.1–8.2 |
| 24–25 Número digitado / huecos | El correlativo del número de control **es** el número del ERP (últimos 8 dígitos): no hay contador propio ni detección de huecos. | business-rules 5 |
| Supuestos de iva64/cxc64 | Los libros de IVA enlazan por `NFACT_ENV + tipo` y leen `NCONTROL`/`CODGENERAC`/`SELLORE`: **confirmado** que la solución los escribe. `INVALIDADA`, `NUMVALIDAC` y `FHPROCESAM` nunca se escriben: si algún reporte los espera, siempre estarán vacíos. | data-model 1.1 |

## Preguntas nuevas

### A. Negocio / operación
1. **¿Cuántas instalaciones hay y cuántas empresas por instalación?** La documentación no da un número; lo sabe el Monitor. *Propuesta:* exportar `GET /api/instalaciones` (versión, normativa, ambiente) para planificar la migración por oleadas.
2. **¿Cuántos clientes siguen en normativa v1 y cuándo pasarán a v2?** El repositorio fija el 2026-12-01 como fecha de cumplimiento **(norma)**; hoy el cambio es manual por cliente. *Propuesta:* confirmar fecha con la norma vigente y no iniciar la migración de clientes entre noviembre y enero.
3. **¿Quién opera las instalaciones?** Si la máquina del cliente se apaga o el programa se cierra, no se factura. ¿Quién avisa? *Propuesta:* en la plataforma nueva, proceso en servidor con supervisión.
4. **¿Hay clientes con varios establecimientos o puntos de venta?** La solución soporta uno por instalación. *Propuesta:* tabla `dte_establishments`.
5. **¿Cómo se maneja una caída del MH o de Internet hoy?** No hay modo de contingencia; ¿se espera y se reintenta? ¿Alguna vez se emitió en contingencia **(norma)**? *Propuesta:* decidir el requisito antes de diseñar el módulo.
6. **¿Qué ocurre cuando se invalida un documento con reemplazo?** La solución no soporta tipos de anulación con documento de reemplazo. ¿Se necesitan? **(norma)**
7. **¿Se necesitan 07/08/09/15, Retorno u Operaciones especiales?** Hay esquemas empaquetados sin constructor.
8. **Plazos de invalidación:** no se validan. ¿Quién avisa al usuario? **(norma)**
9. **Correo:** un error de SMTP es definitivo; ¿quién reenvía? ¿Se debe reintentar? *Propuesta:* reintento con espera hasta 24 h.

### B. Contrato técnico con INV64
10. **¿INV64 reutiliza `NFACT_ENV` + `TIPODTE`?** La solución actualiza todas las filas con esa llave y avisa que «el ERP reutiliza `NFACT_ENV`». *Propuesta:* revisar qué hace el botón «Enviar F.Electro» con filas viejas y qué número de control resulta.
11. **`NLINEAS`:** ¿quién lo escribe y siempre coincide con el número de filas? Si no, el documento queda «Pendiente» para siempre sin aviso (hallazgo §2.15 abierto). *Propuesta:* verificar en el código de INV64 (la tabla lo tiene [D]) y exigir aviso en la solución.
12. **Longitud de `NFACT_ENV`:** el número de control exige 10 caracteres. ¿Es siempre así en los seis tipos? ¿Los últimos 8 dígitos son únicos por tipo?
13. **Importes:** la solución copia los importes sin recalcular; las diferencias de centavos de inv64 #11 viajan al MH. ¿Han provocado rechazos «CALCULO INCORRECTO»? *Propuesta:* revisar rechazos históricos en `EnviosDTE`.
14. **`IVARETLIN`:** el ERP lo llena (la tabla de INV64 lo tiene); ¿se llena con el valor por línea correcto en 05/06 o siempre en 0 (la solución lo reparte desde 1.13.3)?
15. **Motivo de rechazo:** el ERP solo ve `FALLO = 1`. ¿Cómo se entera el usuario de caja? *Propuesta:* plataforma nueva muestra el motivo en la pantalla del documento.
16. **Campos que la solución no escribe** (`INVALIDADA`, `NUMVALIDAC`, `FHPROCESAM`): ¿algún reporte del ERP o de IVA64 depende de ellos? Si es así, nunca funcionaron.
17. **Muestra del repositorio más antigua:** la muestra de la solución tiene 134 campos y la de INV64 144. ¿Hay clientes con la estructura vieja (sin `NLINEAS`, `IVARETLIN`…)? Para ellos el código falla por columna faltante. *Propuesta:* inventariar la estructura por cliente.

### C. Técnicas de la solución
18. **Historial SQLite silencioso (hallazgo §2.1):** una falla de escritura deja un DTE enviado sin registro. ¿Ha ocurrido? *Propuesta:* corregir antes de migrar para no perder histórico.
19. **Recuperación tras tiempo de espera:** se reintenta con UUID nuevo y mismo número de control → rechazo duplicado. *Propuesta:* en la plataforma nueva, consultar al MH por número de control/código antes de reenviar y reutilizar el código de generación.
20. **¿Quién crea `EnviosDTE` en una instalación nueva del cliente WPF?** El código solo agrega columnas; la base de partida viene del cliente WinForms.
21. **Token por documento (hallazgo §5.1):** ¿hubo limitaciones del MH (429) en lotes grandes? *Propuesta:* caché por (NIT, ambiente) en la plataforma nueva.
22. **QR con salto de línea (hallazgo §2.4):** ¿el QR impreso de clientes reales escanea bien? Verificar con un teléfono antes de copiar la URL a la plataforma nueva. El ERP imprime ese PNG en el ticket (inv64).
23. **Secretos en texto plano en `settings.json`:** ¿se aceptará mantenerlos así hasta migrar? *Propuesta:* cifrado por usuario de Windows o mover al almacén de secretos de la plataforma.
24. **Ticket PDF (`-t.pdf`):** solo lo genera el cliente WinForms legado. ¿Algún cliente lo necesita desde el cliente WPF? (el ERP imprime su propio ticket con el PNG).
25. **Cultura numérica:** los importes se leen con `decimal.TryParse` en la cultura de Windows de la máquina; ¿hay máquinas con configuración regional con coma decimal? Un importe mal leído viajaría mal. *Propuesta:* leer con cultura invariante en la plataforma nueva.
26. **Rama v1 de la remisión (04) y PDF:** ¿algún cliente la usa? Si no, la plataforma no la migra.
27. **Alcance de pruebas:** ≈540 casos xUnit; falta confirmar qué tipos de v1 (no solo v2) tienen validación contra esquema.
28. **Plataforma a migrar vs repositorio en cambio:** el repositorio está en cambio activo por la normativa v2; **Resuelta por la decisión del 2026-11-12:** no se requiere ningún cambio en ese repositorio (ya no hay fuente alternativa).

### D. Para la plataforma nueva
29. **Numeración (propuesta adoptada en el diseño, 2026-11-12):** ¿correlativo propio (con piso en el último número del ERP) o conservar «últimos 8 dígitos del número de documento»? *Propuesta:* correlativo propio por serie, asignado en transacción.
30. **Fuente alternativa (opción b) vs módulo propio (opción d):** **DECIDIDA el 2026-11-12 por el dueño:** módulo propio nativo (d) desde la fase de facturación; la opción b (puente) se descarta y no se integra con la solución .NET. Ver [contratos.md §6](../../sistema/contratos.md#6-documento-tributario-electrónico-dte).
31. **Histórico:** ¿cuántos años de documentos se migran, y los PDF se copian o se regeneran? *Propuesta:* migrar todo lo emitido en producción desde el inicio del DTE; copiar los PDF existentes (no regenerar: el PDF debe reproducir el original).
32. **Pendientes de lectura de este spec:** `DteBuilderV1`/cuerpo de línea (tributos por línea), plantillas PDF, telemetría y Estadísticas, CI, `tasks/prd-*.md`.

### E. Nuevas por la decisión de DTE nativo (2026-11-12)
33. **¿Quién hace la certificación en el ambiente de pruebas de Hacienda por cliente?** El módulo nativo debe ser aceptado por tipo de documento antes del piloto 2; cada cliente tiene su propio certificado y credenciales. *Propuesta:* la certifica el equipo de la plataforma una vez por tipo con una empresa de prueba, y por cliente solo se hace una corrida corta de verificación con sus credenciales.
34. **¿De dónde salen el certificado y las credenciales de cada cliente al migrar?** No se migran como datos (§5). *Propuesta:* el operador los carga al almacén de secretos de la plataforma en el corte, desde el certificado original del cliente (no desde `settings.json`), y se verifica con una firma de prueba.
35. **¿El servidor de cada cliente tiene Internet confiable?** La emisión es lo único que lo necesita. *Propuesta:* inventariarlo en la fase de preparación del cliente (Monitor, pregunta 1) y exigir un enlace mínimo; sin él, el cliente opera en cola y contingencia.
36. **Contingencia y plazos de invalidación en la norma vigente:** la solución de referencia no los implementa. *Propuesta:* leer la norma y los esquemas vigentes antes de construir; mientras tanto, plazos y tipos como datos en `dte_settings`, no en el código.
37. **Fecha de la normativa v2 (2026-12-01 según el repositorio):** el módulo nativo debe nacer en la normativa vigente cuando esté listo. *Propuesta:* verificar la fecha y construir solo la normativa que rija en producción; las diferencias v1/v2 se estudian desde los constructores de la solución.
38. **Corte por empresa y serie:** ¿cuál es el último número de control usado por cada serie, y quién verifica que la solución .NET dejó de emitir? *Propuesta:* el importador lo lee de `FELECTRO`/`EnviosDTE` y se confirma con el último documento aceptado en Hacienda antes de habilitar la emisión nativa.
39. **¿Se contabiliza la venta al grabar o al aceptarse el DTE, y se reutiliza el número de un documento rechazado?** Ver contratos §6.10. *Propuesta:* contabilizar al grabar (reverso si se descarta) y no reutilizar números.
