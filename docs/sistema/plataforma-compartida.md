# La capa compartida del sistema anterior (MCERP) y qué falta en la plataforma nueva

Qué comparten (o creen compartir) los ocho módulos: usuarios, permisos por pantalla, empresas, bitácora, archivos de
configuración `.MEM` y rutinas de uso común. Se leyó el código fuente de los ocho módulos porque ningún spec lo cubre
completo. El mapa de datos entre módulos está en [integracion-legado.md](integracion-legado.md).

> **Etiquetas.** **[V]** verificado por mí en el código fuente o en la estructura/conteos de los `.DBF` y `.MEM` al
> preparar este documento; **[S]** tomado de un spec de `docs/legacy/` sin repetir la verificación; **[I]** deducción mía.
> **Reglas de privacidad:** no aparecen filas de usuarios, claves ni verificadores, nombres de empresas, rutas con nombres
> de cliente ni valores de configuración; solo estructura, **nombres** de variable, tipos, conteos y textos de menú.
> `MCERP/` mezcla copias de clientes distintos: lo dicho del *código* vale siempre; lo dicho de *datos* vale para esa copia.

**Resumen en seis líneas**

1. No existe una "capa compartida" como tal: son **ocho copias independientes** de las mismas tablas y rutinas, que han
   divergido (§1, §6).
2. La clave de acceso se guarda como una **suma de códigos de carácter**, no como un hash; el control de acceso es un
   archivo `.DBF` que cualquiera con acceso a la carpeta puede editar (§1.3).
3. Los permisos son un **booleano por usuario y pantalla** (más cinco banderas de acción en tres módulos); el catálogo
   suma **630 claves** de pantalla entre los ocho módulos (§2).
4. La bitácora **no tiene empresa, módulo ni valores anterior/nuevo**, solo texto libre, y tres módulos no la usan (§4).
5. La configuración vive en **más de 40 archivos `.MEM` en tres niveles** (instalación, empresa, usuario), con los mismos
   nombres de variable repetidos en varios archivos y con unidades distintas (§5).
6. Lo que la plataforma nueva aún no tiene: permisos por acción, configuración por empresa, correlativos y estado de
   cierre compartido entre módulos (§7).

---

## 1. Usuarios y acceso

### 1.1 Las tablas: ocho copias, ninguna igual

Cada módulo tiene su `USUARIOS.DBF` en **su carpeta de programa** (junto al ejecutable), no en la de datos [V].
Todas comparten las cuatro primeras columnas (`USUARIO` C10, `REFERENCIA` N12.3, `NOMBRE` C40, `SP` L1); el resto
depende del módulo:

| Módulo | Vivos / borrados | Columnas | Columnas propias del módulo [V] |
|---|---|---|---|
| CONTAC | 4 / 0 | 8 | `SG` C8, `USRLVL` N2, `FECHAC` D, `FECHAM` D |
| BANCOC | 9 / 34 | 8 | `SG`, `USRLVL` N1, `USRTYPE` N1, `FECHAM` |
| INV64 | 3 / 0 | 13 | `SG`, `USRLVL`, `VE_COSTO` L, `CLAVE_INV` N12.3, `PERMI`, `PERMIA`, `PERMIAG`, `PERMIM` (L), `DUIUSER` C15 |
| IVA64 | 2 / 40 | 13 | `SG`, `USRLVL`, `USRTYPE`, `PERMPERMI` (sic), `PERMIA`, `PERMIAG`, `PERMIM`, `PERMI` |
| LOTE64 | 3 / 16 | 8 | `SG`, `USRLVL`, `USRTYPE`, `VE_COSTO` |
| cxc64 | 2 / 9 | 19 | banderas heredadas de planilla `MCXC, FACT, FACTR, FACTA, FACTF, FACTU, CXCM, CXCA, CXCR, CXCU`; `USRLVL`; `PERMI, PERMIA, PERMIAG, PERMIM`. **No tiene `SG`** |
| plan64 | 2 / 7 (`fuente`) y 4 / 0 (`dbf`, otra copia de 14 columnas) | 28 | las mismas banderas `MCXC…CXCU`, más `PRESTA, INGRE, ARTIC, DPRES`, `NIVEL1, NIVEL2, NIVELA, NIVEL3, NIVELP1, NIVELP2, NIVEL4`, `IMPRECIBO`, `CODEMP` C3, `DIVISION` C2. **No tiene `USRLVL`** |
| AFIJO64 | 4 / 20 | 7 | `SG`, `USRLVL`, `USRTYPE` |

Hallazgos con datos (solo conteos) [V]:

- **18 nombres de usuario distintos** en las ocho copias; 14 aparecen en un solo módulo, 2 en dos, 1 en tres y 1 en los ocho.
- De los 4 nombres presentes en más de un módulo, **2 tienen el mismo verificador de clave en todos y 2 no**; el nivel
  difiere entre módulos en 3 de los 4. Es decir: **cambiar la clave en un módulo no la cambia en los otros** y el mismo
  usuario puede ser Supervisor en uno y Consulta en otro.
- Muchos registros borrados (BANCOC 34, IVA64 40, AFIJO64 20): se crean y se borran usuarios con frecuencia, y el espacio
  se recupera solo con "Reindexar → Empacar" (§6.4).
- El archivo `.MEM` por usuario depende del **número de registro** del usuario en `USUARIOS` (§5, `MESACT.<n>`): si se
  empaca la tabla, los números cambian y el mes de trabajo de cada quien se desplaza.
- plan64 y cxc64 arrastran columnas de otros módulos (`MCXC…CXCU`) que ningún programa vivo lee [I].

### 1.2 El programa de acceso

Cada módulo trae `access.prg` (el programa principal), `intro.scx` (la pantalla de usuario y clave), `selemp.prg` (elige
empresa) y `acceso.scx`/`acceso2.scx` (mantenimiento de usuarios). **Los ocho `access.prg` son distintos entre sí** (el
cotejo de archivos da ocho versiones por módulo, igual que `selemp.prg` y `intro.scx`) [V]. Secuencia en CONTAC, igual en
espíritu en los demás [V]:

1. Restaura `DRIVE.MEM`, `MESACT`, `MESES`, el `.MEM` de configuración del módulo y `EMPRESA.MEM` (§5).
2. Abre `EMPRESAS` con candado de tabla (`FLOCK` en bucle), y en **cada arranque** vuelve a escribir en la tabla compartida
   los campos `EMPRESA` y `NUMEMPRE` de todas sus filas. Si `EMPRESA.MEM` define un arreglo `emp`, compara empresa y siglas
   y avisa "Violación a la Integridad del sistema…" si no coinciden; esa comprobación existe en los ocho `access.prg` pero
   en la copia de CONTAC queda inactiva porque el arreglo no está definido (parece un gancho de licencia) [V + I].
3. Arma `SET PATH` con la carpeta de datos y las de integración (ver integracion-legado §1.2).
4. Si `USUARIOS` no tiene registros vivos **abre la pantalla de creación de usuarios sin pedir credenciales**
   ("NO HAY USUARIOS ASIGNADOS") [V].
5. Muestra `intro.scx` hasta **4 veces** (`DO WHILE entradas <= 3`): código de usuario → `SEEK` en `USUARIOS` ("Usuario no
   Existe !!!"); clave → cálculo del verificador y comparación con `USUARIOS.REFERENCIA` ("Clave Incorrecta !!!").
   Al cuarto fallo el programa termina. **No hay contador persistente, ni bloqueo de la cuenta, ni retraso entre intentos** [V].
6. Con la clave correcta lee el registro (`SCATTER MEMVAR`: nivel, banderas), guarda `usr` = número de registro del
   usuario y llama a `selemp` (§3) y luego al menú principal.
7. **El ingreso y la salida no se registran en `BITACORA`** [V].

`plan64` tiene una pantalla principal distinta (`plintro3.scx`) y no usa `USRLVL`; el resto igual.

### 1.3 Cómo se guarda y se valida la clave

- Esquema [V, `intro.scx` y `valida.prg`]: la clave tecleada se recorta, se le **agrega al final un literal fijo de cinco
  letras escrito en el código** (el mismo en los ocho módulos), y se calcula `Σ ASCII de cada carácter + redondeo(longitud/100, 2)`.
  Ese número se guarda en `USUARIOS.REFERENCIA` (N12.3) y se compara con `=`.
- Es un **verificador aditivo, no un hash criptográfico**: dos claves con los mismos caracteres en distinto orden dan el
  mismo valor, el valor revela la longitud, y cualquiera que pueda escribir el `.DBF` puede fijar la clave de cualquiera
  escribiendo un número (no hace falta conocer la clave anterior).
- Alta o cambio: `acceso.scx` (supervisor) pide la clave dos veces (`valida(1)`/`valida(2)`) **sin aplicar la política de
  complejidad**; `acceso2.scx` (cada usuario, "Mantenimiento de Usuarios" para cambiar la propia clave) sí aplica `valipwd.prg`:
  mínimo **6 caracteres**, **sin espacios**, **sin dos caracteres consecutivos en el alfabeto** (±1 en ASCII) y **sin el mismo
  carácter dos veces seguidas**; **no pide la clave anterior** [V].
- **Vencimiento de clave: no existe.** Hay un bloque que forzaba el cambio tras 90 días con `FECHAM`, pero está comentado
  en `access.prg` [V]. `FECHAC`/`FECHAM` solo existen en CONTAC y BANCOC.
- Claves de "cierre" y de "pantallas especiales": no son del usuario. Están en texto plano en archivos `.MEM`
  (`CLAVE.MEM`, `SEGUIR.MEM`, variable `CLAVE`, tipo carácter) en INV64 y cxc64, y, según el spec, `INV64\clave.scx` compara contra las
  claves de *cualquier* usuario [S]. INV64 tiene además un segundo verificador numérico `USUARIOS.CLAVE_INV` [V].

### 1.4 Niveles de usuario (`USRLVL`) y qué hace cada uno en el código

| Valor | Etiqueta (combo de `acceso`) | Lo que realmente cambia [V] |
|---|---|---|
| 1 | Supervisor | Es el **único** que abre el mantenimiento de usuarios, empresas por usuario y perfil (el menú distingue `usrlvl = 1` → `acceso`, otro → `acceso2`; salvo plan64, que lo controla por `PERFIL`). En INV64/cxc64 salta las banderas de acción (`If usrlvl<>1 And !m.permiag …`) y es el único que elimina o anula ciertos documentos ("Unicamente el Supervisor puede Eliminar") |
| 2 | Digitador y Consulta | Sin tratamiento propio en CONTAC, BANCOC, INV64, cxc64. En IVA64/LOTE64/AFIJO64 participa en `BETWEEN(usrlvl,1,3)` (puede reindexar) |
| 3 | Digitador | Igual que 2, salvo IVA64: **oculta** los tres libros legales y los archivos de Hacienda (`SKIP FOR BETWEEN(m.usrlvl,3,3)`) |
| 4 | Consulta | `valibot.prg` (BANCOC, INV64) **deshabilita** Agregar, Modificar y Eliminar en las pantallas estándar (`if m.usrlvl>=4`); en CONTAC el menú omite "Catálogo de Cuentas" y "Tipos de Comprob." |

Otros ejes que no son el nivel:

- `USRTYPE` (BANCOC, IVA64, LOTE64, AFIJO64): `usrtype = 2` oculta opciones de menú (en IVA64 "Ventas Crédito Fiscal"; en
  LOTE64 tres opciones) [V]. Su significado de negocio no está documentado.
- `VE_COSTO` (INV64, LOTE64): "puede ver costos" (se guarda en `vcosto`) [V + S].
- Banderas de acción `PERMI` (eliminar), `PERMIA` (anular), `PERMIAG` (agregar), `PERMIM` (modificar) en INV64, cxc64 e
  IVA64; en IVA64 **ninguna pantalla las consulta** [V]. Tienen versión por usuario (en `USUARIOS`, cargada al entrar) y por
  pantalla (en `PERFIL`, copiada al abrir ciertas opciones; ver §2.4).
- plan64: `NIVEL1…NIVEL4`, `NIVELA`, `NIVELP1/2` (autorizaciones jerárquicas de la planilla: "Autorización Auditoría",
  "Gte. de Restaurantes/Directores", "RRHH"…), `IMPRECIBO`, `CODEMP`/`DIVISION` (alcance por patrono y división) [V captions].

### 1.5 La pantalla "Usuarios"

`acceso.scx` ("Crear Usuarios"): barra Anterior / Siguiente / Modificar / Eliminar / Agregar / Salir; campos Usuario, Nombre,
Clave, Nivel de Acceso (combo de cuatro textos), fechas de creación y modificación; botones **Empresas** (abre `cnempre`: rejilla
Empresa / Nombre / Permiso sobre `USREMP`) y **Perfil** (abre `cnperfil`: rejilla de `PERFIL`, §2.3) [V]. Efectos al grabar:

- **Alta:** crea en `USREMP` una fila **por cada empresa** con `PERMISO` falso (queda sin acceso hasta que el supervisor lo
  active) y copia en `PERFIL` **todas las pantallas del primer usuario de la tabla con `PERMISO = .F.`** (el catálogo de
  pantallas se hereda del primer usuario; si una opción nueva no está en esas filas, nadie la tiene hasta que se agregue a mano) [V].
- **Eliminar:** marca borrado el registro, borra sus filas de `USREMP` y `PERFIL` [V].
- Todo se anota en `BITACORA` ("Mantenimiento de Usuarios": agregó / modificó / modificó su usuario) [V].
- Quién puede abrir "Usuarios": `usrlvl = 1` en CONTAC, INV64 y cxc64; `between(m.usrlvl,1,1)` en BANCOC, IVA64, LOTE64 y AFIJO64; en **plan64, que no tiene nivel, la opción se controla con la clave `acceso` de `PERFIL`** [V]. Quien no cumple abre `acceso2` (cambiar su propia clave) donde existe.

---

## 2. Permisos por pantalla (`PERFIL`)

### 2.1 Estructura

`PERFIL.DBF`, una por módulo, en la carpeta de programa [V]:

| Módulo | Columnas | Filas vivas (borradas) | Usuarios con filas | **Claves de pantalla distintas** | Opciones de menú con control | Claves en `PERFIL` y no en el menú |
|---|---|---|---|---|---|---|
| CONTAC | `USUARIO` C10, `DESCRIP` C60, `PROGRAMA` C15, `PERMISO` L | 205 (264) | 4 | **57** | 54 | 4 |
| BANCOC | las mismas 4 | 424 (**66,768**) | 10 | **47** | 47 | 2 |
| INV64 | 4 + `PERMI, PERMIA, PERMIAG, PERMIM` | 513 (9) | 3 | **191** | 180 | 15 |
| IVA64 | 4 + las 4 banderas | 88 (46) | 2 | **45** | 45 | 2 |
| LOTE64 | 4 | 89 (16) | 4 | **32** | 32 | 0 |
| cxc64 | 4 + `PERMI, PERMIAG, PERMIM, PERMIE, PERMIA` (`PERMIE` no se usa) | 220 (760) | 2 | **113** | 112 | 3 |
| plan64 | 4 | 266 (2) | 2 | **134** | 122 | 13 |
| AFIJO64 | 4 | 11 (109) | 1 | **11** | 11 | 0 |
| **Total** | | | | **630** | | |

- La suma de 630 cuenta claves *por módulo*: varias se repiten (`reindex`, `sbmemp01`, `ccpartco`…) con **código distinto
  detrás**. Ejemplo verificado: la clave `ccpartco` es "Generar Partida de Depreciación" en AFIJO64, "Generar Partida de
  Costo" en INV64 y "Generar Partida Contable" en LOTE64; son tres programas con el mismo nombre y tres versiones distintas
  del archivo [V]. Por eso **no se puede deducir la funcionalidad por el nombre de la clave**.
- La clave (`PROGRAMA`) es el nombre del formulario/programa que abre la opción, no un identificador funcional.
- `DESCRIP` guarda el texto de la opción.
- BANCOC tiene 66,768 filas borradas (5.8 MB): se reescribe el perfil borrando e insertando [I]; es el mayor `PERFIL` del sistema en bytes.
- **No hay columna de empresa**: el permiso es por usuario y módulo, igual para todas las empresas. Lo único por empresa es
  `USREMP.PERMISO` (¿puede el usuario trabajar en esa empresa?) [V].

### 2.2 Cómo una opción de menú revisa el permiso (patrón exacto)

Todos los menús `.mpr` (generados desde `.mnx`) repiten un procedimiento por opción [V] (los comentarios `&&` son míos):

```foxpro
PROCEDURE _<id>
IF nomoros()                      && no abre otra opción si hay una tabla abierta
   if !used("PERFIL")
      use PERFIL order tag usuario in 0
   endif
   VARP=SPACE(15)
   VARP="cgmcat01"                && clave de la pantalla
   SELE PERFIL
   SEEK(USRV+VARP)                && llave: usuario(10) + programa(15)
   IF permiso
        sele PERFIL
        use
        DO cgmcat01.spr            && abre la pantalla
   ELSE
      WAIT WIND "Lo siento no tiene Acceso a esta opción"
   ENDIF
ENDIF
CLOSE data
```

- Si el `SEEK` no encuentra fila, `permiso` queda en falso y la opción **niega** (caso `copycat` en CONTAC, `ivarcoa` en
  IVA64, `sbmcon` y `bitacora` en BANCOC, `inrtmov, inrvent, inultcom, inrmovi` en INV64) [V].
- La llave usa `SEEK` sin `SET EXACT`, por lo que una clave más corta es prefijo de otra: IVA64 consulta `ivacierr` y la
  fila se llama `ivacierre` y funciona por coincidencia parcial [V].
- Las claves sin control: *Seleccionar Mes de Trabajo*, *Seleccionar Empresa*, *Usuarios* (se limita por nivel 1), en
  CONTAC los dos "Estado de Resultado Definido", en INV64 "Detalle del Pedido", "Crédito Fiscal" y "Consumidor final" (abren
  sub-menús), en LOTE64 "Rendimientos", en planilla "Cierre", "Generación de Planilla Única" y "Autorización de Llaves"
  (esta última revisa dentro de sus sub-pantallas) [V]. BANCOC, LOTE64 y AFIJO64 tienen además una barra con texto de separador (`\-`) que llama a `sbmcor01` (inicializa la tabla `CORREL` de correlativos) sin revisar `PERFIL`; al ser un separador no parece alcanzable [V + I].
- **El permiso se comprueba solo en el menú.** Las pantallas llamadas desde otras pantallas (por ejemplo `ivacomp2` desde
  "Ingresar al IVA", `qwcque01` desde un cheque) **no revisan `PERFIL`**, de modo que quien tiene acceso a la pantalla
  origen llega a la destino [V].
- En INV64 y cxc64, el procedimiento de **algunas** opciones, justo antes de abrir, copia las banderas de acción de la fila:
  `m.permi = PERFIL.permi`, `m.permia`, `m.permiag`, `m.permim` (INV64: 24 de 192 opciones; cxc64: 29 de 116). Las demás
  conservan las banderas que se cargaron al entrar desde `USUARIOS` [V].

### 2.3 Valores y significado

| Campo | Significado en el código | Dónde se aplica |
|---|---|---|
| `PERMISO` | Puede **abrir** la pantalla | Siempre, en el menú |
| `PERMIAG` | **Agregar** ("No tiene permiso para Crear…") | Dentro de la pantalla de captura (INV64, cxc64) |
| `PERMIM` | **Modificar** ("No tiene Permiso de MODIFICAR") | ídem |
| `PERMI` | **Eliminar** ("No tiene permisos para Eliminar") | ídem |
| `PERMIA` | **Anular** | ídem |
| `PERMIE` | sin uso | — |

Los rótulos de la rejilla de `cnperfil` en INV64/cxc64 son exactamente: Usuario, Opción, Permiso, Agregar, Modificar, Eliminar,
Anular [V]. En los otros seis módulos la rejilla solo muestra Usuario, Opción y Permiso.

### 2.4 Cómo se combina con el nivel

Regla efectiva [V]: **abrir la opción** requiere `PERFIL.PERMISO`; **actuar** dentro de la opción requiere (en INV64/cxc64)
`usrlvl = 1` **o** la bandera de acción; en el resto de módulos no hay segunda comprobación salvo que `usrlvl >= 4` desactiva
los botones de captura (`valibot`). Es decir, el nivel 4 (Consulta) es una restricción de *interfaz* y puede saltarse si
`PERFIL` le da acceso a una pantalla que no usa `valibot`; el nivel 1 salta las banderas pero no `PERFIL.PERMISO`.

### 2.5 Mantenimiento

`cnperfil.scx` ("Crear Perfil de Usuarios"; seleccionar usuario con `*`, rejilla editable, "Grabar"/"Cancelar") [V]. No hay
plantillas, herencia de roles ni copia de perfil entre usuarios (excepto la clonación del alta, §1.5). Ver en la
pantalla Usuarios el botón "Perfil".

---

## 3. Empresas (`EMPRESAS`, `USREMP`)

### 3.1 Estructura y copias

`EMPRESAS.DBF` vive en la carpeta de programa de cada módulo y trae **una fila viva en los ocho** (CONTAC y cxc64 con
filas borradas) [V]. Las columnas varían entre 9 y 40:

| Módulo | Cols. | Grupos de campos [V] |
|---|---|---|
| CONTAC | 15 | `EMPRESA`, `SIGLAS` C8 (código), `CAMINO` (carpeta de datos), `EMPRE2` (nombre), `NUMEMPRE`, `CONSOLIDA`, `CONSO`, `MONEDA` N1, `NIV`, `DIGITO` (nivel y dígitos del catálogo), `VENTANA`, `CONVALOR` ("Valores en"), `FILTRO`, `CAMINOIVA`, `GRANDE` |
| BANCOC | 15 | núcleo + `IVA` (ruta), `GRANDE`, `FRETENP/FRETENI/FORMARP/FORMARI` (formatos de retención y recibo) |
| INV64 | 40 | núcleo + `CXC`, `BANCOS`, `LOTE`, `RUTAINV`, `RUTAFOTO`, `RUTAPDF` (rutas); `NIT`, `REGISTRO`, `ACT_ECO`, `FDEP`, `FMUN`, `EMAIL`, `GIRO`, `NCOMERCIAL`, `DIRECCION`, `TELEFONO`, `LOGO`; `TIVA` (IVA), `PERCIBIR`, `CVINETA`, `DESCUENTOT`, `DBLOCCXC`, `MODOOP` (modo DTE); formatos `FORMACF, FORMAFA, FORMANC, FORMANA, FORMARE, FORMAEXP, FORMAEGRE` |
| cxc64 | 13 | núcleo + `CAMINO2`, `CAMINOINV`, `TELEFONO`, `GRANDE`, `FORMANC`, `FORMAND` |
| IVA64 | 28 | núcleo + `INTEGRA`, `INTEGRAP`, `RUTAINV`, `NIT`, `REGISTRO`, `GRANDE`, `MONEDA`, series y resoluciones por tipo (`FASERIE/FARESOLU`, `CFSERIE/CFRESOLU`, `EXSERIE/EXRESOLU`), `FORMAEXCL`, `ACT_ECO`, `FDEP`, `FMUN`, `EMAIL` |
| LOTE64 | 10 | núcleo + `INTEGRA`, `CONTA`, `CVINETA` |
| AFIJO64 | 9 | núcleo + `INTEGRA`, `CONTA` |
| plan64 | 19 | núcleo + `CAMINO2`, `CAMINOIVA`, `CUENTA`, `ISSSPAT` (número patronal de ISSS), `DIRECCION`, `TELEFONO`, `DEPTO`, `MUNICIPIO`, `NIT`, `GIRO`, `REGISTRO`, `VENTANA`, `MONEDA` C200 (leyenda "valores expresados en…") |

- "Núcleo" = `EMPRESA, SIGLAS, CAMINO, EMPRE2, NUMEMPRE` (+ en seis módulos `CONSOLIDA, CONSO`).
- **Datos fiscales de la empresa** (NIT, NRC, giro, actividad económica, series y resoluciones) están repartidos: INV64,
  IVA64 y planilla los guardan; CONTAC, BANCOC, cxc64, LOTE64 y AFIJO64 no. No hay una ficha única de empresa.
- `USREMP` (usuario ↔ empresa): `SIGLASE` C8, `USUARIOE` C10, `PERMISO` L [V]. Conteos vivos en integracion-legado §2.6.
  No existe en LOTE64 ni AFIJO64: su `selemp` filtra las empresas con un arreglo `bus` guardado en un `.MEM` por usuario (`BC<n>.MEM`), un mecanismo anterior a `USREMP` [V].
- **Moneda:** `MONEDA` es un código numérico en CONTAC e IVA64 y un texto de leyenda en planilla; BANCOC maneja 5 códigos de
  moneda por cuenta en `MONEDA.MEM` (arreglos `MO`, `MOSIMB`, `MOTASA`) [V]. Los libros imprimen la leyenda según el
  código (IVA64: "colones" si vale 1, "dólares" en otro caso) y **no convierten importes** [S].
- **Consolidación:** `CONSOLIDA`/`CONSO` existen en seis módulos y **ningún programa los lee** fuera de las pantallas de
  empresas [V]. La "Partida Consolidada" de CONTAC es un reporte de una sola empresa (integracion-legado §7).

### 3.2 Cómo se elige la empresa al entrar (`selemp.prg`)

Hay ocho versiones del programa. Comportamiento común [V]:

1. Abre `EMPRESAS` (índice por `SIGLAS`) y `USREMP`.
2. Recorre `USREMP` con filtro `usuarioe = usuario .and. permiso` y **escribe la bandera `EMPRESAS.FILTRO`** (`.F.` a todas, `.T.`
   a las permitidas) para filtrar la lista. **La bandera está en la tabla compartida**, no en la sesión: dos usuarios entrando a
   la vez se pisan el filtro [V + I].
3. Si queda más de una empresa, muestra una rejilla (código y nombre) y, al elegir, guarda la elección en `USUARIOS.SG`
   (última empresa). Con una sola empresa no pregunta [V].
4. Copia la fila a variables de memoria (`SCATTER MEMVAR`): `camino`, rutas de integración, `moneda2`, `niv2`, `digito2`,
   `convalor`, `grandex` y, en INV64, ~25 variables de formatos, textos fiscales y modo DTE.
5. Normaliza rutas (agrega `\`), restaura `DRIVE.MEM` y arma `SET PATH` (integracion-legado §1.2).
6. Restaura `MESACT.<n>` desde la **carpeta de datos de la empresa** (si no existe, copia `MESACT.MEM` como plantilla) y
   el `.MEM` de configuración de esa empresa (§5).
7. Lee `PERIODO` para el nombre del período fiscal (CONTAC).

Cambiar de empresa en un módulo **no cambia la del otro**: cada módulo es otro proceso con su propia sesión.

### 3.3 Cómo se crea una empresa nueva

`Mantenimiento de Empresas` (CONTAC `cgmemp01`; `sbmemp01` en los demás; planilla `plmemp2`) [V]:

1. Se captura una fila de `EMPRESAS` (incluida la ruta `CAMINO` de la carpeta que no existe aún).
2. `creaemp.prg` (siete módulos) ejecuta `MD <ruta>`, y para **cada `*.DBF` de la carpeta de la *primera* empresa** hace
   `COPY STRUCTURE … WITH CDX` (estructura vacía; **`TIPOPAR` se copia con datos**), y copia **todos los `*.MEM`**.
3. Anota en `BITACORA`. **No** crea las filas de `USREMP`: el supervisor debe darlas de alta en "Usuarios → Empresas" [V].
4. En BANCOC la llamada a `creaemp` está comentada (`*=creaemp(m.camino)`): ahí solo se crea la fila [V].

Consecuencias: una empresa nueva hereda la configuración (incluidas cuentas y tasas) de la primera; la creación en un
módulo no existe en los demás (hay que repetirla ocho veces, con carpeta distinta cada una, y mantener la misma `SIGLAS`);
en CONTAC la carpeta clonada incluye las tablas de Bancos y CxP porque comparten carpeta [V].

---

## 4. Bitácora (`BITACORA`)

### 4.1 Estructura

`USUARIO` C10, `FECHA` D, `PROGRAMA` C50, `CONCEPTO` C190, `HORA` C10 [V]. **Sin empresa, sin módulo, sin tabla/registro
afectado, sin valor anterior ni nuevo, sin identificador.** `PROGRAMA` es el nombre de la pantalla en texto ("Mantenimiento
de Clientes", "Cierre Mensual"…); `CONCEPTO` es una frase ("Agregó al Cliente <código> <nombre>").

### 4.2 Quién la escribe (pantallas vivas que agregan una fila) [V]

| Módulo | Tabla | Pantallas que registran | Qué **no** registra |
|---|---|---|---|
| CONTAC | 41 filas | 12 (+ el buscador `verbita`): usuarios, cierre y apertura de mes, cierre anual, copiar partida, cambiar número de partida, catálogo, tipos, empresas, estados, períodos | Alta, cambio y baja de **partidas** en sí (`cgmpar01` no la escribe), "Cambiar número a una cuenta", ingreso y salida |
| BANCOC | 117 | 12 (+ `verbita`): bancos, cuentas, tipos de transacción, monedas, sucursales, proveedores, tipos de comprobante, compras al crédito, notas de crédito/débito, cancelaciones, reindexar, usuarios | **Documentos bancarios** (`sbmdoc01`), provisión, conciliación, impresión de cheques |
| INV64 | 404 vivas (23,203 borradas) | 21: clientes, geografía, ND, maestro de artículos, movimientos de inventario (`inmmov02`), exportaciones, apertura de mes, sujeto excluido… | Facturas (CCF y consumidor final), `inmmov01/03/05` |
| cxc64 | **23,455** | 32: todas las pantallas de movimiento (facturas, notas, abonos, cargos), catálogos y liquidaciones | Cierre de mes, generación de partidas [I] |
| IVA64 | 335 (23,203 borradas) | 13: captura de los tres libros, renta, **traslados**, cierre/apertura | Archivos para Hacienda |
| LOTE64 | no existe la tabla | 1 (`lpmlote`) | Casi todo |
| AFIJO64 | no existe | 0 | Todo |
| plan64 | no existe | 0 (tiene `plbitaau`, bitácora de **aumentos salariales** como reporte propio) | Todo |

- INV64 e IVA64 tienen exactamente el mismo número de filas borradas (23,203) y cxc64 tiene 23,455 vivas: la tabla de uno
  parece haberse clonado y "vaciado" en los otros [I].
- No hay política de retención, ni protección contra borrado, ni firma: `BITACORA.DBF` es una tabla editable.

### 4.3 Consulta

`bitacora.scx` + reporte `bitacora.frx`, **solo en los proyectos de CONTAC y BANCOC**: filtro "Todos los usuarios" o "Un
usuario" y rango de fechas; no filtra por pantalla ni por empresa [V]. Además `verbita.prg` busca un texto dentro de `CONCEPTO` (`LIKE %texto%`), usado como buscador desde pantallas de CONTAC y BANCOC [V]. cxc64, INV64 e IVA64 escriben la bitácora
pero **no traen pantalla de consulta**.

---

## 5. Archivos de configuración (`.MEM`)

### 5.1 Cómo funciona el mecanismo

`SAVE ALL LIKE cfg*.* TO <archivo>` guarda en un `.MEM` todas las variables que empiezan con `cfg`; `RESTORE FROM <archivo> ADDITIVE`
las carga **sin borrar las existentes**, de modo que **el último archivo restaurado gana** cuando dos traen la misma variable.
Hay tres niveles [V]:

| Nivel | Dónde está | Ejemplo | Cuándo se carga / guarda |
|---|---|---|---|
| **Instalación** | carpeta de programa del módulo | `DRIVE.MEM`, `EMPRESA.MEM`, `MESES.MEM`, `CANTS.MEM`, `CONTACFG.MEM`, `IVA.MEM`, `CONFIG.MEM` (planilla, cuando no hay copia en la carpeta de datos) | `access.prg` al iniciar; guardadas por la pantalla de configuración |
| **Empresa** | carpeta de datos (`m.camino`) | `BANCOCFG.MEM`, `IVACFG.MEM`, `BASE.MEM`, `CXCCFG.MEM`, `CUENTAS.MEM`, `FIRMAS.MEM`, `CONCILIA.MEM` | `selemp.prg` (cada vez que se elige empresa) y `access.prg`; las guardan `config2.scx` y equivalentes |
| **Usuario (y empresa)** | carpeta de datos | `MESACT.<n>` | `selemp.prg`/`access.prg`; las guarda "Seleccionar Mes de Trabajo" |

Además hay **volcados de sesión** (`B01.MEM`…, `C005.MEM`, `BB20.MEM`…, `RETENER.MEM`, `SAVE.MEM`, un `IVA.MEM` en IVA64) hechos
con `SAVE TO` sin filtro: contienen *todas* las variables de la sesión (usuario, rutas, cuentas…) y no son configuración. El
`IVA.MEM` de IVA64 es de este tipo (lleva las variables `NIT`, `REGISTRO`, `CAMINO`, además de `ivax`) [V, solo nombres].

### 5.2 Inventario de configuración por módulo

Solo nombres de variable. Tipos: C = carácter, N = numérico, L = lógico, A = arreglo. "Propósito" tomado de un spec es
**[S]**; el deducido del nombre es **[I]**.

**a) `BANCOCFG.MEM`** (empresa; en `CONTAC\dbf`, compartido por CONTAC y BANCOC; plantillas del mismo nombre en AFIJO64/LOTE64/INV64) [V]

| Variable | Tipo | Propósito |
|---|---|---|
| `cfg_conta` | L | Trabajar integrado a Contabilidad [S] |
| `cfg_prove` | L | Trabajar con Cuentas por Pagar [S] |
| `cfg_l_iva` | L | Pasar al libro de IVA de compras [S] |
| `cfg_bancos` | L | Integración de correlativos de partida con Bancos [S] |
| `cfg_cuadre` | L | Exigir partidas cuadradas (solo en la copia de CONTAC; BANCOC no la consulta) [S] |
| `cfg_iva` | N | Tasa de IVA, **en porcentaje** [S] |
| `cfg_ivare`, `cfg_ivape`, `cfg_ivaan` | N | Tasas de IVA retenido, percibido y anticipo a cuenta [S] |
| `cfg_liof` | N | % del impuesto LIOF [S] |
| `cfg_iva_cf`, `cfg_iva_db`, `cfg_iva_re`, `cfg_iva_pe`, `cfg_renta`, `cfg_gasto` | C15 / C2 | Cuentas: IVA crédito fiscal, IVA débito, IVA retenido, IVA percibido, renta, gasto de impuesto [S] |
| `cfg_digcom` | N | Ancho del correlativo de partida [S] |
| `cfg_lineas`, `cfg_qlinea` | N | Líneas por voucher / por provisión [S] |
| `cfg_llave` | L | Restringir fecha de CxP al mes de trabajo [S] |
| `cfg_digique`, `cfg_hoja`, `cfg_formaq`, `cfg_quenum` | L/L/C/L | Captura de número de quedan, vista en hoja, formato del quedan [S/I] |
| `cfg_liqui`, `cfg_obra`, `cfg_porce`, `cfg_plazo`, `cfg_histo`, `cfg_prompt`, `cfg_confir`, `cfg_detali` | L/N | Clasificación de remesas, cheques a contratistas, interfaz (confirmar, histórico…) [S/I] |
| `cfg_piccue`, `cfg_firmas`, `cfg_firma2` | C | Máscara de la cuenta; texto de firmas al pie de los reportes [I] |
| `cfg_color`, `cfg_sound`, `cfg_tiempo` | N/C/N | Esquema de color, sonido, tiempo de espera de la interfaz [I] |

**b) `CONTACFG.MEM`** (**instalación**, carpeta de programa de CONTAC) [V]: `cfg_piccue` C18, `cfg_detali` L, `cfg_firmas` C131,
`cfg_confir` L, `cfg_color` N, `cfg_sound` C1, `cfg_tiempo` N, `cfg_bancos` L, `cfg_firma2` C132. (BANCOC e INV64 traen
variantes con `cfg_digcom`, `cfg_ong`, `cfg_pres`, `cfg_cksal`.) Otros de CONTAC: `FIRMAS.MEM` (arreglo 3×2: nombre y cargo de
quien firma), `MAYOR.MEM` (`nivmay`: nivel de mayorización), `PRESUME.MEM`/`MPRES.MEM` (marcas de presupuesto por mes),
`TIPOS.MEM`, `MODAR.MEM`, `CONCILIA.MEM` (`conci_f1…f5`: firmantes y fechas de la conciliación) [V].

**c) `IVACFG.MEM`** (empresa, `IVA64\dbf`; también se restaura en BANCOC desde esa carpeta) [V]: `cfg_iva`, `cfg_iva_cf`, `cfg_iva_db`,
`cfg_iva_re` (cuentas; **ningún programa de IVA64 las lee** [S]), `cfg_ivare`, `cfg_ivape`, `cfg_ivaan` (sí se usan). `FIRMAS.MEM` de IVA64: arreglo `firmas` (3×2). `IVA.MEM`
(IVA64, instalación): variable `ivax` (tasa de IVA, global) más el volcado de sesión.

**d) INV64** [V]: `BASE.MEM` (empresa) con ~60 variables `cfg_*`:
- numeración y captura: `cfg_orden` (orden de listados), `cfg_decima` (decimales), `cfg_lineas`, `cfg_linefa` (líneas por documento), `cfg_mascar` y `cfg_mask` (máscara del código de producto), `cfg_largo`, `cfg_auto`, `cfg_prefi1`, `cfg_prefij`, `cfg_prefijo` (prefijos), `cfg_pedido`;
- reglas: `cfg_exisbo` (validar existencias), `cfg_hayser`, `cfg_hayenv`, `cfg_hayuni`, `cfg_existe`, `cfg_bonus`, `cfg_barra`, `cfg_repmar`, `cfg_activa` (cuántas bodegas), `cfg_costo`, `cfg_blocxc` (bloqueo por mora), `cfg_prom` [I];
- impuestos: `cfg_iva` (**factor** 1 + tasa/100, distinto del porcentaje de `BANCOCFG`), `cfg_perci` (% percepción), `cfg_grava` (monto gravado mínimo para percibir), cuentas `cfg_ivafa`, `cfg_ivacf`, `cfg_ivacr` (IVA de consumidor final, crédito fiscal…), `cfg_iva_cf`, `cfg_iva_db`, `cfg_iva_re`, `cfg_iva_pe`, `cfg_renta`, `cfg_gasto`, `cfg_liof`, `cfg_ivare`, `cfg_ivape`, `cfg_ivaan`;
- contabilidad: `cfg_centro` (centro de costo único para sus partidas), `cfg_adm`, `cfg_vta`, `cfg_fin` (centros), `cfg_etiq` (cuenta de etiqueta/viñeta), `cfg_conta`, `cfg_prove`;
- interfaz: `cfg_color`, `cfg_sound`, `cfg_tiempo`, `cfg_firmas`, `cfg_firma2`, `cfg_piccue`, `cfg_bancos`, `cfg_formaq`.
Otros: `BODEGAS.MEM` (arreglo `bd`, 15 nombres de bodega), `COMVEN.MEM` (`comven`, % de comisión), `FIRORDE.MEM` (copia de `cfg_*` más `cfg_elabo`, `cfg_revie`, `cfg_revio`, `cfg_autor`: nombres que firman la orden de compra), `FACTCFG.MEM` (versión antigua de facturación: `cfg_repite`, `cfg_codsuc`, `cfg_bodega`, `cfg_valexi`, `cfg_inve`, `cfg_cxc`, `cfg_club`, `cfg_concf/confa/contk`, `cfg_formtk/formfa/formcf`, `cfg_cxctk/cxcfa/cxccf`, `cfg_ivatk/ivafa/ivacf`), `MOVI.MEM` (`nfa, nde, nab, nsr, ner`: prefijos de documento), `CLAVE.MEM`/`SEGUIR.MEM`/`SEGUIRA.MEM`/`CLAVES.MEM` (claves en texto plano). **Orden de carga:** `BASE.MEM` → (`bodega.MEM`: el código repite por error `&comando1` y nunca lo restaura) → `BANCOCFG.MEM` desde la carpeta de CONTAC, que pisa las variables repetidas [V].

**e) cxc64** [V]: `CXCCFG.MEM` (empresa): cuentas de IVA y banderas (`cfg_iva_cf`, `cfg_iva_cc`, `cfg_iva_cn`, `cfg_iva_re`, `cfg_iva_pe`, `cfg_repeti`, `cfg_conta`; en pantalla también `cfg_segu`, `cfg_mper`, `cfg_ivaper`, `cfg_iva_per`, `cfg_flete`) **más ~50 variables de planilla** (`cfg_salmin`, `cfg_rent1a…7d`, `cfg_isss…`) que ningún programa de cxc64 usa [V + I]. `IVA.MEM` (instalación): `ivax`. `COMI.MEM` (`c_contado, c_efectivo, c_chdia, c_chpos, c_chrecha`: % de comisión por forma de pago), `DESCU.MEM` (`d_isssrs, d_porrs, d_isssivm, d_porivm, d_fsv`: restos de planilla), `PAGOCO.MEM` (`cpor, comibu`), `LINEAS.MEM` (`linea1…5`: líneas de texto de encabezado), `SEGUIR.MEM` (`clave`), `DR.MEM`/`MESACT.<n>` (mes de trabajo).

**f) LOTE64** [V]: `CUENTAS.MEM` (empresa): `cfg_etiq`, `cfg_indi`, `cfg_maqu`, `cfg_mobr` (cuentas de etiqueta, indirectos, maquila y mano de obra) más un conjunto genérico `cfg_*` copiado de BANCOCFG; `MOVI.MEM`.

**g) plan64** [V]: `CONFIG.MEM` (~110 variables, **cargado al inicio desde la carpeta de programa y de nuevo desde la de datos si existe**; en esta copia solo está en `fuente`): `cfg_modo`, `cfg_salmin` (salario mínimo), tabla de renta quincenal/mensual `cfg_rent1a…cfg_rent7d` (7 tramos × 4 columnas), tablas anuales y de segunda quincena `cfg_ren1aa…cfg_ren7ds` (nombres con sufijos `AA, BA, CA, DA, AS, BS, CS, DS`), `cfg_rentae`, `cfg_rentaex`, `cfg_rentag`, `cfg_incap`, `cfg_porcen`, `cfg_tope`, `cfg_isssem`/`cfg_issspa`, `cfg_ivm`/`cfg_ivmem`/`cfg_ivmpa`, `cfg_fsv`/`cfg_fsvem`/`cfg_fsvpa`, `cfg_jub`, `cfg_seguro`, `cfg_segfam`, `cfg_hextdi`, `cfg_hextno`, `cfg_afppat`, `cfg_afpemp`, `cfg_afppaj`, `cfg_max`, `cfg_maxi`, `cfg_insafo`, `cfg_ipfa`, `cfg_ipfemp`, `cfg_ipfpat`, `cfg_gpo1`, `cfg_gpo2`, `cfg_q`. Todas son tasas, topes y tablas **sin fecha de vigencia ni historial** [S]. Otros: `ACTIVO.MEM` (`libre`), `PORVACA.MEM` (`porce`: % de vacaciones), `LINEAS.MEM`, `FIRMAS.MEM` (`varp`, `varcargo`, `varfirma`), `DRIVE.MEM` (`drive`, `drive1…3`).

**h) AFIJO64** [V]: no tiene configuración contable propia (las cuentas viajan en cada activo); plantilla `BANCOCFG.MEM`, `MOVI.MEM` (`nombre`, `nfa`, `nde`), `EMPRESA.MEM`.

**i) BANCOC, otros archivos** [V]: `MONEDA.MEM` (arreglos `MO`, `MOSIMB`, `MOTASA` y `MOCUENTA`: 5 monedas, símbolo y tasa), `TCTA.MEM` (tipos de cuenta bancaria), `TCOMP.MEM` (tipos de comprobante), `PARTIDA.MEM` (`ctacarg`, `ctaabon`, `ctacon1`, `ctacon2`: cuentas y conceptos por omisión), `NUMERO.MEM` (`mquedan`: último quedan), `PERIODO.MEM` (`p1…p4`, `porven`, `phsoft`: parámetros de vencimiento/antigüedad [I]), `COMPRA.MEM`/`COMPRA2.MEM` (`archiva, archian, archico, archiv`, `oklibro`), `IVA.MEM` (`viva`: factor de IVA).

**j) Comunes a los ocho:** `DRIVE.MEM` (`drive`: carpeta de trabajo), `EMPRESA.MEM` (`empresa`, `completo`; a veces `siglas`, `numero`, `empre`), `MESES.MEM`/`CANTS.MEM` (nombres de mes y cantidades en letras), `MESACT.<n>`.

### 5.3 Configuraciones que se repiten con valores posiblemente distintos

Variables con el mismo nombre en varios archivos, y cuál gana al cargarse [V]:

| Parámetro | Dónde está | Qué se comprobó |
|---|---|---|
| **Tasa de IVA** | `EMPRESAS.TIVA` (INV64); `BASE.MEM:cfg_iva` (factor); `BANCOCFG.MEM:cfg_iva` y `IVACFG.MEM:cfg_iva` (porcentaje); `IVA.MEM:ivax` (IVA64 y cxc64, global); `IVA.MEM:viva` (BANCOC, factor); constante `1.13` (4 reportes de INV64); constante `0.13` (17 sitios de los F987 y de `genarchi` en IVA64); etiqueta fija "13 % Retención" | En los archivos de ejecución de esta copia el porcentaje es el mismo en `BANCOCFG`, `IVACFG` y `ivax`, y `BASE.MEM` guarda el factor equivalente (1 + tasa/100): **coherente aquí, pero son 5 fuentes independientes y 21 sitios con la tasa escrita en el código** |
| **Tasas de IVA retenido, percibido y anticipo** | `BANCOCFG.MEM` y `IVACFG.MEM` (mismas variables `cfg_ivare`, `cfg_ivape`, `cfg_ivaan`); `BASE.MEM` | Iguales entre sí en los archivos de ejecución, salvo `cfg_ivaan` en el volcado `IVA.MEM` de IVA64, que difiere. BANCOC carga primero `BANCOCFG.MEM` y después `IVACFG.MEM` de la carpeta de IVA64: el segundo manda |
| **Cuenta de IVA crédito fiscal** (`cfg_iva_cf`) | `BANCOCFG.MEM` (CONTAC), `IVACFG.MEM` y `BANCOCFG.MEM` (IVA64/INV64), `BASE.MEM` (INV64), `CXCCFG.MEM` (cxc64); `CCTMOV` y `ARTICULO` guardan sus propias cuentas | **Cinco valores distintos** entre los archivos de ejecución del disco (coherente con copias de clientes distintos, pero muestra que la cuenta se configura por separado en cada módulo y no hay una fuente única) |
| Cuenta de IVA retenido (`cfg_iva_re`), percibido (`cfg_iva_pe`), renta, gasto de impuesto | ídem | Valores distintos o vacíos según el archivo |
| **LIOF** (`cfg_liof`) | `BANCOCFG.MEM`, `BASE.MEM` | La misma en esta copia; el umbral está en el código [S] |
| Centro de costo de las partidas | `cfg_centro` (CxC e INV64), literal fijo en las líneas de `ccpart*` de cxc64, centro de cada línea en CONTAC/BANCOC, `CCOSTOS`/`CCOSTOA` propios en planilla y activo | Cuatro mecanismos |
| Mes de trabajo | `MESACT.<n>` por usuario en cada carpeta de datos | cada módulo guarda el suyo (ver §6.1) |

### 5.4 Valores escritos en el código en vez de configuración

Verificados en el código [V] salvo donde se indica [S]:

- Tasa de IVA 13 %: `/1.13` en 4 reportes de INV64 (precio sin IVA); `*0.13` en 17 sitios de IVA64 (F987 v1-v3, `genarchi`).
- Naturaleza de las cuentas por tipo (deudoras 1, 4, 6; acreedoras 2, 3, 5, 7): escrita en `CGADIPAR` y en los reportes [V].
- Centro de costo literal en las líneas de las partidas de CxC [V].
- Umbrales de IVA64: 100 (percepción en ventas), 200 (consumidor final en F987), 0.10 (renta) [S].
- Umbral y tasa de LIOF: el umbral está en el código [S].
- Porcentajes de planilla (varios) y valores de 2025 en versiones muertas del cálculo [S].
- Letras de tipo de documento (`C0`, `C4`, `A0`…, `C/F/E/N/D/S`) y su significado [V/S].
- Número máximo de bodegas (15 columnas; `EXIST_ACT` suma solo 10) [S].
- Mensajes, formatos de reporte y colores.

---

## 6. Utilidades y convenciones que todos copian

No existe ninguna librería de clases (`.vcx`), ni `.fll`, ni `.ocx` en los ocho módulos [V]: cada uno lleva copias de los
mismos archivos, y esas copias han divergido. Archivos presentes en el proyecto de **los ocho** (y número de versiones
distintas del archivo, comparando contenido) [V]:

| Archivo | Para qué | Versiones |
|---|---|---|
| `access.prg`, `selemp.prg`, `intro.scx`, `acceso.scx`, `sino.scx`, `reindex.scx`, `simoros.scx` | arranque, empresa, login, usuarios, diálogo sí/no, reindexar, aviso de tablas abiertas | **8 cada uno** (todas distintas) |
| `ventana.prg` | ventana de selección tipo browse | 7 |
| `valibot.prg` | habilita/deshabilita botones de la barra (aplica `usrlvl >= 4`) | 6 |
| `valida.prg`, `chg_colo.prg`, `proteger.prg` | doble captura de clave, colores, espera de registro | 5 |
| `genxtab.prg`, `alerta.prg` | barra de progreso y tablas cruzadas, alerta | 4 |
| `nomoros.prg`, `ultimo.prg` | impide abrir otra opción con tablas abiertas; último día del mes | 3 |
| `veremp.prg` | buscador de empresas | 2 |
| `cgadipar.prg` | contabilización (siete módulos) | 5 (integracion-legado §4) |

### 6.1 Mes de trabajo

- Variable `mesact` (C6 `AAAAMM`; planilla C7 `AAAAMMQ` con la quincena), más `mesactt` (código de período fiscal) y `mesactc`
  (catálogo activo, CONTAC) [V].
- Se elige en "Seleccionar Mes de Trabajo" (`cgselmes`, `sbselmes`, `siselmes`: tres versiones) y se guarda en
  **`MESACT.<n>` en la carpeta de datos**, con `<n>` = número de registro del usuario en `USUARIOS` (3 dígitos; cxc64 antepone `V`) [V].
- Todas las pantallas de captura exigen que la fecha caiga en el mes de trabajo ("Año Incorrecto. Debe ser…", "Mes Incorrecto…").
- En CONTAC, elegir el mes además **reescribe `TIPOPAR.NUMERO`** (último número del mes + 1) con candado de tabla [V].
- Cada módulo guarda **su propio** mes de trabajo por usuario: el de CxC no es el de CONTAC, y `CGADIPAR` usa el del módulo
  que llama (integracion-legado §4.3).

### 6.2 Barra de herramientas y navegación

No hay clase de barra: la fila de botones Anterior / Siguiente / Agregar / Modificar / Eliminar / Grabar / Cancelar /
Imprimir se **replica en cada formulario** como grupos de botones (`cmgOpc…`) y los habilita `valibot.prg` [V]. Hay
"Buscar" (`*` en un campo abre un browse con `ventana`), "Finalizar", "Mes de Trabajo". La barra y la caja de totales/
Diferencia de partidas están descritas en `contac/README.md`.

### 6.3 Bloqueo y concurrencia

- `SET EXCLUSIVE OFF` en todos; `SET MULTILOCKS ON` solo en CONTAC; `SET DELETED ON` y `SET SAFETY OFF` en el arranque [V].
- `proteger.prg`: bucle que espera el `RLOCK` con una animación, **sin límite de tiempo**; `FLOCK` en bucle (`DO WHILE !FLOCK()`)
  en `cgadipar` (algunas versiones), `EMPRESAS` y `TIPOPAR` [V].
- **Ninguna `BEGIN TRANSACTION`, ningún `TABLEUPDATE`, ningún buffering** en los ocho módulos [V]. Un fallo a medio grabado
  deja tablas a medias; el único "rollback" es borrar a mano.
- Números de documento: `máximo + 1` leído sin candado (`signum`, "último + 1"); dos terminales pueden proponer el mismo [V/S].

### 6.4 Reindexar, empacar y respaldo

- "Reindexar Archivos" (`reindex.scx`) es un catálogo en tabla, `ARCHIVOS.DBF` (archivo, descripción, expresión del índice,
  etiqueta, condición `FOR`), que se recorre abriendo cada tabla en **exclusivo**, ejecutando `INDEX ON … TAG …` y, si se marca
  "Empacar Archivos", `PACK` [V]. Filas del catálogo: CONTAC 139, BANCOC 107, INV64 162, cxc64 72, plan64 235, IVA64 13, LOTE64 9,
  AFIJO64 6 [V] (LOTE64 y AFIJO64 cubren solo una parte de sus tablas).
- El borrado es lógico (`DELETE`); el espacio se libera solo al empacar.
- **No hay utilidad de respaldo en ningún menú** ni de restauración [V]. Los `.BAK`, `*OLD*`, `RESPAL/` y las tablas `PTEMP*`
  son copias manuales [I].

### 6.5 Tablas temporales

- Las pantallas que posteán o arman reportes crean tablas por usuario en la carpeta de datos: `PPROV<usr>`/`DPROV<usr>` (encabezado
  y líneas de una partida, nombre armado con el número de usuario), `PTEMP*`, `DTEMP*`, `PP*`, `KK`, y tablas con nombre
  `SYS(3)` copiadas con `COPY STRUCTURE … WITH CDX` y borradas al terminar [V]. Muchas **quedan en disco con datos reales**
  (INV64 y planilla arrastran tablas de decenas de miles de filas) [V + S].
- Se pasan por nombre de archivo a `CGADIPAR`; no hay identificador de lote.

### 6.6 Impresión y exportación

- Patrón: diálogo `donde.scx` ("pantalla / impresora") y luego `REPORT FORM <frx> PREVIEW` (con `foxypreviewer.app`) o `TO PRINT PROMPT`
  [V]. Conteos de `REPORT FORM` en código vivo: CONTAC 161, BANCOC 149, INV64 775, cxc64 367, plan64 284, IVA64 53, LOTE64 85, AFIJO64 14.
- Selección de impresora: el cuadro de impresión de Windows (`PROMPT`); `SET PRINTER TO` solo en 2 sitios de INV64. Los formatos de
  cheque, quedan, factura, nota, etc. son **reportes `.frx` que cambia cada cliente** y su nombre se guarda en `EMPRESAS.FORMA*`,
  `CTABANCO.FORMACHK` y `cfg_formaq` [V].
- Exportación a Excel: `COPY TO <archivo> TYPE XL5/XLS` (formato BIFF, **sin automatización OLE**) en CONTAC 6 sitios, BANCOC 1, INV64 20,
  cxc64 12, IVA64 39, plan64 16; LOTE64 y AFIJO64 ninguno [V]. Los archivos para Hacienda (IVA64) y planilla (ISSS, F910, bancos)
  son archivos de ancho fijo o Excel generados así.

### 6.7 Manejo de errores

- `ON ERROR DO errorprg …` está **comentado en los ocho `access.prg`** (se limpia con `ON ERROR` al salir) [V]. Existen `errorprg.prg`,
  las tablas `ERROR` (719 filas en CONTAC, 584 en cxc64, 654 en IVA64/LOTE64/AFIJO64, 706-897 en plan64) y `MSGERR`
  (37 a 57 mensajes) con la descripción amigable de cada código de error de FoxPro, pero **no están conectados** al arranque; los
  errores salen como cuadros nativos de FoxPro [V].
- Las validaciones de negocio muestran mensajes de ventana (`WAIT WINDOW`, `msgerr` de cada `Valid`); no se registra nada.
- `genxtab.prg` trae su propio `ON ERROR` local para las tablas cruzadas.

### 6.8 Otros elementos que todos copian

Pantallas "Seleccionar Empresa", "Mantenimiento de Empresas" (`sbmemp01`, seis versiones), "Contacto/Acerca de" (`mcinfo`), "Donde"
(imprimir), "Sí/No" (`sino`, `sino2`), calculadora y buscador del sistema; funciones de consulta `ver*.prg` (clientes,
proveedores, departamentos, municipios, giros, facturas); `enletra.prg` (importe en letras), `fechalet.prg` (fecha en letras);
catálogos geográficos en cxc64 e IVA64 (con contenido distinto) [V].

---

## 7. Qué significa para la plataforma nueva

Lo que ya existe se lee en `apps/api/src/db/schema-core.ts`, `schema-auth.ts`, `packages/shared/src/roles.ts`,
`apps/api/src/routes/users.ts`, `routes/empresas.ts`, `lib/audit.ts`, `middleware/module-context.ts`, `docs/module-guide.md` y
`docs/architecture.md`. **Las propuestas están marcadas como tales.**

| Pieza del legado | Qué hay hoy en la plataforma nueva | Qué falta / propuesta |
|---|---|---|
| **Usuarios** (`USUARIOS`, 8 copias) | Better Auth: tablas `user`, `session`, `account`, `verification`; correo y clave; columnas `role`, `banned`, `banReason`, `banExpires`; sesión de 8 horas; API de usuarios (`routes/users.ts`) con permiso `supervise`, protege al último propietario, evita auto-bloqueo y auditoría de cada cambio | (a) **Una sola tabla de usuarios para todo el producto** (resuelve las 8 copias). (b) El legado identifica por un código de 10 caracteres; el nuevo por correo: guardar el código viejo como alias para el importador. (c) **Las claves no se pueden migrar** (verificador no reversible): forzar restablecimiento. (d) Falta cambio de clave por el propio usuario (REPORTE S19) y política de clave (el legado exige 6 caracteres con reglas; Better Auth usa sus valores por omisión [I]). (e) No hay bloqueo por intentos fallidos; el legado tampoco lo tenía, pero `banned` es manual: *propuesta*, contador de fallos con bloqueo temporal |
| **Niveles** (`USRLVL` 1-4) | `roles.ts`: `owner`, `supervisor`, `digitador_consulta`, `digitador`, `consulta` (+ alias `admin`, `member`); permisos `capture`, `reports`, `supervise` | Mapeo directo de los cuatro niveles. Faltan los ejes que el legado tenía aparte: `VE_COSTO` (ver costos), sueldos/planilla (`NIVEL*`, `IMPRECIBO`), `USRTYPE` y alcance por patrono/división (`CODEMP`, `DIVISION`) → *propuesta:* permisos finos `view_costs`, `view_salaries`, y alcance de datos por división |
| **Permisos por pantalla** (`PERFIL`, 630 claves, 5 banderas) | **Solo tres permisos**: `capture`, `reports`, `supervise`, exigidos con `requirePermission` por ruta; el manifiesto de módulo declara otro vocabulario (`read/write/delete` por `owner/admin/member`) **que ninguna ruta de `apps/api/src` usa** [V] | Falta un modelo de **permisos por acción y módulo**. *Propuesta:* catálogo de permisos `módulo.acción` (ver, crear, modificar, anular, contabilizar, cerrar/reabrir, exportar, ver costos, ver sueldos…) con roles por omisión y ajuste por usuario; **no portar las 630 claves 1:1** (hay duplicadas y huecos). Decisión pendiente del negocio (P9 de PREGUNTAS) |
| **Empresas** (`EMPRESAS`) | `core_empresas`: nombre, siglas, moneda ISO, gran contribuyente, `consolida_en_id`, activa. API de alta/edición y asignación de usuarios. El middleware exige empresa activa en cada llamada | Faltan los datos fiscales y operativos que el legado repartía entre módulos: NIT, NRC, giro, actividad económica, departamento/municipio, dirección, teléfono, correo, logo, nombre comercial; series y resoluciones por tipo de documento; modo/ambiente DTE; formatos de impresión. *Propuesta:* tabla `core_empresa_profile` y los datos de series en el módulo de ventas/impuestos |
| **Asignación usuario ↔ empresa** (`USREMP`) | `core_user_empresas` (la fila es el permiso); `owner` ve todas | Cubierto. El importador de CONTAC solo lee `EMPRESAS`: no migra `USREMP` |
| **Crear empresa** (`creaemp`: carpeta + estructuras + `.MEM`) | `POST /empresas`; todo vive en una base con `empresa_id` | Falta el **sembrado** de una empresa nueva (tipos de partida, catálogo base opcional, configuración por omisión): *propuesta:* un servicio de "alta de empresa" que ejecuta los semillas de cada módulo en una transacción |
| **Consolidación** (`CONSOLIDA`, inerte en el legado) | `consolida_en_id` | Solo el campo; la consulta entre empresas es trabajo nuevo (el legado no la implementó) |
| **Bitácora** (`BITACORA`) | `core_audit_log` (empresa, usuario, instante ISO, módulo, acción, entidad, id de entidad, detalle JSON) escrito con `audit()` dentro de la misma transacción; es más rico que el legado | **No hay pantalla ni ruta de consulta** de `core_audit_log` (solo se escribe) [V]. Falta política de cobertura (el legado no registraba partidas ni documentos bancarios; la guía exige auditar todo alta/cambio/anulación/cierre) y de retención. *Propuesta:* ruta `GET /audit` con filtros usuario/fecha/módulo/entidad y exportación; importar `BITACORA` histórica como filas `module = 'legacy:<módulo>'` |
| **Configuración `.MEM`** (40+ archivos, 3 niveles) | Tabla `settings` (clave/valor **global**, solo `owner`, para puerto y nombre de la aplicación). **No hay configuración por empresa** | **Falta el almacén de configuración por empresa** para tasas de IVA/retención/percepción/anticipo/LIOF, cuentas contables (IVA, renta, gasto, ventas, costo, cajas, planilla, activo fijo, producción), formatos, decimales, prefijos, bloqueos. *Propuesta:* `core_empresa_settings` (`empresa_id`, `namespace`, `key`, `value` JSON validado con Zod por módulo, `valid_from`, `updated_by`, `updated_at`) con **vigencia por fecha** para tasas y topes, y validación de que las cuentas existen y son de detalle; mapeo de importación de las variables de §5.2. Las cuentas deben ser referencias al catálogo, no texto |
| **Correlativos** (`signum` máximo+1; `CTABANCO.CORRE`; `TIPOPAR.NUMERO`; `CORRE`; `NUMERO.MEM`; liquidaciones con número armado) | Cada módulo numera lo suyo: `gl_entry_types.number_width` y el número por período y tipo en el libro mayor; no hay servicio común | **Falta un servicio de secuencias.** *Propuesta:* `core_sequences` (`empresa_id`, `scope`, `key`, `next`, `width`, `prefix`, vigencia/resolución) con incremento atómico en la misma transacción que crea el documento; usos: partidas, cheques, quedan, series fiscales (con resolución, rango y vigencia), comprobantes de retención, corridas de planilla. Decidido en CONTAC: numeración mensual por tipo, sin renumerar; la anulada conserva su número |
| **Mes de trabajo** (`MESACT.<n>`) | Se recuerda por empresa en el navegador (`work-period.ts`); es solo de interfaz | Correcto para la UI; el servidor no debe depender de él: validar el período con la **fecha del documento** |
| **Cierre de mes** (6 mecanismos, no sincronizados) | `gl_periods` en el módulo de libro mayor (`open`/`closed`, quién y cuándo) y cierre anual; **no hay estado de cierre compartido** con otros módulos | **Falta un registro de períodos compartido.** *Propuesta:* `core_periods` (`empresa_id`, `period`, `area`, `status open/closed/filed`, `closed_by/at`, motivo de reapertura) y un contrato `assertPeriodOpen(empresaId, area, date)` que todo módulo invoque antes de contabilizar o mover; regla: GL cerrado ⇒ ningún módulo contabiliza ahí; reabrir con `supervise`, motivo y auditoría |
| **Rutina de contabilización** (5 versiones de `CGADIPAR`) | `GL_ENTRY_SOURCES = manual, bancos, iva, cierre, importado`; las partidas guardan `source` y `source_ref` | Falta el contrato único `gl.postEntry({source, sourceRef, …})` idempotente, con orígenes nuevos (`cxc`, `cxp`, `ventas`, `inventario`, `costo`, `produccion`, `activo_fijo`, `nomina`), validación de cuadre, cierre y cuenta de detalle en una sola transacción. Ver integracion-legado §4 |
| **Bloqueo / concurrencia** | Un solo escritor (API) y transacciones síncronas por petición (`module-guide.md`) | Resuelto por diseño; el legado no tenía transacciones |
| **Reindexar / empacar / respaldo** | No aplica a SQLite; respaldo diario está en el backlog (`architecture.md` #8) | Falta el **respaldo** (el legado tampoco lo tenía) y la llave de recuperación |
| **Manejo de errores** | `handleError` central (`RuleError`, validación Zod, 500 genérico); sin tabla de errores | Opcional: guardar los 500 en el registro de auditoría o de errores con referencia mostrada al usuario |
| **Impresión / Excel** | Fuera de la capa compartida hoy | *Propuesta:* un servicio de reportes común (PDF y XLSX) en lugar de `REPORT FORM`/`TYPE XL5` |
| **Módulos opcionales por empresa** (ocho `.exe` separados) | Tabla `modules` con activación **global** (`is_enabled`, `is_always_on`) | Falta activación **por empresa** (producción, activo fijo y planilla son opcionales por cliente) |

### Resumen de brechas que hay que cerrar antes de construir Bancos y el resto

1. **Permisos por acción** (hoy solo `capture`, `reports`, `supervise`).
2. **Configuración por empresa** con vigencia (tasas, cuentas, formatos).
3. **Secuencias/correlativos** atómicos.
4. **Estado de cierre compartido** entre módulos y regla "GL cerrado ⇒ nadie contabiliza".
5. **Contrato de contabilización** con origen y enlace (ver integración).
6. Consulta de **auditoría** y política de qué se audita.
7. **Ficha fiscal de la empresa** y activación de módulos por empresa.

---

## 8. Preguntas abiertas

### 8.1 Para el negocio

| # | Pregunta | Propuesta de respuesta |
|---|---|---|
| N1 | ¿Hay usuarios que existan en varios módulos con niveles distintos a propósito (por ejemplo Supervisor en CxC y Consulta en Contabilidad)? | Importar el nivel más alto por usuario como rol y registrar las diferencias para que el negocio las confirme |
| N2 | ¿Para qué se usan `USRTYPE` (nivel 2 oculta opciones), `VE_COSTO` y los niveles de planilla (`NIVEL*`)? | Convertirlos en permisos explícitos (`view_costs`, `view_salaries`, niveles de autorización de planilla) y que el negocio los asigne |
| N3 | ¿Quién debe poder abrir la clave de cierre de INV64/CxC y reabrir meses (hoy "clave" compartida o ninguna)? | Solo `supervise`, con motivo y bitácora; sin claves en archivos |
| N4 | ¿Se necesita mantener permisos pantalla por pantalla o bastan roles por módulo y acción? (P9) | Roles por módulo y acción; excepciones solo para ver costos/sueldos |
| N5 | ¿Cuántas empresas tiene cada cliente y comparten usuarios entre módulos? (todo lo verificado es de una empresa) | Pedir una copia con varias empresas antes de cerrar el modelo de `USREMP` |
| N6 | ¿La bitácora histórica (23,455 filas en CxC) debe conservarse? | Importarla como histórico de solo lectura |
| N7 | ¿Qué claves de cierre (`CLAVE.MEM`, `SEGUIR.MEM`) están en uso y quién las conoce? | Retirarlas; no migrar claves |

### 8.2 Para los desarrolladores

| # | Pregunta | Propuesta de respuesta |
|---|---|---|
| D1 | ¿Se migran las claves de los usuarios? | No: el verificador es aditivo y no reversible. Crear usuarios con restablecimiento obligatorio y guardar el código de usuario viejo como alias |
| D2 | ¿Dónde viven las tasas y cuentas hoy duplicadas en cinco módulos? | Una tabla por empresa, con vigencia; el importador lee cada `.MEM` y reporta divergencias entre módulos |
| D3 | ¿Cómo se ordena la precedencia cuando dos `.MEM` traen la misma variable (INV64: `BANCOCFG` sobre `BASE`; BANCOC: `IVACFG` sobre `BANCOCFG`)? | Regla de importación explícita: el archivo que **ganaba en tiempo de ejecución** fija el valor; los demás se informan |
| D4 | ¿Se conserva la unidad de `cfg_iva` (factor en INV64, porcentaje en otros)? | Un solo campo: porcentaje; el importador convierte el factor |
| D5 | ¿La "licencia" de `EMPRESA.MEM` (`emp`, `numempre`) debe reproducirse? | No; el control de empresas pasa a la instalación (módulo/licencia propios) |
| D6 | ¿Cómo se auditan las operaciones que hoy no dejaban bitácora (partidas, documentos bancarios, facturas)? | Todo a través de `audit()` en la misma transacción; cobertura medida por prueba |
| D7 | ¿La consulta de auditoría es pantalla propia o parte del módulo de administración? | Pantalla de administración con filtros usuario/fecha/módulo/entidad y exportación (`supervise`) |
| D8 | ¿El alcance por división/patrono de planilla (`CODEMP`, `DIVISION`) se modela en permisos o en datos? | En permisos de datos (alcance), no en el rol |
| D9 | Las tablas por usuario `PPROV<usr>`/`DPROV<usr>` y volcados `.MEM` con datos reales: ¿se ignoran? | Ignorar; no migrar |

### Lo que no pude determinar

- El significado de `USUARIOS.SP` (todos los módulos) y de `USRTYPE`: se usan solo como bandera de visibilidad de menú.
- Si las copias de `PERFIL.DBF` de BANCOC (66,768 borradas) crecen por reescritura de perfil o por otro proceso.
- Qué variables de `CXCCFG.MEM` de planilla usa realmente cxc64 (ninguna encontrada en el código vivo).
- La lógica de `conta()` (integración de correlativos con Bancos), que BANCOC cita y no está en el proyecto.
- El efecto real del `mesact` de 7 caracteres de planilla sobre `SALDOS` (requiere ejecutar el código).
